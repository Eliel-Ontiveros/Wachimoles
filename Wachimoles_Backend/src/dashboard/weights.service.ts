import {
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  BodyMetrics,
  BodyProfile,
  BodySex,
  calculateBodyMetrics
} from "./body-metrics";
import { SaveBodyProfileDto } from "./weights.dto";

export interface BodyProfileRecord extends BodyProfile {
  updatedAt: string;
}

export interface WeightRecord {
  id: number;
  measurementId: string;
  weightKg: number;
  device: string | null;
  measuredAt: string;
  receivedAt: string;
  /** null mientras el usuario activo no tenga perfil (estatura, edad, sexo). */
  metrics: BodyMetrics | null;
}

interface WeightRow {
  id: number;
  measurement_id: string;
  weight_kg: number;
  device: string | null;
  measured_at: string;
  received_at: string;
}

interface BodyProfileRow {
  height_cm: number;
  age_years: number | null;
  sex: BodySex | null;
  updated_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// PostgREST puede devolver numeric como número o como texto.
function toFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

function parseWeightRow(value: unknown): WeightRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const weight = toFiniteNumber(value.weight_kg);
  if (
    !Number.isSafeInteger(value.id) ||
    typeof value.measurement_id !== "string" ||
    weight === null ||
    (typeof value.device !== "string" && value.device !== null) ||
    typeof value.measured_at !== "string" ||
    typeof value.received_at !== "string"
  ) {
    return null;
  }
  return {
    id: value.id as number,
    measurement_id: value.measurement_id,
    weight_kg: weight,
    device: value.device as string | null,
    measured_at: value.measured_at,
    received_at: value.received_at
  };
}

function parseProfileRow(value: unknown): BodyProfileRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const height = toFiniteNumber(value.height_cm);
  const age =
    value.age_years === null || value.age_years === undefined
      ? null
      : toFiniteNumber(value.age_years);
  const sexIsValid =
    value.sex === null ||
    value.sex === undefined ||
    value.sex === "male" ||
    value.sex === "female";
  if (
    height === null ||
    (value.age_years !== null && value.age_years !== undefined && age === null) ||
    !sexIsValid ||
    typeof value.updated_at !== "string"
  ) {
    return null;
  }
  return {
    height_cm: height,
    age_years: age,
    sex: (value.sex as BodySex | null | undefined) ?? null,
    updated_at: value.updated_at
  };
}

@Injectable()
export class WeightsService {
  private readonly logger = new Logger(WeightsService.name);
  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;

  constructor(config: ConfigService) {
    this.supabaseUrl = config.getOrThrow<string>("SUPABASE_URL");
    this.serviceRoleKey = config.getOrThrow<string>(
      "SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  async getBodyProfile(userId: string): Promise<BodyProfileRecord | null> {
    const url = new URL(`${this.supabaseUrl}/rest/v1/user_body_profiles`);
    url.searchParams.set("select", "height_cm,age_years,sex,updated_at");
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("limit", "1");

    const rows = await this.request(url, { method: "GET" }, "body-profile");
    if (rows.length === 0) {
      return null;
    }
    const row = parseProfileRow(rows[0]);
    if (!row) {
      this.logger.error("Supabase returned an unexpected body-profile shape.");
      throw new ServiceUnavailableException(
        "Supabase returned an invalid body-profile response."
      );
    }
    return this.mapProfile(row);
  }

  async saveBodyProfile(
    userId: string,
    body: SaveBodyProfileDto
  ): Promise<BodyProfileRecord> {
    const url = new URL(`${this.supabaseUrl}/rest/v1/user_body_profiles`);
    url.searchParams.set("on_conflict", "user_id");

    const rows = await this.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify({
          user_id: userId,
          height_cm: body.heightCm,
          age_years: body.ageYears ?? null,
          sex: body.sex ?? null,
          updated_at: new Date().toISOString()
        })
      },
      "body-profile"
    );
    const row = rows.length === 1 ? parseProfileRow(rows[0]) : null;
    if (!row) {
      this.logger.error("Supabase did not return the saved body profile.");
      throw new ServiceUnavailableException(
        "The body profile could not be saved."
      );
    }
    return this.mapProfile(row);
  }

  async getWeights(userId: string, limit = 100): Promise<WeightRecord[]> {
    const url = new URL(`${this.supabaseUrl}/rest/v1/weight_measurements`);
    url.searchParams.set(
      "select",
      "id,measurement_id,weight_kg,device,measured_at,received_at"
    );
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("order", "measured_at.desc,id.desc");
    url.searchParams.set("limit", String(limit));

    const [rows, profile] = await Promise.all([
      this.request(url, { method: "GET" }, "weight"),
      this.getBodyProfile(userId)
    ]);

    return rows.map((raw) => {
      const row = parseWeightRow(raw);
      if (!row) {
        this.logger.error("Supabase returned an unexpected weight shape.");
        throw new ServiceUnavailableException(
          "Supabase returned an invalid weight response."
        );
      }
      return {
        id: row.id,
        measurementId: row.measurement_id,
        weightKg: row.weight_kg,
        device: row.device,
        measuredAt: row.measured_at,
        receivedAt: row.received_at,
        metrics: profile ? calculateBodyMetrics(row.weight_kg, profile) : null
      };
    });
  }

  private mapProfile(row: BodyProfileRow): BodyProfileRecord {
    return {
      heightCm: row.height_cm,
      ageYears: row.age_years,
      sex: row.sex,
      updatedAt: row.updated_at
    };
  }

  private async request(
    url: URL,
    init: RequestInit,
    resource: string
  ): Promise<unknown[]> {
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
      this.logger.error(
        `Supabase ${resource} request returned HTTP ${response.status} (${code}).`
      );
      throw new ServiceUnavailableException(
        `${resource} data could not be loaded or updated.`
      );
    }

    let rows: unknown;
    try {
      rows = await response.json();
    } catch (error) {
      this.logger.error(`Supabase returned invalid ${resource} JSON.`, error);
      throw new ServiceUnavailableException(
        `Supabase returned an invalid ${resource} response.`
      );
    }
    if (!Array.isArray(rows)) {
      this.logger.error(`Supabase returned a non-array ${resource} response.`);
      throw new ServiceUnavailableException(
        `Supabase returned an invalid ${resource} response.`
      );
    }
    return rows;
  }
}
