import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { DashboardTokenGuard } from "../dashboard/dashboard-token.guard";
import { DashboardWebGuard } from "../dashboard/dashboard-web.guard";
import { DashboardRequest } from "../dashboard/dashboard.types";

@Injectable()
export class AlertsGuard implements CanActivate {
  constructor(private readonly token: DashboardTokenGuard, private readonly web: DashboardWebGuard) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<DashboardRequest>();
    return /^Bearer\s/i.test(request.headers.authorization ?? "")
      ? this.token.canActivate(context) : this.web.canActivate(context);
  }
}
