# Alarm Occurrence Flow

## Terms

```txt
회수 = requiredOccurrenceCount
지속시간 = countIntervalSeconds
```

`countIntervalSeconds` is the minimum interval before another matching reading can increment a policy counter. It is not a send delay.

## Algorithm

For every unique reading:

1. Resolve gateway/node and active company/site/building assignment.
2. Apply fault filter.
3. Insert SensorReading and upsert LatestNodeState.
4. Classify exactly one severity: safe/caution/warning/danger.
5. Safe or severity transition resets relevant states.
6. For each matching recipient policy, lock/read `(policyId,nodeId)` counter state.
7. First matching reading starts count 1.
8. Later reading increments only when `receivedAt >= nextCountAt`.
9. Earlier reading remains in history but does not increment.
10. When required count is reached, create/find AlarmEvent, resolve recipients by position/specific user + scope, create notifications and delivery logs.
11. Complete cycle; next eligible matching reading begins a new cycle at count 1.

## Example

```txt
count=3, interval=3 minutes
12:00 danger → 1, next 12:03
12:01 danger → history only
12:03 danger → 2, next 12:06
12:05 danger → history only
12:08 danger → 3, trigger
12:11 danger → new cycle count 1
```

## Storage

- SensorReading: append per unique reading.
- LatestNodeState: one row per node.
- AlarmCounterState: one mutable row per node-policy.
- AlarmEvent: confirmed operational event/evidence.
- AlarmNotification: recipient/channel trigger.
- AlarmDeliveryLog: provider attempts/results.

Use transaction locking or optimistic versioning and MQTT sequence/message deduplication.
