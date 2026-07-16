# GSS IoT V3 - Phase 6 current implementation audit

## Audit turi

Bu static repository audit. Repositorydagi code, Prisma schema, migrationlar, tests va docs tekshirildi. Audit muhitida pnpm package manager va internet registry mavjud bo'lmagani sabab testlar qayta ishga tushirilmadi. Repositorydagi mavjud test files va recorded verification natijalari tekshirildi.

## Status legend

- COMPLETE: backend + UI + permission/scope + tests business flow bo'yicha mavjud.
- PARTIAL: asosiy qism bor, lekin product flow yoki UI/test yetishmaydi.
- MISSING: talab qilinadigan feature yo'q yoki faqat placeholder.
- DECISION: business owner qarori kerak.

## Main feature matrix

| Feature | Status | Audit xulosasi |
|---|---|---|
| GSS login/RBAC/super admin | COMPLETE backend, PARTIAL frontend | Guards, permission resolver, inactive user va super-admin tests bor. Session persistence yo'q. |
| Company list/create | PARTIAL | Backend transaction, role templates va platform manager yaratadi. UI list/create bor. Detail route yo'q. |
| Company Open | BROKEN | UI `/admin/companies/:id`ga navigate qiladi, routerda route yo'q, wildcard `/login`ga yuboradi. |
| Company detail/update/deactivate | MISSING UI | Backend get/update/deactivate bor, frontend page/route yo'q. |
| Admin site/building/user management | PARTIAL | Backend mavjud, admin company detail tabs va pages yo'q. |
| Gateway list/create/update | PARTIAL | Backend to'liqroq, UI list/create basic. Update/lifecycle UX yo'q. |
| Node list/create/update | PARTIAL | Backend to'liqroq, UI list/create basic. Update/lifecycle UX yo'q. |
| Gateway -> Company assignment | PARTIAL | Backend history/audit bor. UI raw company UUID input. |
| Gateway -> Building assignment | PARTIAL | Backend company consistency/history/audit bor. UI raw building UUID input, no move/unassign/history UX. |
| Node -> Company assignment | PARTIAL | Backend history/audit bor. UI raw company UUID input. |
| Node -> Gateway assignment | CRITICAL PARTIAL | DB assignment endpoint bor, lekin MQTT cmd 2 bilan integratsiya qilinmagan. |
| MQTT cmd 2 register nodes | PARTIAL | Typed command/outbox/ACK bor, lekin ACK NodeGatewayAssignmentni commit qilmaydi. |
| MQTT cmd 3/4/5 | PARTIAL | Low-level adapters/endpoints bor. Business configuration UI va persisted desired/applied state yo'q. |
| MQTT subscribe 3 sensor types | COMPLETE | GATE_PUB, GATE_ANG, GATE_FORM tinglanadi; vertical gangformga normalize qilinadi. |
| Sensor history | COMPLETE narrow scope | Har unique reading SensorReadingga yoziladi; dedupe mavjud. |
| Latest node state | COMPLETE narrow scope | LatestNodeState upsert transactionda bajariladi. |
| Door status classification | COMPLETE | doorChk open = danger, closed = safe. |
| Angle/gangform classification | CRITICAL PARTIAL | Payload status bo'lmasa SAFE. DB alarm thresholds bo'yicha classify qilinmaydi. |
| Company realtime monitoring | COMPLETE narrow scope | Scoped APIs, Socket.IO room authorization, history UI mavjud. |
| GSS global monitoring UI | MISSING | Admin monitoring nav placeholder. |
| Gateway alarm level | MISSING domain/UI | AlarmLevel model, CRUD, building orchestration, desired/applied status va UI yo'q. |
| Fault filter | MISSING domain/UI | Low-level cmd 5 bor, persisted rule va UI yo'q. |
| Company scoped sidebar | PARTIAL | Permission filtering bor. Ba'zi ko'ringan pages placeholder. |
| Company user management | PARTIAL | Create/deactivate bor. Edit role/status/scope/direct permission/position yo'q. |
| Company role management | CRITICAL PARTIAL | Role create `permissionIds: []` bilan yaratiladi. Permission editor yo'q. |
| Area/building management | PARTIAL | List/create/deactivate bor; detail/edit/plan workflow yetishmaydi. |
| Building plan/storage | PARTIAL/MISSING | Prisma metadata bor, real upload/storage and plan placement UI to'liq emas. |
| Alarm occurrence count | MISSING | Latest approved blueprint bo'yicha hali implement qilinmagan. |
| Notifications/alarm lifecycle | MISSING | Event, recipient, delivery, ack/resolve UI yo'q. |
| Reports/export | MISSING | Sidebar placeholder, models/jobs/export yo'q. |
| Dashboard analytics | MISSING | Admin va Company dashboard placeholder. |
| Retention/partition/purge | MISSING | 180-day target docsda bor, real jobs/partition yo'q. |

