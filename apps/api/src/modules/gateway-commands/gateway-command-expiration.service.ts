import { Inject, Injectable } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { GatewayCommandsService } from "./gateway-commands.service";

@Injectable()
export class GatewayCommandExpirationService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(@Inject(GatewayCommandsService) private readonly commands: GatewayCommandsService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.commands.expireOverdueCommands();
    }, 30_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  expireNow() {
    return this.commands.expireOverdueCommands();
  }
}
