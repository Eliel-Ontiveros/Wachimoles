import { IsIn, IsUUID } from "class-validator";
export class AlertAudienceParams {
  @IsIn(["mobile", "monitor"])
  audience!: "mobile" | "monitor";
}
export class AlertParams extends AlertAudienceParams {
  @IsUUID()
  id!: string;
}
