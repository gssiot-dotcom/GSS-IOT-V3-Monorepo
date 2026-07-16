# Legacy GSS vs GSS IoT V3 feature gap matrix

## Authority order

1. Current repository `AGENTS.md` va decision log.
2. Latest approved occurrence-count blueprint.
3. New V3 architecture and RBAC requirements.
4. Current V3 code.
5. Old repository business behavior.

Old code architecture ko'chirilmaydi. Faqat ishlashi kerak bo'lgan business behavior ajratib olinadi.

| Legacy behavior | Old project | V3 current | Target decision |
|---|---|---|---|
| Company create | Admin creates company | Backend + basic UI | Keep, complete detail/edit/deactivate and manager workflow |
| Company buildings | Direct Company -> Building | New Company -> Site -> Building | Keep business capability with new hierarchy |
| Gateway inventory | Create/list/assign | Backend + basic UI | Keep, improve lifecycle and selectors |
| Node inventory | 3 types | Backend + basic UI | Keep canonical door/angle/gangform |
| Gateway -> Company | Inline assignment | History table | New history architecture is correct |
| Gateway -> Building | Inline assignment | History table | New architecture correct; complete UI |
| Node -> Gateway | MQTT cmd 2, wait response, then DB update | DB assignment and MQTT command separate | Must integrate with outbox and ACK |
| Offline command | Weak/no durable outbox | GatewayCommand durable outbox | New architecture is better |
| MQTT response | Waits response by gateway/cmd | Persistent ACK handler | Keep persistent design, strict parser needed |
| Door telemetry | GATE_PUB history/latest | Unified SensorReading/Latest | New architecture is correct |
| Angle telemetry | GATE_ANG history + threshold status | Unified history/latest, payload status | Add backend threshold classification |
| Gangform telemetry | GATE_FORM history + threshold status | Unified history/latest | Add backend threshold classification |
| Realtime | Socket.IO | Scoped building/node-type rooms | New architecture is better |
| Alarm levels | Building-level thresholds + cmd 4 to gateways | Low-level cmd 4 only | Add domain model, desired/applied state, UI |
| Fault filters | Gateway settings + cmd 5 | Low-level cmd 5 only | Add persisted configuration and UI |
| Alarm occurrence logic | No approved count model | Not implemented | Implement latest count/interval blueprint, not old delay-only behavior |
| Alerts | Basic alert log | Not implemented | Implement AlarmEvent lifecycle + notifications |
| Company manager | Hardcoded manager | RBAC + scope | New architecture is better; finish management UI |
| Worker | Hardcoded worker/building assignment | building_manager/viewer roles + scope | Use new roles/scopes |
| Role permissions | No real RBAC | Backend RBAC | Finish frontend role permission editor |
| Building plan locations | Existing plan/node location behavior | Partial metadata | Business decision, likely restore in Phase 13 |
| Angle calibration | Existing calibration behavior | Missing | Business decision before Phase 13 |
| Weather | Existing module | Missing | Optional legacy parity; only implement if business still needs it |
| Reports | CSV/HWPX and sensor reports | Missing | Rebuild scoped async reports, do not copy mixed services |
| Asset upload | S3 presigned/files | Partial | Rebuild clean storage abstraction |
| Dashboard stats | Admin/manager/worker stats | Placeholders | Rebuild by GSS/company scope |

## Features intentionally not copied as-is

- Hardcoded admin/manager/worker authorization.
- Mongo inline assignment fields as source of truth.
- Route groups without consistent guards.
- Mixed duplicate services/routes.
- In-memory MQTT wait as only command state.
- Frontend role-only routing.
- Old naming inconsistencies (`vertical`, `gangform`, mixed snake/camel fields).
