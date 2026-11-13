import {
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DashboardSample,
  SamplesQuery,
  SampleMetric
} from "./dashboard.types";

interface SupabaseSampleRow {
  id: number;
  sample_id: string;
  metric: SampleMetric;
  value: number;
  unit: string;
  measured_at: string;
  received_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSupabaseSampleRow(value: unknown): value is SupabaseSampleRow {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isSafeInteger(value.id) &&
    typeof value.sample_id === "string" &&
    typeof value.metric === "string" &&
    ["heart_rate", "stress", "spo2", "steps"].includes(value.metric) &&
    typeof value.value === "number" &&
    Number.isFinite(value.value) &&
    typeof value.unit === "string" &&
    typeof value.measured_at === "string" &&
    typeof value.received_at === "string"
  );
}

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;

  constructor(config: ConfigService) {
    this.supabaseUrl = config.getOrThrow<string>("SUPABASE_URL");
    this.serviceRoleKey = config.getOrThrow<string>(
      "SUPABASE_SERVICE_ROLE_KEY"
    );
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
}
