import {
  Controller,
  Get,
  Query,
  Req,
  Sse,
  UseGuards
} from "@nestjs/common";
import { interval, Observable, from, of } from "rxjs";
import { catchError, exhaustMap, map, startWith } from "rxjs/operators";
import { DashboardRequest } from "./dashboard.types";
import { SamplesQueryDto } from "./samples-query.dto";
import { DashboardTokenGuard } from "./dashboard-token.guard";
import { SupabaseService } from "./supabase.service";

@Controller("dashboard")
@UseGuards(DashboardTokenGuard)
export class DashboardController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get("samples")
  getSamples(
    @Req() request: DashboardRequest,
    @Query() query: SamplesQueryDto
  ) {
    return this.supabase.getSamples(
      request.dashboardUserId,
      query
    );
  }

  @Sse("samples/stream")
  streamSamples(
    @Req() request: DashboardRequest,
    @Query() query: SamplesQueryDto
  ): Observable<{ type?: string; data: unknown }> {
    return interval(5000).pipe(
      startWith(0),
      exhaustMap(() =>
        from(
          this.supabase.getSamples(
            request.dashboardUserId,
            query
          )
        ).pipe(
          map((samples) => ({
            data: {
              samples,
              updatedAt: new Date().toISOString()
            }
          })),
          catchError((error: unknown) => {
            console.error("Could not refresh the dashboard stream:", error);
            return of({
              type: "error",
              data: { message: "Dashboard data is temporarily unavailable." }
            });
          })
        )
      )
    );
  }
}
