import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";
import { DashboardRequest } from "./dashboard.types";
import { DashboardWebGuard } from "./dashboard-web.guard";

describe("DashboardWebGuard", () => {
  const password = "a-private-dashboard-password";
  const userId = "46f18439-ff31-4e31-ae49-246d5724f134";
  const guard = new DashboardWebGuard(
    new ConfigService({
      DASHBOARD_WEB_PASSWORD: password,
      DASHBOARD_USER_ID: userId
    })
  );

  function contextWithAuthorization(authorization?: string): {
    context: ExecutionContext;
    request: DashboardRequest;
    response: Pick<Response, "setHeader">;
  } {
    const request = {
      headers: authorization ? { authorization } : {},
      dashboardUserId: ""
    } as DashboardRequest;
    const response = { setHeader: jest.fn() };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response
      })
    } as unknown as ExecutionContext;

    return { context, request, response };
  }

  it("assigns the configured user after validating web credentials", () => {
    const authorization = `Basic ${Buffer.from(`dashboard:${password}`).toString("base64")}`;
    const { context, request } = contextWithAuthorization(authorization);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.dashboardUserId).toBe(userId);
  });

  it("rejects missing credentials and requests browser authentication", () => {
    const { context, response } = contextWithAuthorization();

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(response.setHeader).toHaveBeenCalledWith(
      "WWW-Authenticate",
      'Basic realm="WachiMoles Dashboard", charset="UTF-8"'
    );
  });

  it("rejects an incorrect password", () => {
    const authorization = `Basic ${Buffer.from("dashboard:incorrect").toString("base64")}`;

    expect(() =>
      guard.canActivate(contextWithAuthorization(authorization).context)
    ).toThrow(UnauthorizedException);
  });

  it("rejects credentials with a different username", () => {
    const authorization = `Basic ${Buffer.from(`user:${password}`).toString("base64")}`;

    expect(() =>
      guard.canActivate(contextWithAuthorization(authorization).context)
    ).toThrow(UnauthorizedException);
  });
});
