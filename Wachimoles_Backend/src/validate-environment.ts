const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function validateEnvironment(
  values: Record<string, unknown>
): Record<string, unknown> {
  const supabaseUrlValue = values.SUPABASE_URL;
  const serviceRoleKey = values.SUPABASE_SERVICE_ROLE_KEY;
  const dashboardApiToken = values.DASHBOARD_API_TOKEN;
  const dashboardWebPassword = values.DASHBOARD_WEB_PASSWORD;
  const dashboardUserId = values.DASHBOARD_USER_ID;
  const storageBucketValue = values.SUPABASE_STORAGE_BUCKET;
  const portValue = values.PORT ?? "3000";
  const originsValue = values.CORS_ORIGINS ?? "";

  if (typeof supabaseUrlValue !== "string" || !supabaseUrlValue.trim()) {
    throw new Error("SUPABASE_URL must be configured.");
  }

  let supabaseUrl: URL;
  try {
    supabaseUrl = new URL(supabaseUrlValue);
  } catch {
    throw new Error("SUPABASE_URL must be a valid URL.");
  }

  const isLocalHttp =
    supabaseUrl.protocol === "http:" && LOCAL_HOSTS.has(supabaseUrl.hostname);
  if (supabaseUrl.protocol !== "https:" && !isLocalHttp) {
    throw new Error("SUPABASE_URL must use HTTPS except for local development.");
  }

  if (typeof serviceRoleKey !== "string" || !serviceRoleKey.trim()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must be configured.");
  }

  if (
    storageBucketValue !== undefined &&
    (typeof storageBucketValue !== "string" ||
      !storageBucketValue.trim() ||
      /[\/\\\u0000-\u001f]/.test(storageBucketValue))
  ) {
    throw new Error(
      "SUPABASE_STORAGE_BUCKET must be a bucket ID without slashes or control characters."
    );
  }

  if (
    typeof dashboardApiToken !== "string" ||
    dashboardApiToken.length < 32
  ) {
    throw new Error("DASHBOARD_API_TOKEN must contain at least 32 characters.");
  }

  if (
    typeof dashboardWebPassword !== "string" ||
    dashboardWebPassword.length < 16 ||
    dashboardWebPassword.length > 256
  ) {
    throw new Error(
      "DASHBOARD_WEB_PASSWORD must contain between 16 and 256 characters."
    );
  }

  if (
    typeof dashboardUserId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      dashboardUserId
    )
  ) {
    throw new Error("DASHBOARD_USER_ID must be a valid Supabase user UUID.");
  }

  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  if (typeof originsValue !== "string") {
    throw new Error("CORS_ORIGINS must be a comma-separated list of origins.");
  }

  const origins = originsValue
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (let index = 0; index < origins.length; index += 1) {
    const origin = origins[index];
    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error(`CORS origin is invalid: ${origin}`);
    }

    if (
      !["http:", "https:"].includes(parsedOrigin.protocol) ||
      parsedOrigin.origin !== origin.replace(/\/$/, "")
    ) {
      throw new Error(`CORS origin must contain only an HTTP(S) origin: ${origin}`);
    }

    origins[index] = parsedOrigin.origin;
  }

  return {
    ...values,
    SUPABASE_URL: supabaseUrl.origin,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    SUPABASE_STORAGE_BUCKET:
      typeof storageBucketValue === "string" ? storageBucketValue.trim() : "",
    DASHBOARD_API_TOKEN: dashboardApiToken,
    DASHBOARD_WEB_PASSWORD: dashboardWebPassword,
    DASHBOARD_USER_ID: dashboardUserId,
    PORT: port,
    CORS_ORIGINS: origins
  };
}
