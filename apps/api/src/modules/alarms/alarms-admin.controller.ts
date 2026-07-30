import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  ValidationPipe,
} from "@nestjs/common";

import type { AuthenticatedRequest } from "../../common/auth.types";
import { AdminEndpoint } from "../../common/decorators/admin-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { AlarmsService } from "./alarms.service";
import {
  AlarmActionNoteDto,
  BulkArchiveDto,
  CreateAlarmRecipientPolicyDto,
  CreateAlarmRuleDto,
  ListAlarmsQueryDto,
  ListAlarmRulesQueryDto,
  UpdateAlarmRecipientPolicyDto,
  UpdateAlarmRuleDto,
  UpdateAlarmLifecycleStatusDto,
} from "./dto/alarms.dto";

@AdminEndpoint()
@Controller("admin")
export class AlarmsAdminController {
  constructor(@Inject(AlarmsService) private readonly alarms: AlarmsService) {}

  @RequirePermissions("alarm-rules.view")
  @Get("alarm-rules")
  listRules(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Query(new ValidationPipe({ expectedType: ListAlarmRulesQueryDto, transform: true }))
    query: ListAlarmRulesQueryDto,
  ) {
    return this.alarms.listRules(auth!.principal, query);
  }

  @RequirePermissions("alarm-rules.view")
  @Get("alarm-rules/options")
  getRuleOptions(@CurrentPrincipal() auth: AuthenticatedRequest["auth"]) {
    return this.alarms.getRuleOptions(auth!.principal);
  }

  @RequirePermissions("alarm-rules.view")
  @Get("alarm-rules/:ruleId")
  getRule(@CurrentPrincipal() auth: AuthenticatedRequest["auth"], @Param("ruleId") ruleId: string) {
    return this.alarms.getRule(auth!.principal, ruleId);
  }

