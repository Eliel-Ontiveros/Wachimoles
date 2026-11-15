import { ConfigService } from "@nestjs/config";
import { INestApplication, Module, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AlertsController } from "./alerts.controller";
import { AlertsGuard } from "./alerts.guard";
import { DashboardTokenGuard } from "../dashboard/dashboard-token.guard";
import { DashboardWebGuard } from "../dashboard/dashboard-web.guard";
import { SupabaseService } from "../dashboard/supabase.service";
const USER = "11111111-1111-4111-8111-111111111111";
const ID = "33333333-3333-4333-8333-333333333333";
const fake = { getHealthAlerts: jest.fn().mockResolvedValue([]), acknowledgeHealthAlert: jest.fn().mockResolvedValue({ acknowledged: true }) };
@Module({
  controllers: [AlertsController], providers: [AlertsGuard, DashboardTokenGuard, DashboardWebGuard,
    { provide: SupabaseService, useValue: fake },
    { provide: ConfigService, useValue: new ConfigService({ DASHBOARD_API_TOKEN: "test-token", DASHBOARD_WEB_PASSWORD: "test-pass", DASHBOARD_USER_ID: USER }) }]
}) class AlertsTestModule {}

describe("Health alerts HTTP", () => {
  let app: INestApplication; let base: string;
  beforeAll(async () => {
    app = await NestFactory.create(AlertsTestModule, {logger:false});
    app.useGlobalPipes(new ValidationPipe({transform:true, whitelist:true, forbidNonWhitelisted:true}));
    await app.listen(0,"127.0.0.1"); base = `${await app.getUrl()}/dashboard/alerts`;
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => jest.clearAllMocks());
  it("requires authentication", async () => {
    expect((await fetch(`${base}/mobile`)).status).toBe(401);
    expect((await fetch(`${base}/monitor/${ID}/acknowledge`,{method:"POST"})).status).toBe(401);
    expect(fake.getHealthAlerts).not.toHaveBeenCalled();
  });
  it("scopes Bearer mobile access to the server subject and disables caching", async () => {
    const res = await fetch(`${base}/mobile?userId=another-user`,{headers:{Authorization:"Bearer test-token"}});
    expect(res.status).toBe(200); expect(res.headers.get("cache-control")).toBe("no-store");
    expect(fake.getHealthAlerts).toHaveBeenCalledWith(USER,"mobile");
  });
  it("accepts existing Basic web credentials", async () => {
    const res = await fetch(`${base}/monitor`,{headers:{Authorization:`Basic ${Buffer.from("dashboard:test-pass").toString("base64")}`}});
    expect(res.status).toBe(200); expect(fake.getHealthAlerts).toHaveBeenCalledWith(USER,"monitor");
  });
  it("validates audience and IDs before mutation", async () => {
    for (const path of ["invalid", "mobile/not-a-uuid/acknowledge"]) {
      const res = await fetch(`${base}/${path}`,{method:path.includes("acknowledge")?"POST":"GET",headers:{Authorization:"Bearer test-token"}});
      expect(res.status).toBe(400);
    }
    expect(fake.acknowledgeHealthAlert).not.toHaveBeenCalled();
  });
  it("acknowledges only the requested audience on the configured astronaut", async () => {
    const res=await fetch(`${base}/monitor/${ID}/acknowledge`,{method:"POST",headers:{Authorization:"Bearer test-token"}});
    expect(res.status).toBe(201); expect(await res.json()).toEqual({acknowledged:true});
    expect(fake.acknowledgeHealthAlert).toHaveBeenCalledWith(USER,"monitor",ID);
  });
});

describe("Health alerts storage", () => {
  const service = new SupabaseService(new ConfigService({SUPABASE_URL:"https://example.supabase.co",SUPABASE_SERVICE_ROLE_KEY:"server-secret"}));
  afterEach(() => jest.restoreAllMocks());
  it("selects subject-scoped data and the audience-specific read state", async () => {
    const mock=jest.spyOn(global,"fetch").mockResolvedValue(new Response("[]"));
    await service.getHealthAlerts(USER,"monitor");
    const url = new URL(String(mock.mock.calls[0][0]));
    expect(url.searchParams.get("user_id")).toBe(`eq.${USER}`);
    expect(url.searchParams.get("select")).toContain("monitor_acknowledged_at");
    expect(url.searchParams.get("select")).not.toContain("mobile_acknowledged_at");
    expect(url.searchParams.get("order")).toContain("nullsfirst");
  });
  it("does not overwrite the monitor read state when mobile reads", async () => {
    const mock=jest.spyOn(global,"fetch").mockResolvedValue(new Response(JSON.stringify([{id:ID}])));
    await service.acknowledgeHealthAlert(USER,"mobile",ID);
    const url=new URL(String(mock.mock.calls[0][0]));
    expect(url.searchParams.get("user_id")).toBe(`eq.${USER}`);
    expect(url.searchParams.get("id")).toBe(`eq.${ID}`);
    expect(url.searchParams.get("mobile_acknowledged_at")).toBe("is.null");
    const body=JSON.parse(mock.mock.calls[0][1]?.body as string);
    expect(Object.keys(body)).toEqual(["mobile_acknowledged_at"]);
  });
  it("makes repeated acknowledgement idempotent and rejects missing/foreign alerts", async () => {
    const mock=jest.spyOn(global,"fetch").mockImplementation(async (_url,init) => new Response(init?.method === "PATCH" ? "[]" : JSON.stringify([{id:ID}])));
    await expect(service.acknowledgeHealthAlert(USER,"monitor",ID)).resolves.toEqual({acknowledged:true});
    mock.mockImplementation(async () => new Response("[]"));
    await expect(service.acknowledgeHealthAlert(USER,"monitor",ID)).rejects.toMatchObject({status:404});
  });
  it.each(["PGRST205", "42P01"])("reports missing alert schema explicitly (%s)", async code => {
    jest.spyOn(global, "fetch").mockImplementation(async () => new Response(JSON.stringify({
      code, message: "Missing health_alerts table"
    }), { status: 404 }));
    await expect(service.getHealthAlerts(USER, "monitor")).rejects.toMatchObject({
      status: 503, response: { code: "HEALTH_ALERTS_NOT_READY", message: "Health alerts are not configured on the server." }
    });
  });
  it("does not expose rows belonging to a different astronaut", async () => {
    jest.spyOn(global,"fetch").mockResolvedValue(new Response(JSON.stringify([{id:ID,user_id:"other"}])));
    await expect(service.getHealthAlerts(USER,"mobile")).rejects.toMatchObject({status:503});
  });
});
