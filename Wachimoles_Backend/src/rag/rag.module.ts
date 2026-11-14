import { Module } from "@nestjs/common";
import { DashboardTokenGuard } from "../dashboard/dashboard-token.guard";
import { RagController } from "./rag.controller";
import { RagService } from "./rag.service";

@Module({ controllers: [RagController], providers: [RagService, DashboardTokenGuard] })
export class RagModule {}
