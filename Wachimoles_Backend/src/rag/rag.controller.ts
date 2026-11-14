import { Body, Controller, Get, Header, HttpCode, Post, UseGuards } from "@nestjs/common";
import { DashboardTokenGuard } from "../dashboard/dashboard-token.guard";
import { AskRagDto } from "./rag.dto";
import { RagService } from "./rag.service";

@Controller("dashboard/assistant")
@UseGuards(DashboardTokenGuard)
export class RagController {
  constructor(private readonly rag: RagService) {}

  @Get("status")
  @Header("Cache-Control", "no-store")
  status() { return this.rag.status(); }

  @Post("ask")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  ask(@Body() body: AskRagDto) { return this.rag.ask(body); }
}
