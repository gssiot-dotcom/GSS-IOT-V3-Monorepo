import { Injectable } from "@nestjs/common";
import type {
  CanonicalNodeType,
  MonitoringNodeStateEvent,
  MonitoringNodeStateRecord,
} from "@gss-iot/contracts";
import type { Server } from "socket.io";

import { roomName } from "./monitoring-mappers";

@Injectable()
export class MonitoringRealtimeService {
  private server?: Server;

  attachServer(server: Server): void {
    this.server = server;
  }

  emitNodeState(state: MonitoringNodeStateRecord): void {
    if (!this.server) {
      return;
    }
    const nodeType = state.nodeType.key as CanonicalNodeType;
    const event = {
      buildingId: state.buildingId,
      nodeType,
      state,
    } satisfies MonitoringNodeStateEvent;
    this.server.to(roomName(state.buildingId, nodeType)).emit("monitoring:node-state", event);
  }
}
