# Phases 4–6 Prompt — Devices, MQTT Outbox and Monitoring

This prompt may be split into three sequential tasks if the change set becomes large.

Implement the target modules for device inventory, assignment history, GatewayCommand outbox, legacy MQTT typed adapters, SensorReading, LatestNodeState, scoped monitoring endpoints and authenticated Socket.IO rooms.

Preserve the 3 node type mapping and legacy command contracts while replacing old architecture.

Required tests:

- active assignment unique constraints;
- online/offline command lifecycle;
- reconnect pending command processing;
- MQTT deduplication;
- scoped monitoring queries and room joins;
- all 3 node type parsers.
