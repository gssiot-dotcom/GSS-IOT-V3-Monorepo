import { Inject, Injectable } from "@nestjs/common";
import type { Socket } from "socket.io";
import type { Server } from "socket.io";

import { AUTH_CONTEXT, type AuthTokenPayload } from "../../common/auth.types";
import { PermissionResolverService } from "../rbac/permission-resolver.service";

export interface AlarmRealtimeEvent {
  alarmEventId?: string;
  notificationId?: string;
  unreadCount?: number;
}

@Injectable()
export class AlarmRealtimeService {
  private server?: Server;

  constructor(
    @Inject(PermissionResolverService) private readonly permissions: PermissionResolverService,
  ) {}

  attachServer(server: Server): void {
    this.server = server;
  }

  async joinNotificationRoom(
    client: Socket,
    auth: AuthTokenPayload,
  ): Promise<{ ok: boolean; room?: string; error?: string }> {
    const allowed = await this.permissions.hasPermission(
      auth.context,
      auth.sub,
      "notifications.view",
    );
    if (!allowed) {
      return { error: "Unauthorized notification room.", ok: false };
    }
    const room = this.identityRoom(auth);
    await client.join(room);
    return { ok: true, room };
  }

  emitToCompanyUser(userId: string, event: string, payload: AlarmRealtimeEvent): void {
    this.server?.to(`company-user:${userId}`).emit(event, payload);
  }

  emitToPrincipal(auth: AuthTokenPayload, event: string, payload: AlarmRealtimeEvent): void {
    this.server?.to(this.identityRoom(auth)).emit(event, payload);
  }

  private identityRoom(auth: AuthTokenPayload): string {
    return auth.context === AUTH_CONTEXT.gssAdmin
      ? `gss-admin:${auth.sub}`
      : `company-user:${auth.sub}`;
  }
}
