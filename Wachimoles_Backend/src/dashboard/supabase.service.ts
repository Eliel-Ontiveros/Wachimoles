import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import {
  BODY_CONDITION_IMAGE_MAX_SIZE_BYTES,
  BodyConditionImage,
  BodyCondition,
  BodyConditionStatus,
  BodyConditionsQuery,
  BODY_REGION_CATEGORIES,
  BodyRegionCategory,
  DailyHealthCheck,
  DailyHealthChecksQuery,
  DashboardSample,
  HealthStatusLevel,
  MoodScore,
  SamplesQuery,
  SampleMetric,
  UploadedBodyConditionImage
} from "./dashboard.types";
import { SaveDailyHealthCheckDto } from "./daily-health-checks.dto";
import { SaveBodyConditionDto } from "./body-conditions.dto";

interface SupabaseSampleRow {
  id: number;
  sample_id: string;
  metric: SampleMetric;
  value: number;
  unit: string;
  measured_at: string;
  received_at: string;
}

interface SupabaseBodyConditionRow {
  id: string;
  muscle_id: string;
  body_region: BodyRegionCategory;
  muscle_name: string;
  condition_name: string;
  description: string | null;
  pain_intensity: number;
  swelling: boolean;
  functional_limitation: boolean;
  status: BodyConditionStatus;
  recorded_at: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

interface SupabaseDailyHealthCheckRow {
  id: string;
  date_iso: string;
  blood_sugar_mg_dl: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  temperature_c: number | null;
  sleep_hours: number | null;
  mood: MoodScore;
  symptoms: string[];
  notes: string | null;
  overall_status: HealthStatusLevel;
  recommendation: string;
  recorded_at: string;
  created_at: string;
  updated_at: string;
}

interface SupabaseStorageObject {
  name: string;
}

const BODY_CONDITION_IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSupabaseStorageObject(value: unknown): value is SupabaseStorageObject {
  return isRecord(value) && typeof value.name === "string";
}

function getImageExtension(file: UploadedBodyConditionImage): string {
  const isJpeg =
    file.mimetype === "image/jpeg" &&
    file.buffer.length >= 3 &&
    file.buffer[0] === 0xff &&
    file.buffer[1] === 0xd8 &&
    file.buffer[2] === 0xff;
  const isPng =
    file.mimetype === "image/png" &&
    file.buffer.length >= 8 &&
    file.buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  const isWebp =
    file.mimetype === "image/webp" &&
    file.buffer.length >= 12 &&
    file.buffer.toString("ascii", 0, 4) === "RIFF" &&
    file.buffer.toString("ascii", 8, 12) === "WEBP";

  if (isJpeg) {
    return "jpg";
  }
  if (isPng) {
    return "png";
  }
  if (isWebp) {
    return "webp";
  }

  throw new BadRequestException(
    "Only valid JPEG, PNG, and WebP images are supported."
  );
}

function isBodyRegionCategory(value: unknown): value is BodyRegionCategory {
  return (
    typeof value === "string" &&
    BODY_REGION_CATEGORIES.some((category) => category === value)
  );
}

function isHealthStatusLevel(value: unknown): value is HealthStatusLevel {
  return value === "normal" || value === "warning" || value === "critical";
}

function isMoodScore(value: unknown): value is MoodScore {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isSupabaseSampleRow(value: unknown): value is SupabaseSampleRow {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isSafeInteger(value.id) &&
    typeof value.sample_id === "string" &&
    typeof value.metric === "string" &&
    ["heart_rate", "stress", "spo2", "steps", "sleep"].includes(value.metric) &&
    typeof value.value === "number" &&
    Number.isFinite(value.value) &&
    typeof value.unit === "string" &&
    typeof value.measured_at === "string" &&
    typeof value.received_at === "string"
  );
}

function isSupabaseBodyConditionRow(
  value: unknown
): value is SupabaseBodyConditionRow {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.muscle_id === "string" &&
    isBodyRegionCategory(value.body_region) &&
    typeof value.muscle_name === "string" &&
    typeof value.condition_name === "string" &&
    (typeof value.description === "string" || value.description === null) &&
    Number.isInteger(value.pain_intensity) &&
    typeof value.swelling === "boolean" &&
    typeof value.functional_limitation === "boolean" &&
    (value.status === "active" || value.status === "resolved") &&
    typeof value.recorded_at === "string" &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    (typeof value.resolved_at === "string" || value.resolved_at === null)
  );
}

