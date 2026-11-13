import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { DashboardRequest } from "./dashboard.types";

function matches(expected: string, provided: Buffer): boolean {
  const expectedBuffer = Buffer.from(expected);
  return (
    provided.length === expectedBuffer.length &&
    timingSafeEqual(provided, expectedBuffer)
  );
}

@Injectable()
export class DashboardWebGuard implements CanActivate {
  private readonly dashboardWebPassword: string;
  private readonly dashboardUserId: string;

  constructor(config: ConfigService) {
    this.dashboardWebPassword =
      config.getOrThrow<string>("DASHBOARD_WEB_PASSWORD");
    this.dashboardUserId = config.getOrThrow<string>("DASHBOARD_USER_ID");
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<DashboardRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const authorization = request.headers.authorization;
    const match =
      typeof authorization === "string" && authorization.length <= 4096
        ? /^Basic\s+([A-Za-z0-9+/]+={0,2})$/i.exec(authorization)
        : null;

    if (match) {
      const credentials = Buffer.from(match[1], "base64");
      const separator = credentials.indexOf(0x3a);
      if (
        separator !== -1 &&
        credentials.toString("base64") === match[1]
      ) {
        const usernameMatches = matches(
          "dashboard",
          credentials.subarray(0, separator)
        );
        const passwordMatches = matches(
          this.dashboardWebPassword,
          credentials.subarray(separator + 1)
        );

        if (usernameMatches && passwordMatches) {
          request.dashboardUserId = this.dashboardUserId;
          return true;
        }
      }
    }

    response.setHeader(
      "WWW-Authenticate",
      'Basic realm="WachiMoles Dashboard", charset="UTF-8"'
    );
    throw new UnauthorizedException("Dashboard credentials are required.");
  }
}
