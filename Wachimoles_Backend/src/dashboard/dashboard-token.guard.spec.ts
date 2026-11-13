import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DashboardTokenGuard } from "./dashboard-token.guard";
import { DashboardRequest } from "./dashboard.types";

describe("DashboardTokenGuard", () => {
  const token = "this-is-a-test-dashboard-token-with-32-chars";
  const userId = "46f18439-ff31-4e31-ae49-246d5724f134";
  const config = new ConfigService({
    DASHBOARD_API_TOKEN: token,
    DASHBOARD_USER_ID: userId
  });
  const guard = new DashboardTokenGuard(config);

  function contextWithAuthorization(authorization?: string): ExecutionContext {
    const request = {
      headers: authorization ? { authorization } : {},
      dashboardUserId: ""
    } as DashboardRequest;

    return {
      switchToHttp: () => ({ getRequest: () => request }),
      request
    } as unknown as ExecutionContext;
  }

  it("assigns the configured user after validating the private API token", () => {
    const context = contextWithAuthorization(`Bearer ${token}`);

    expect(guard.canActivate(context)).toBe(true);
    expect(
      (context as ExecutionContext & { request: DashboardRequest }).request
        .dashboardUserId
    ).toBe(userId);
  });

  it("rejects requests without the private API token", () => {
    expect(() => guard.canActivate(contextWithAuthorization())).toThrow(
      UnauthorizedException
    );
  });

  it("rejects an incorrect private API token", () => {
    expect(() =>
      guard.canActivate(contextWithAuthorization("Bearer incorrect-token"))
    ).toThrow(UnauthorizedException);
  });
});
