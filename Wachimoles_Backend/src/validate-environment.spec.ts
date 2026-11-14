import { validateEnvironment } from "./validate-environment";

describe("validateEnvironment", () => {
  const validEnvironment = {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "server-secret",
    DASHBOARD_API_TOKEN: "a-dashboard-api-token-with-at-least-32-characters",
    DASHBOARD_WEB_PASSWORD: "a-private-web-password",
    DASHBOARD_USER_ID: "46f18439-ff31-4e31-ae49-246d5724f134",
    PORT: "3000"
  };

  it("accepts a configured dashboard web password", () => {
    expect(
      validateEnvironment(validEnvironment).DASHBOARD_WEB_PASSWORD
    ).toBe(validEnvironment.DASHBOARD_WEB_PASSWORD);
  });

  it("rejects a dashboard web password shorter than 16 characters", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        DASHBOARD_WEB_PASSWORD: "too-short"
      })
    ).toThrow("DASHBOARD_WEB_PASSWORD must contain between 16 and 256 characters.");
  });

  it("accepts a Storage bucket ID and defaults it to empty when unset", () => {
    expect(
      validateEnvironment({
        ...validEnvironment,
        SUPABASE_STORAGE_BUCKET: "Wachimoles Images"
      }).SUPABASE_STORAGE_BUCKET
    ).toBe("Wachimoles Images");
    expect(
      validateEnvironment(validEnvironment).SUPABASE_STORAGE_BUCKET
    ).toBe("");
  });

  it("rejects Storage bucket IDs containing path separators", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        SUPABASE_STORAGE_BUCKET: "bucket/path"
      })
    ).toThrow("SUPABASE_STORAGE_BUCKET must be a bucket ID");
  });
});
