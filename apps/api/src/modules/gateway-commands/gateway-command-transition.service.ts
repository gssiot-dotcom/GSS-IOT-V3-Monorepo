import { ConflictException, Injectable } from "@nestjs/common";
import { GatewayCommandStatus } from "@prisma/client";

const validTransitions = new Map<GatewayCommandStatus, GatewayCommandStatus[]>([
  [
    GatewayCommandStatus.PENDING,
    [GatewayCommandStatus.SENT, GatewayCommandStatus.CANCELLED, GatewayCommandStatus.EXPIRED],
  ],
  [
    GatewayCommandStatus.SENT,
    [GatewayCommandStatus.ACKNOWLEDGED, GatewayCommandStatus.FAILED, GatewayCommandStatus.EXPIRED],
  ],
  [
    GatewayCommandStatus.FAILED,
    [GatewayCommandStatus.PENDING, GatewayCommandStatus.EXPIRED, GatewayCommandStatus.CANCELLED],
  ],
  [GatewayCommandStatus.ACKNOWLEDGED, []],
  [GatewayCommandStatus.EXPIRED, []],
  [GatewayCommandStatus.CANCELLED, []],
]);

@Injectable()
export class GatewayCommandTransitionService {
  assertTransition(from: GatewayCommandStatus, to: GatewayCommandStatus): void {
    if (!validTransitions.get(from)?.includes(to)) {
      throw new ConflictException(`Invalid gateway command transition ${from} -> ${to}.`);
    }
  }

  activeKeyFor(status: GatewayCommandStatus, commandId: string): string {
    return status === GatewayCommandStatus.PENDING ||
      status === GatewayCommandStatus.SENT ||
      status === GatewayCommandStatus.FAILED
      ? "active"
      : commandId;
  }
}
