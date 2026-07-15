import { Inject, Injectable } from "@nestjs/common";

import type { AuthTokenPayload } from "../../common/auth.types";
import { GatewayCommandPublisherService } from "./gateway-command-publisher.service";
import { GatewayCommandsService } from "./gateway-commands.service";

@Injectable()
export class GatewayCommandRetryService {
  constructor(
    @Inject(GatewayCommandsService) private readonly commands: GatewayCommandsService,
    @Inject(GatewayCommandPublisherService)
    private readonly publisher: GatewayCommandPublisherService,
  ) {}

  async retry(actor: AuthTokenPayload, commandId: string) {
    const retried = await this.commands.retryCommand(actor, commandId);
    return this.publisher.publishPending(retried.id);
  }
}