  @RequirePermissions("alarm-rules.manage")
  @Post("alarm-rules")
  createRule(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: CreateAlarmRuleDto, transform: true }))
    dto: CreateAlarmRuleDto,
  ) {
    return this.alarms.createRule(auth!.principal, dto);
  }

  @RequirePermissions("alarm-rules.manage")
  @Patch("alarm-rules/:ruleId")
  updateRule(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("ruleId") ruleId: string,
    @Body(new ValidationPipe({ expectedType: UpdateAlarmRuleDto, transform: true }))
    dto: UpdateAlarmRuleDto,
  ) {
    return this.alarms.updateRule(auth!.principal, ruleId, dto);
  }

  @RequirePermissions("alarm-rules.manage")
  @Delete("alarm-rules/:ruleId")
  disableRule(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("ruleId") ruleId: string,
  ) {
    return this.alarms.archiveRule(auth!.principal, ruleId);
  }

  @RequirePermissions("alarm-rules.manage")
  @Patch("alarm-rules/:ruleId/status")
  updateRuleStatus(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("ruleId") ruleId: string,
    @Body(new ValidationPipe({ expectedType: UpdateAlarmLifecycleStatusDto, transform: true }))
    dto: UpdateAlarmLifecycleStatusDto,
  ) {
    return this.alarms.updateRuleStatus(auth!.principal, ruleId, dto.isActive);
  }

  @RequirePermissions("alarm-rules.view")
  @Get("alarm-rules/:ruleId/policies")
  listPolicies(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("ruleId") ruleId: string,
    @Query(new ValidationPipe({ expectedType: PaginationQueryDto, transform: true }))
    query: PaginationQueryDto,
  ) {
    return this.alarms.listPolicies(auth!.principal, ruleId, query);
  }

  @RequirePermissions("alarm-rules.manage")
  @Post("alarm-rules/:ruleId/policies")
  createPolicy(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("ruleId") ruleId: string,
    @Body(new ValidationPipe({ expectedType: CreateAlarmRecipientPolicyDto, transform: true }))
    dto: CreateAlarmRecipientPolicyDto,
  ) {
    return this.alarms.createPolicy(auth!.principal, ruleId, dto);
  }

  @RequirePermissions("alarm-rules.manage")
  @Patch("alarm-policies/:policyId")
  updatePolicy(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("policyId") policyId: string,
    @Body(new ValidationPipe({ expectedType: UpdateAlarmRecipientPolicyDto, transform: true }))
    dto: UpdateAlarmRecipientPolicyDto,
  ) {
    return this.alarms.updatePolicy(auth!.principal, policyId, dto);
  }

  @RequirePermissions("alarm-rules.manage")
  @Delete("alarm-policies/:policyId")
  disablePolicy(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("policyId") policyId: string,
  ) {
    return this.alarms.archivePolicy(auth!.principal, policyId);
  }

  @RequirePermissions("alarm-rules.manage")
  @Patch("alarm-policies/:policyId/status")
  updatePolicyStatus(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("policyId") policyId: string,
    @Body(new ValidationPipe({ expectedType: UpdateAlarmLifecycleStatusDto, transform: true }))
    dto: UpdateAlarmLifecycleStatusDto,
  ) {
    return this.alarms.updatePolicyStatus(auth!.principal, policyId, dto.isActive);
  }

  @RequirePermissions("alarms.view")
  @Get("alarms/counters")
  listCounters(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Query(new ValidationPipe({ expectedType: ListAlarmRulesQueryDto, transform: true }))
    query: ListAlarmRulesQueryDto,
  ) {
    return this.alarms.listCounters(auth!.principal, query);
  }

  @RequirePermissions("alarms.view")
  @Get("alarms/events")
  listEvents(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Query(new ValidationPipe({ expectedType: ListAlarmRulesQueryDto, transform: true }))
    query: ListAlarmRulesQueryDto,
  ) {
    return this.alarms.listEvents(auth!.principal, query);
  }

  @RequirePermissions("alarms.view")
  @Get("alarms/triggers")
  listTriggers(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Query(new ValidationPipe({ expectedType: ListAlarmRulesQueryDto, transform: true }))
    query: ListAlarmRulesQueryDto,
  ) {
    return this.alarms.listTriggers(auth!.principal, query);
  }

  @RequirePermissions("alarms.view")
  @Get("alarms")
  listAlarms(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Query(new ValidationPipe({ expectedType: ListAlarmsQueryDto, transform: true }))
    query: ListAlarmsQueryDto,
  ) {
    return this.alarms.listAlarms(auth!.principal, query);
  }

  @RequirePermissions("alarms.manage")
  @Post("alarms/bulk-archive")
  bulkArchiveAlarms(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: BulkArchiveDto, transform: true }))
    dto: BulkArchiveDto,
  ) {
    return this.alarms.bulkArchiveAlarmEvents(auth!.principal, dto.ids);
  }

  @RequirePermissions("alarms.view")
  @Get("alarms/:alarmId")
  getAlarm(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("alarmId") alarmId: string,
  ) {
    return this.alarms.getAlarm(auth!.principal, alarmId);
  }

  @RequirePermissions("alarms.acknowledge")
  @Patch("alarms/:alarmId/acknowledge")
  acknowledgeAlarm(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("alarmId") alarmId: string,
    @Body(new ValidationPipe({ expectedType: AlarmActionNoteDto, transform: true }))
    dto: AlarmActionNoteDto,
  ) {
    return this.alarms.acknowledgeAlarm(auth!.principal, alarmId, dto.note);
  }

  @RequirePermissions("alarms.resolve")
  @Patch("alarms/:alarmId/resolve")
  resolveAlarm(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("alarmId") alarmId: string,
    @Body(new ValidationPipe({ expectedType: AlarmActionNoteDto, transform: true }))
    dto: AlarmActionNoteDto,
  ) {
    return this.alarms.resolveAlarm(auth!.principal, alarmId, dto.note);
  }

  @RequirePermissions("alarms.view")
  @Get("alarms/:alarmId/triggers")
  listAlarmTriggers(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("alarmId") alarmId: string,
  ) {
    return this.alarms.listAlarmTriggers(auth!.principal, alarmId);
  }

  @RequirePermissions("alarms.view")
  @Get("alarms/:alarmId/notifications")
  listAlarmNotifications(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("alarmId") alarmId: string,
  ) {
    return this.alarms.listAlarmNotifications(auth!.principal, alarmId);
  }

  @RequirePermissions("notifications.view")
  @Get("notifications")
  listNotifications(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Query(new ValidationPipe({ expectedType: PaginationQueryDto, transform: true }))
    query: PaginationQueryDto,
  ) {
    return this.alarms.listNotifications(auth!.principal, query);
  }

  @RequirePermissions("notifications.view")
  @Get("notifications/unread-count")
  unreadNotificationCount(@CurrentPrincipal() auth: AuthenticatedRequest["auth"]) {
    return this.alarms.unreadNotificationCount(auth!.principal);
  }

  @RequirePermissions("notifications.view")
  @Patch("notifications/read-all")
  markAllNotificationsRead(@CurrentPrincipal() auth: AuthenticatedRequest["auth"]) {
    return this.alarms.markAllNotificationsRead(auth!.principal);
  }

  @RequirePermissions("notifications.view")
  @Post("notifications/bulk-archive")
  bulkArchiveNotifications(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: BulkArchiveDto, transform: true }))
    dto: BulkArchiveDto,
  ) {
    return this.alarms.bulkArchiveNotifications(auth!.principal, dto.ids);
  }

  @RequirePermissions("notifications.view")
  @Patch("notifications/:notificationId/read")
  markNotificationRead(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("notificationId") notificationId: string,
  ) {
    return this.alarms.markNotificationRead(auth!.principal, notificationId);
  }

  @RequirePermissions("alarms.manage")
  @Delete("alarms/:alarmId")
  archiveAlarm(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("alarmId") alarmId: string,
  ) {
    return this.alarms.archiveAlarmEvent(auth!.principal, alarmId);
  }

  @RequirePermissions("notifications.view")
  @Delete("notifications/:notificationId")
  archiveNotification(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("notificationId") notificationId: string,
  ) {
    return this.alarms.archiveNotification(auth!.principal, notificationId);
  }

  @RequirePermissions("notifications.manage")
  @Get("notifications/providers/status")
  providersStatus(@CurrentPrincipal() auth: AuthenticatedRequest["auth"]) {
    return this.alarms.providersStatus(auth!.principal);
  }
}
