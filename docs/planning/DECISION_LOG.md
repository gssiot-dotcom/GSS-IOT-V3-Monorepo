# GSS IoT V3 — Decision Log

## Format

```txt
DEC-YYYY-NNN
Status: proposed | accepted | superseded
Context:
Decision:
Consequences:
Files affected:
```

## DEC-2026-001

**Status:** accepted

**Context:** Eski GSS loyihada Express/Mongoose modul va route responsibilitylari aralash.

**Decision:** Yangi greenfield pnpm monorepo quriladi. Eski code production architecture sifatida ko‘chirilmaydi.

**Consequences:** Legacy business flow, MQTT contracts va assets extraction qilinadi; implementation NestJS/Prisma orqali qayta yoziladi.

## DEC-2026-002

**Status:** accepted

**Context:** Parfumbox admin componentlari izchil, eski GSS rang va node cardlari domain identityni saqlaydi.

**Decision:** UI component system Mantine + Tabler icons va Parfumbox admin patterns bo‘ladi. Ranglar GSS palette’dan olinadi. Old GSS node-type card rasmlari va image-first layout saqlanadi.

**Consequences:** Yangi loyihada Mantine va shadcn parallel primary systems sifatida ishlatilmaydi.

## DEC-2026-003

**Status:** accepted

**Context:** Alarm manualidagi `회수` notification send count deb noto‘g‘ri talqin qilinishi mumkin.

**Decision:** `회수 = requiredOccurrenceCount`; `지속시간 = countIntervalSeconds`, ya’ni eligible sensor counts orasidagi minimal interval.

**Consequences:** Counting PostgreSQL transaction state bilan yuritiladi; BullMQ timing source-of-truth emas.

## DEC-2026-004

**Status:** accepted

**Context:** Alarm manualidagi lavozimlar RBAC role emas.

**Decision:** `CompanyRole`, `CompanyPosition` va resource scope alohida modellardir. Position + scope notification recipientni, role permissions esa UI/API accessni boshqaradi.

## DEC-2026-005

**Status:** accepted

**Context:** Counter history sensor history bilan birga tez o‘sishi xavfi.

**Decision:** `alarm_counter_states` har node-policy uchun bitta mutable row bo‘ladi. Eligible reading IDs faqat event evidence sifatida kerakli darajada saqlanadi.