## Confirmed UI bugs

### 1. Company Open login pagega yuboradi

- `CompaniesPage.tsx` `/admin/companies/${company.id}`ga navigate qiladi.
- `router.tsx`da bu route yo'q.
- Wildcard route `/login`ga redirect qiladi.

Bu auth token xatosi emas; birinchi sabab missing route. Auth refresh issue esa alohida muammo.

### 2. Browser refresh yoki deep-link logout qiladi

`AuthProvider` sessionni faqat React `useState`da saqlaydi. Browser refreshda `session` yo'qoladi. `/auth/gss/me` yoki `/auth/company/me` orqali bootstrapping yo'q.

## Confirmed device provisioning gap

`DevicesService.assignNodeToGateway()` darhol `NodeGatewayAssignment` yaratadi. U `GatewayCommand` yaratmaydi.

`GatewayCommandsService.createRegisterNodesCommand()` cmd 2 yaratadi va ACKni saqlaydi, lekin ACK kelganda `NodeGatewayAssignment`ni yaratmaydi.

Natija:

- DBda assigned, physical gatewayda register bo'lmagan node bo'lishi mumkin.
- Physical gatewayda register qilingan, DBda assigned bo'lmagan node bo'lishi mumkin.
- Failure/timeoutda desired va applied state ajratilmagan.

Bu Phase 8da tuzatilishi kerak.

## Confirmed MQTT response risk

`parseGatewayResponse()` successni `error === undefined` bo'lsa ham true qiladi. Bu strict legacy response normalization emas. `resp: fail` kabi payload error fieldsiz kelsa noto'g'ri ACK bo'lishi mumkin.

Phase 8da real old gateway response contractlari bo'yicha success/failure parser qat'iylashtirilishi kerak.

## Confirmed monitoring status gap

Angle va gangform parser `payload.status`ni qabul qiladi. Status yo'q bo'lsa default `safe`.

Eski loyiha angle/gangform statusni building alarm thresholds va abs(angleX/angleY) orqali hisoblagan. Yangi loyihada esa AlarmLevel modeli yo'q. Shu sabab real gateway payload status yubormasa danger reading historyga SAFE bo'lib yozilishi mumkin.

Phase 9da backend authoritative classification qo'shilishi kerak.

## Test coverage gap

Backend E2E tests yaxshi foundation beradi, lekin quyidagilar yo'q:

- Company Open route browser test.
- Browser refresh/session restore test.
- UI assignment selector/workflow test.
- MQTT cmd 2 ACK -> NodeGatewayAssignment commit E2E.
- cmd 2 failure/timeout -> assignment unchanged E2E.
- Alarm level save -> all building gateways cmd 4 E2E.
- Angle/gangform threshold classification E2E.
- Company role permission editor E2E.
- Company user area/building scope assignment UI E2E.

## Overall conclusion

Phase 6 monitoring engine tor scope bo'yicha yaxshi foundation. Lekin "Phase 0-6 product completed" deyish noto'g'ri. Keyingi ishni darhol occurrence alarmdan boshlash xavfli. Avval route/auth stabilization, physical device provisioning va alarm-level classification parity tugatilishi kerak.
