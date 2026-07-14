import { Controller, Get } from "@nestjs/common";
import { HEALTH_STATUS, type HealthResponse } from "@gss-iot/contracts";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      service: "api",
      status: HEALTH_STATUS.ok,
    };
  }
}
