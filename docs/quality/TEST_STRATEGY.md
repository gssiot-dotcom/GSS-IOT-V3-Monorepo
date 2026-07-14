# GSS IoT V3 — Test Strategy

## Test pyramid

### Unit

- permission resolver;
- scope decision services;
- MQTT payload parser;
- severity classification;
- alarm counter transition function;
- command status transitions;
- report filter builder.

### Integration

- Prisma repositories and constraints;
- auth guards with database state;
- assignment transactions;
- alarm counter row locking/idempotency;
- outbox publish/ack lifecycle;
- notification recipient resolution.

### E2E API

- GSS setup flow;
- company scoped CRUD;
- device assignment;
- monitoring endpoints;
- alarm configuration and lifecycle;
- report creation/export authorization.

### WebSocket

- authenticated scoped join;
- unauthorized join rejection;
- realtime node update;
- alarm badge update;
- reconnect and duplicate event behavior.

### Frontend component

- RequirePermission/Can;
- sidebars;
- forms and validation;
- node-type cards;
- alarm policy matrix;
- loading/empty/error/forbidden states.

### Browser E2E

- super admin setup;
- company manager setup;
- building monitoring selection;
- no-permission navigation;
- cross-scope route attempt;
- alarm acknowledge/resolve.

## Quality commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter api test:e2e
pnpm --filter web test:e2e
```

## Test data

Use deterministic factories for:

- multiple companies;
- sites/buildings;
- platform/site/building scoped users;
- company positions;
- all three node types;
- online/offline gateways;
- caution/warning/danger readings;
- duplicate sequence numbers;
- pending/failed/ack commands.

## Performance focus

- SensorReading sustained insert rate.
- LatestNodeState upsert.
- AlarmCounterState transaction contention.
- Socket fan-out per building/node type.
- Large report job memory and duration.
