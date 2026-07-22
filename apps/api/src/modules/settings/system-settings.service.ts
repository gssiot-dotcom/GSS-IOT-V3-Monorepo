import { Inject, Injectable } from "@nestjs/common";
import { loadApiEnv } from "@gss-iot/config";

import { MqttClientService } from "../mqtt/mqtt-client.service";
import { ReportStorageService } from "../reports/report-storage.service";

@Injectable()
export class SystemSettingsService {
  private readonly env = loadApiEnv();

  constructor(
    @Inject(MqttClientService) private readonly mqtt: MqttClientService,
    @Inject(ReportStorageService) private readonly reportStorage: ReportStorageService,
  ) {}

  getReadModel() {
    const mqttStatus = this.mqtt.getStatus();
    return {
      application: {
        apiVersion: process.env.npm_package_version ?? "0.0.0",
        environment: this.env.NODE_ENV,
        name: "GSS IoT V3",
      },
      commands: {
        ackTimeoutMs: this.env.MQTT_COMMAND_ACK_TIMEOUT_MS,
        expiresInSeconds: this.env.MQTT_COMMAND_EXPIRES_IN_SECONDS,
        maxPublishAttempts: this.env.MQTT_MAX_PUBLISH_ATTEMPTS,
      },
      features: {
        reportCleanupEnabled: this.env.REPORT_CLEANUP_ENABLED,
      },
      mqtt: {
        connected: mqttStatus.connected,
        enabled: mqttStatus.enabled,
        ready: !mqttStatus.enabled || mqttStatus.connected,
        subscribedFilterCount: mqttStatus.subscribedTopicFilters.length,
      },
      reports: {
        storage: { provider: this.reportStorage.providerName, ready: true },
        worker: {
          enabled: this.env.REPORT_WORKER_ENABLED,
          mode: "internal-polling",
          ready: true,
        },
      },
      sensorHistory: { retentionDays: 180 },
      controls: { readOnly: true, productionDeploymentControls: "phase-14" },
    };
  }
}