function mapBodyCondition(row: SupabaseBodyConditionRow): BodyCondition {
  return {
    id: row.id,
    muscleId: row.muscle_id,
    bodyRegion: row.body_region,
    muscleName: row.muscle_name,
    conditionName: row.condition_name,
    description: row.description,
    painIntensity: row.pain_intensity,
    swelling: row.swelling,
    functionalLimitation: row.functional_limitation,
    status: row.status,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at
  };
}

function isSupabaseDailyHealthCheckRow(
  value: unknown
): value is SupabaseDailyHealthCheckRow {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.date_iso === "string" &&
    isNullableFiniteNumber(value.blood_sugar_mg_dl) &&
    isNullableFiniteNumber(value.systolic_bp) &&
    isNullableFiniteNumber(value.diastolic_bp) &&
    isNullableFiniteNumber(value.temperature_c) &&
    isNullableFiniteNumber(value.sleep_hours) &&
    isMoodScore(value.mood) &&
    Array.isArray(value.symptoms) &&
    value.symptoms.every((symptom) => typeof symptom === "string") &&
    (typeof value.notes === "string" || value.notes === null) &&
    isHealthStatusLevel(value.overall_status) &&
    typeof value.recommendation === "string" &&
    typeof value.recorded_at === "string" &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function mapDailyHealthCheck(
  row: SupabaseDailyHealthCheckRow
): DailyHealthCheck {
  return {
    id: row.id,
    dateIso: row.date_iso,
    bloodSugarMgDl: row.blood_sugar_mg_dl,
    systolicBp: row.systolic_bp,
    diastolicBp: row.diastolic_bp,
    temperatureC: row.temperature_c,
    sleepHours: row.sleep_hours,
    mood: row.mood,
    symptoms: row.symptoms,
    notes: row.notes,
    overallStatus: row.overall_status,
    recommendation: row.recommendation,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly storageBucket: string;

  constructor(config: ConfigService) {
    this.supabaseUrl = config.getOrThrow<string>("SUPABASE_URL");
    this.serviceRoleKey = config.getOrThrow<string>(
      "SUPABASE_SERVICE_ROLE_KEY"
    );
    this.storageBucket = config.get<string>("SUPABASE_STORAGE_BUCKET")?.trim() ?? "";
  }

  async getSamples(
    userId: string,
    query: SamplesQuery
  ): Promise<DashboardSample[]> {
    const url = new URL(`${this.supabaseUrl}/rest/v1/samples`);
    url.searchParams.set(
      "select",
      "id,sample_id,metric,value,unit,measured_at,received_at"
    );
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("order", "measured_at.desc,id.desc");
    url.searchParams.set("limit", String(query.limit ?? 100));
    if (query.metric) {
      url.searchParams.set("metric", `eq.${query.metric}`);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(10000)
      });
    } catch (error) {
      this.logger.error("Supabase database could not be reached.", error);
      throw new ServiceUnavailableException(
        "Dashboard database is temporarily unavailable."
      );
    }

    if (!response.ok) {
      let databaseError: unknown;
      try {
        databaseError = await response.json();
      } catch {
        databaseError = null;
      }

      const code =
        isRecord(databaseError) && typeof databaseError.code === "string"
          ? databaseError.code
          : "unknown";
      const message =
        isRecord(databaseError) && typeof databaseError.message === "string"
          ? databaseError.message.slice(0, 300)
          : "No error message returned.";
      this.logger.error(
        `Supabase database returned HTTP ${response.status} (${code}): ${message}`
      );
      throw new ServiceUnavailableException(
        "Dashboard data could not be loaded."
      );
    }

    let rows: unknown;
    try {
      rows = await response.json();
    } catch (error) {
      this.logger.error("Supabase database returned invalid JSON.", error);
      throw new ServiceUnavailableException(
        "Dashboard database returned an invalid response."
      );
    }

    if (!Array.isArray(rows) || !rows.every(isSupabaseSampleRow)) {
      this.logger.error("Supabase database returned an unexpected sample shape.");
      throw new ServiceUnavailableException(
        "Dashboard database returned an invalid sample response."
      );
    }

    return rows.map((row) => ({
      id: row.id,
      sampleId: row.sample_id,
      metric: row.metric,
      value: row.value,
      unit: row.unit,
      measuredAt: row.measured_at,
      receivedAt: row.received_at
    }));
  }

  async getBodyConditions(
    userId: string,
    query: BodyConditionsQuery
  ): Promise<BodyCondition[]> {
    const url = this.getBodyConditionsUrl();
    url.searchParams.set(
      "select",
      "id,muscle_id,body_region,muscle_name,condition_name,description,pain_intensity,swelling,functional_limitation,status,recorded_at,created_at,updated_at,resolved_at"
    );
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("order", "recorded_at.desc,id.desc");
    url.searchParams.set("limit", String(query.limit ?? 100));

    const response = await this.requestSupabaseTable(
      url,
      { method: "GET" },
      "body-condition"
    );
    const rows = await this.parseBodyConditionRows(response);
    return rows.map(mapBodyCondition);
  }

  async saveBodyCondition(
    userId: string,
    muscleId: string,
    body: SaveBodyConditionDto
  ): Promise<BodyCondition> {
    const url = this.getBodyConditionsUrl();
    url.searchParams.set("on_conflict", "user_id,muscle_id");
    const recordedAt = new Date().toISOString();
    const response = await this.requestSupabaseTable(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify({
          user_id: userId,
          muscle_id: muscleId,
          body_region: body.bodyRegion,
          muscle_name: body.muscleName.trim(),
          condition_name: body.conditionName.trim(),
          description: body.description?.trim() || null,
          pain_intensity: body.painIntensity,
          swelling: body.swelling,
          functional_limitation: body.functionalLimitation,
          status: "active",
          recorded_at: recordedAt,
          updated_at: recordedAt,
          resolved_at: null
        })
      },
      "body-condition"
    );
    const rows = await this.parseBodyConditionRows(response);
    if (rows.length !== 1) {
      this.logger.error("Supabase did not return the saved body condition.");
      throw new ServiceUnavailableException(
        "The body condition could not be saved."
      );
    }

    return mapBodyCondition(rows[0]);
  }

  async resolveBodyCondition(
    userId: string,
    muscleId: string
  ): Promise<{ resolved: true }> {
    const url = this.getBodyConditionsUrl();
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("muscle_id", `eq.${muscleId}`);
    url.searchParams.set("status", "eq.active");
    const resolvedAt = new Date().toISOString();

    await this.requestSupabaseTable(
      url,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          status: "resolved",
          resolved_at: resolvedAt,
          updated_at: resolvedAt
        })
      },
      "body-condition"
    );

    return { resolved: true };
  }

  async uploadBodyConditionImage(
    userId: string,
    muscleId: string,
    file: UploadedBodyConditionImage | undefined
  ): Promise<BodyConditionImage> {
    if (!file?.buffer?.length) {
      throw new BadRequestException("An image file is required.");
    }
    if (
      file.size > BODY_CONDITION_IMAGE_MAX_SIZE_BYTES ||
      file.buffer.length > BODY_CONDITION_IMAGE_MAX_SIZE_BYTES
    ) {
      throw new PayloadTooLargeException(
        "The image must not exceed 10 MB."
      );
    }

    const extension = getImageExtension(file);
    const path = `${userId}/${muscleId}/${randomUUID()}.${extension}`;
    const response = await this.requestStorage(
      this.getStorageObjectUrl(null, path),
      {
        method: "POST",
        headers: { "Content-Type": file.mimetype },
        body: new Blob([Uint8Array.from(file.buffer)], {
          type: file.mimetype
        })
      },
      "upload body-condition image"
    );
    await response.arrayBuffer();

    return this.createSignedBodyConditionImage(path);
  }

  async getBodyConditionImages(
    userId: string,
    muscleId: string
  ): Promise<BodyConditionImage[]> {
    const prefix = `${userId}/${muscleId}/`;
    const response = await this.requestStorage(
      this.getStorageObjectUrl("list"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix,
          limit: 100,
          offset: 0,
          sortBy: { column: "created_at", order: "desc" }
        })
      },
      "list body-condition images"
    );

    let rows: unknown;
    try {
      rows = await response.json();
    } catch (error) {
      this.logger.error("Supabase Storage returned invalid image-list JSON.", error);
      throw new ServiceUnavailableException(
        "Supabase Storage returned an invalid image-list response."
      );
    }

    if (
      !Array.isArray(rows) ||
      !rows.every(
        (row) =>
          isSupabaseStorageObject(row) &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(
            row.name
          )
      )
    ) {
      this.logger.error("Supabase Storage returned an unexpected image-list shape.");
      throw new ServiceUnavailableException(
        "Supabase Storage returned an invalid image-list response."
      );
    }

    return Promise.all(
      rows.map((row) =>
        this.createSignedBodyConditionImage(`${prefix}${row.name}`)
      )
    );
  }

  async deleteBodyConditionImage(
    userId: string,
    muscleId: string,
    fileName: string
  ): Promise<{ deleted: true }> {
    const response = await this.requestStorage(
      this.getStorageObjectUrl(null),
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefixes: [`${userId}/${muscleId}/${fileName}`]
        })
      },
      "delete body-condition image"
    );
    await response.arrayBuffer();
    return { deleted: true };
  }

  async getDailyHealthChecks(
    userId: string,
    query: DailyHealthChecksQuery
  ): Promise<DailyHealthCheck[]> {
    const url = this.getDailyHealthChecksUrl();
    url.searchParams.set(
      "select",
      "id,date_iso,blood_sugar_mg_dl,systolic_bp,diastolic_bp,temperature_c,sleep_hours,mood,symptoms,notes,overall_status,recommendation,recorded_at,created_at,updated_at"
    );
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("order", "date_iso.desc,recorded_at.desc");
    url.searchParams.set("limit", String(query.limit ?? 100));

    const response = await this.requestSupabaseTable(
      url,
      { method: "GET" },
      "daily health-check"
    );
    const rows = await this.parseDailyHealthCheckRows(response);
    return rows.map(mapDailyHealthCheck);
  }

  async saveDailyHealthCheck(
    userId: string,
    dateIso: string,
    body: SaveDailyHealthCheckDto
  ): Promise<DailyHealthCheck> {
    const url = this.getDailyHealthChecksUrl();
    url.searchParams.set("on_conflict", "user_id,date_iso");
    const recordedAt = new Date().toISOString();
    const response = await this.requestSupabaseTable(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify({
          user_id: userId,
          date_iso: dateIso,
          blood_sugar_mg_dl: body.bloodSugarMgDl ?? null,
          systolic_bp: body.systolicBp ?? null,
          diastolic_bp: body.diastolicBp ?? null,
          temperature_c: body.temperatureC ?? null,
          sleep_hours: body.sleepHours ?? null,
          mood: body.mood,
          symptoms: body.symptoms,
          notes: body.notes?.trim() || null,
          overall_status: body.overallStatus,
          recommendation: body.recommendation.trim(),
          recorded_at: recordedAt,
          updated_at: recordedAt
        })
      },
      "daily health-check"
    );
    const rows = await this.parseDailyHealthCheckRows(response);
    if (rows.length !== 1) {
      this.logger.error("Supabase did not return the saved daily health check.");
      throw new ServiceUnavailableException(
        "The daily health check could not be saved."
      );
    }

    return mapDailyHealthCheck(rows[0]);
  }

  private getBodyConditionsUrl(): URL {
    return new URL(`${this.supabaseUrl}/rest/v1/body_conditions`);
  }

  private getDailyHealthChecksUrl(): URL {
    return new URL(`${this.supabaseUrl}/rest/v1/daily_health_checks`);
  }

  private getStorageObjectUrl(operation: string | null, path?: string): URL {
    if (!this.storageBucket) {
      throw new ServiceUnavailableException(
        "Image storage is not configured. Set SUPABASE_STORAGE_BUCKET."
      );
    }

    const bucket = encodeURIComponent(this.storageBucket);
    const objectPath = path
      ? `/${path.split("/").map(encodeURIComponent).join("/")}`
      : "";
    const operationPath = operation ? `/${operation}` : "";
    return new URL(
      `${this.supabaseUrl}/storage/v1/object${operationPath}/${bucket}${objectPath}`
    );
  }

  private async createSignedBodyConditionImage(
    path: string
  ): Promise<BodyConditionImage> {
    const response = await this.requestStorage(
      this.getStorageObjectUrl("sign", path),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiresIn: BODY_CONDITION_IMAGE_SIGNED_URL_TTL_SECONDS
        })
      },
      "create body-condition image URL"
    );

    let result: unknown;
    try {
      result = await response.json();
    } catch (error) {
      this.logger.error("Supabase Storage returned invalid signed-URL JSON.", error);
      throw new ServiceUnavailableException(
        "Supabase Storage returned an invalid signed-URL response."
      );
    }

    if (!isRecord(result) || typeof result.signedURL !== "string") {
      this.logger.error("Supabase Storage returned an unexpected signed-URL shape.");
      throw new ServiceUnavailableException(
        "Supabase Storage returned an invalid signed-URL response."
      );
    }

    const signedValue = result.signedURL;
    const isAbsoluteUrl = /^https?:\/\//i.test(signedValue);
    const signedPath = signedValue.startsWith("/storage/v1/")
      ? signedValue
      : `/storage/v1/${signedValue.replace(/^\/+/, "")}`;
    let signedUrl: URL;
    try {
      signedUrl = new URL(
        isAbsoluteUrl ? signedValue : signedPath,
        `${this.supabaseUrl}/`
      );
    } catch (error) {
      this.logger.error("Supabase Storage returned an invalid signed URL.", error);
      throw new ServiceUnavailableException(
        "Supabase Storage returned an invalid signed-URL response."
      );
    }

    const expectedPath = `/storage/v1/object/sign/${encodeURIComponent(
      this.storageBucket
    )}/${path.split("/").map(encodeURIComponent).join("/")}`;
    if (
      signedUrl.origin !== new URL(this.supabaseUrl).origin ||
      signedUrl.pathname !== expectedPath
    ) {
      this.logger.error("Supabase Storage returned a signed URL for another host.");
      throw new ServiceUnavailableException(
        "Supabase Storage returned an invalid signed-URL response."
      );
    }

    return {
      path,
      signedUrl: signedUrl.toString(),
      expiresAt: new Date(
        Date.now() + BODY_CONDITION_IMAGE_SIGNED_URL_TTL_SECONDS * 1000
      ).toISOString()
    };
  }

  private async requestStorage(
    url: URL,
    init: RequestInit,
    operation: string
  ): Promise<Response> {
    let response: Response;
    try {
      const headers = new Headers(init.headers);
      headers.set("apikey", this.serviceRoleKey);
      headers.set("Authorization", `Bearer ${this.serviceRoleKey}`);
      headers.set("Accept", "application/json");
      response = await fetch(url, {
        ...init,
        headers,
        signal: AbortSignal.timeout(15000)
      });
    } catch (error) {
      this.logger.error(`Supabase Storage ${operation} request failed.`, error);
      throw new ServiceUnavailableException(
        "Image storage is temporarily unavailable."
      );
    }

    if (!response.ok) {
      let storageError: unknown;
      try {
        storageError = await response.json();
      } catch {
        storageError = null;
      }

      const message =
        isRecord(storageError) && typeof storageError.message === "string"
          ? storageError.message.slice(0, 300)
          : "No error message returned.";
      this.logger.error(
        `Supabase Storage ${operation} returned HTTP ${response.status}: ${message}`
      );
      throw new ServiceUnavailableException(
        "Image storage could not complete the request."
      );
    }

    return response;
  }

  private async requestSupabaseTable(
    url: URL,
    init: RequestInit,
    resource: string
  ): Promise<Response> {
    let response: Response;
    try {
      const headers = new Headers(init.headers);
      headers.set("apikey", this.serviceRoleKey);
      headers.set("Authorization", `Bearer ${this.serviceRoleKey}`);
      headers.set("Accept", "application/json");
      response = await fetch(url, {
        ...init,
        headers,
        signal: AbortSignal.timeout(10000)
      });
    } catch (error) {
      this.logger.error(`Supabase ${resource} request failed.`, error);
      throw new ServiceUnavailableException(
        `${resource} storage is temporarily unavailable.`
      );
    }

    if (!response.ok) {
      let databaseError: unknown;
      try {
        databaseError = await response.json();
      } catch {
        databaseError = null;
      }

      const code =
        isRecord(databaseError) && typeof databaseError.code === "string"
          ? databaseError.code
          : "unknown";
      const message =
        isRecord(databaseError) && typeof databaseError.message === "string"
          ? databaseError.message.slice(0, 300)
          : "No error message returned.";
      this.logger.error(
        `Supabase ${resource} request returned HTTP ${response.status} (${code}): ${message}`
      );
      throw new ServiceUnavailableException(
        `${resource} data could not be loaded or updated.`
      );
    }

    return response;
  }

  private async parseBodyConditionRows(
    response: Response
  ): Promise<SupabaseBodyConditionRow[]> {
    let rows: unknown;
    try {
      rows = await response.json();
    } catch (error) {
      this.logger.error("Supabase returned invalid body-condition JSON.", error);
      throw new ServiceUnavailableException(
        "Supabase returned an invalid body-condition response."
      );
    }

    if (!Array.isArray(rows) || !rows.every(isSupabaseBodyConditionRow)) {
      this.logger.error(
        "Supabase returned an unexpected body-condition response."
      );
      throw new ServiceUnavailableException(
        "Supabase returned an invalid body-condition response."
      );
    }

    return rows;
  }

  private async parseDailyHealthCheckRows(
    response: Response
  ): Promise<SupabaseDailyHealthCheckRow[]> {
    let rows: unknown;
    try {
      rows = await response.json();
    } catch (error) {
      this.logger.error(
        "Supabase returned invalid daily health-check JSON.",
        error
      );
      throw new ServiceUnavailableException(
        "Supabase returned an invalid daily health-check response."
      );
    }

    if (!Array.isArray(rows) || !rows.every(isSupabaseDailyHealthCheckRow)) {
      this.logger.error(
        "Supabase returned an unexpected daily health-check response."
      );
      throw new ServiceUnavailableException(
        "Supabase returned an invalid daily health-check response."
      );
    }

    return rows;
  }
}
