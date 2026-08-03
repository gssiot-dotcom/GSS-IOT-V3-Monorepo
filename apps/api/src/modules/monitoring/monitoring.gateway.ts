import { Inject, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { OnGatewayInit } from "@nestjs/websockets";
import { loadApiEnv } from "@gss-iot/config";
import type {
  MonitoringRealtimeJoinRequest,
  MonitoringRealtimeJoinResponse,
} from "@gss-iot/contracts";
import type { Server, Socket } from "socket.io";

import { AUTH_CONTEXT, type AuthTokenPayload } from "../../common/auth.types";
import { PrismaService } from "../../prisma/prisma.service";
import { AlarmRealtimeService } from "../alarms/alarm-realtime.service";
import { AuthCookieService } from "../auth/auth-cookie.service";
import { roomName } from "./monitoring-mappers";
import { MonitoringRealtimeService } from "./monitoring-realtime.service";
import { MonitoringService } from "./monitoring.service";

function corsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, success?: boolean) => void,
): void {
  const allowed = loadApiEnv().CORS_ALLOWED_ORIGINS;
  if (!origin || allowed.includes(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error("Socket.IO origin is not allowed."));
}

@WebSocketGateway({ cors: { credentials: true, origin: corsOrigin } })
export class MonitoringGateway implements OnGatewayInit {
  @WebSocketServer()
  private server!: Server;

  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(AuthCookieService) private readonly cookies: AuthCookieService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AlarmRealtimeService) private readonly alarmRealtime: AlarmRealtimeService,
    @Inject(MonitoringService) private readonly monitoring: MonitoringService,
    @Inject(MonitoringRealtimeService) private readonly realtime: MonitoringRealtimeService,
  ) {}

  afterInit(): void {
    this.realtime.attachServer(this.server);
    this.alarmRealtime.attachServer(this.server);
  }

  @SubscribeMessage("monitoring:join")
  async joinMonitoringRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: MonitoringRealtimeJoinRequest,
  ): Promise<MonitoringRealtimeJoinResponse> {
    try {
      if (!body?.buildingId || !body.nodeType) {
        return { error: "Invalid monitoring room request.", ok: false };
      }
      const auth = await this.authenticateSocket(client);
      const nodeType = await this.monitoring.assertRealtimeJoin(
        auth,
        body.buildingId,
        body.nodeType,
      );
      const room = roomName(body.buildingId, nodeType);
      await client.join(room);
      return { ok: true, room };
    } catch {
      return { error: "Unauthorized monitoring room.", ok: false };
    }
  }

  @SubscribeMessage("monitoring:leave")
  async leaveMonitoringRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: MonitoringRealtimeJoinRequest,
  ): Promise<MonitoringRealtimeJoinResponse> {
    try {
      if (!body?.buildingId || !body.nodeType) {
        return { error: "Invalid monitoring room request.", ok: false };
      }
      const nodeType = await this.monitoring.assertRealtimeJoin(
        await this.authenticateSocket(client),
        body.buildingId,
        body.nodeType,
      );
      const room = roomName(body.buildingId, nodeType);
      await client.leave(room);
      return { ok: true, room };
    } catch {
      return { error: "Unauthorized monitoring room.", ok: false };
    }
  }

  @SubscribeMessage("notifications:join")
  async joinNotificationsRoom(
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: boolean; room?: string; error?: string }> {
    try {
      return await this.alarmRealtime.joinNotificationRoom(
        client,
        await this.authenticateSocket(client),
      );
    } catch {
      return { error: "Unauthorized notification room.", ok: false };
    }
  }

  private async authenticateSocket(client: Socket): Promise<AuthTokenPayload> {
    const token = this.cookies.accessToken(client.handshake.headers.cookie);
    if (!token) {
      throw new UnauthorizedException("An access cookie is required.");
    }
    const env = loadApiEnv();
    const payload = await this.jwt.verifyAsync<AuthTokenPayload>(token, {
      secret: env.JWT_ACCESS_SECRET,
    });
    if (
      !payload.sub ||
      payload.typ !== "access" ||
      payload.context !== payload.aud ||
      !Object.values(AUTH_CONTEXT).includes(payload.context)
    ) {
      throw new UnauthorizedException("The token context is invalid.");
    }
    const user =
      payload.context === AUTH_CONTEXT.gssAdmin
        ? await this.prisma.gssAdminUser.findUnique({ where: { id: payload.sub } })
        : await this.prisma.companyUser.findUnique({
            include: { company: { select: { deletedAt: true, status: true } } },
            where: { id: payload.sub },
          });
    const companyUserState = user as {
      company?: { deletedAt: Date | null; status: string };
      deletedAt?: Date | null;
    } | null;
    if (
      !user ||
      !user.isActive ||
      user.tokenVersion !== payload.tokenVersion ||
      Boolean(companyUserState?.deletedAt) ||
      Boolean(
        companyUserState?.company &&
        (companyUserState.company.status !== "ACTIVE" || companyUserState.company.deletedAt),
      )
    ) {
      throw new UnauthorizedException("The authenticated user is inactive or revoked.");
    }
    return payload;
  }
}
