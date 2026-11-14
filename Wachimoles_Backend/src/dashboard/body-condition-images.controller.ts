import {
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  BODY_CONDITION_IMAGE_MAX_SIZE_BYTES,
  BodyConditionImage,
  DashboardRequest,
  UploadedBodyConditionImage
} from "./dashboard.types";
import {
  BodyConditionImageParamsDto,
  BodyConditionParamsDto
} from "./body-conditions.dto";
import { DashboardTokenGuard } from "./dashboard-token.guard";
import { SupabaseService } from "./supabase.service";

@Controller("dashboard/body-conditions")
@UseGuards(DashboardTokenGuard)
export class BodyConditionImagesController {
  constructor(private readonly supabase: SupabaseService) {}

  @Post(":muscleId/images")
  @Header("Cache-Control", "no-store")
  @UseInterceptors(
    FileInterceptor("image", {
      limits: {
        fileSize: BODY_CONDITION_IMAGE_MAX_SIZE_BYTES,
        files: 1,
        fields: 0,
        parts: 1
      }
    })
  )
  uploadImage(
    @Req() request: DashboardRequest,
    @Param() params: BodyConditionParamsDto,
    @UploadedFile() file: UploadedBodyConditionImage | undefined
  ): Promise<BodyConditionImage> {
    return this.supabase.uploadBodyConditionImage(
      request.dashboardUserId,
      params.muscleId,
      file
    );
  }

  @Get(":muscleId/images")
  @Header("Cache-Control", "no-store")
  getImages(
    @Req() request: DashboardRequest,
    @Param() params: BodyConditionParamsDto
  ): Promise<BodyConditionImage[]> {
    return this.supabase.getBodyConditionImages(
      request.dashboardUserId,
      params.muscleId
    );
  }

  @Delete(":muscleId/images/:fileName")
  @Header("Cache-Control", "no-store")
  deleteImage(
    @Req() request: DashboardRequest,
    @Param() params: BodyConditionImageParamsDto
  ): Promise<{ deleted: true }> {
    return this.supabase.deleteBodyConditionImage(
      request.dashboardUserId,
      params.muscleId,
      params.fileName
    );
  }
}
