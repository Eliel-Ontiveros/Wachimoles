import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import { DashboardRequest } from "./dashboard.types";

@Injectable()
export class DashboardTokenGuard implements CanActivate {
  private readonly dashboardApiToken: string;
  private readonly dashboardUserId: string;

  constructor(config: ConfigService) {
    this.dashboardApiToken = config.getOrThrow<string>("DASHBOARD_API_TOKEN");
    this.dashboardUserId = config.getOrThrow<string>("DASHBOARD_USER_ID");
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<DashboardRequest>();
    const authorization = request.headers.authorization;
    const match =
      typeof authorization === "string"
        ? /^Bearer\s+([^\s]+)$/i.exec(authorization)
        : null;

    if (!match) {
      throw new UnauthorizedException("A dashboard API token is required.");
    }

    const providedToken = Buffer.from(match[1]);
    const configuredToken = Buffer.from(this.dashboardApiToken);
    if (
      providedToken.length !== configuredToken.length ||
      !timingSafeEqual(providedToken, configuredToken)
    ) {
      throw new UnauthorizedException("The dashboard API token is invalid.");
    }

    request.dashboardUserId = this.dashboardUserId;
    return true;
  }
}
