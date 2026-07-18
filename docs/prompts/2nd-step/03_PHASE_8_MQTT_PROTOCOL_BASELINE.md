# Phase 8 MQTT protocol baseline for all later phases

This document is a non-negotiable handoff from completed Phase 8. Every Phase 9-14 prompt must preserve these rules unless a later approved architecture decision explicitly replaces them.

## Verified live protocol

The NestJS backend owns MQTT command correlation.

- `requestId` equals the already-persisted `GatewayCommand.id`.
- The backend stores the final outbound payload before publish.
- The ESP32 echoes the same `requestId` without modification.
- `cmd=2`, `cmd=3`, `cmd=4`, and `cmd=5` return `GATE_RES` responses.
- Success uses `resp: "success"`.
- Failure uses `resp: "fail"` and may include `errorCode`, `message`, and legacy `reason`.
- Retries reuse the same command row and the same requestId.
- Numeric node arrays are published as JSON numbers, not strings.

Example request:

```json
{
  "cmd": 4,
  "requestId": "<GatewayCommand.id>",
  "nodeType": 2,
  "alarmEnabled": true,
  "alarmLevel1": 1.0,
  "alarmLevel2": 2.0,
  "alarmLevel3": 4.0
}
```

Example success response:

```json
{
  "cmd": 4,
  "requestId": "<GatewayCommand.id>",
  "resp": "success",
  "nodeType": 2
}
```

## Correlation order

1. Exact `requestId` match.
2. Legacy response without requestId: gateway serial + explicit cmd, only when exactly one eligible active command matches.
3. Very-old shape inference is not a normal path and must never infer success from `resp` alone.

When requestId is present but unknown, malformed, wrong-gateway, or wrong-cmd, the backend must not fall back to another command.

## State and race rules

- `PENDING -> SENT -> ACKNOWLEDGED|FAILED|EXPIRED|CANCELLED` remains the command lifecycle.
- A fast ACK may arrive before the publisher conditionally marks `PENDING -> SENT`; terminal status must never be overwritten back to SENT.
- Positive side effects execute exactly once after strict success.
- Negative, ambiguous, expired, cancelled, or late responses do not apply successful side effects.
- Duplicate responses are idempotent.

## Phase 8 live verification completed

The physical gateway verification records one selected live-test gateway for the run. The selected serial is evidence, not a permanent architecture constant. For the completed live run, the selected gateway was `0300` and the acknowledged command was `160b3e5c-139d-479b-8535-a82f25f95b02`.

The physical gateway was verified to:

- receive the numeric-wire request;
- echo `cmd` and the same `requestId`;
- return `resp: "success"`;
- cause the backend command to become `ACKNOWLEDGED`.

Phase 8 closure requires DB and protected API evidence that the acknowledged `cmd=2` command belongs to the selected gateway, `requestId` equals `GatewayCommand.id`, the ACK payload correlates to the same command, nodes `100`, `101`, and `102` each have exactly one active `NodeGatewayAssignment`, all resulting assignments point to the same selected gateway, every `sourceCommandId` references the acknowledged command, and duplicate processing/audit side effects remain idempotent.

## Later-phase preservation rule

Phase 9 and later work may create cmd=4/cmd=5 commands through the existing outbox, but must not bypass, weaken, duplicate, or replace this correlation and lifecycle architecture.
