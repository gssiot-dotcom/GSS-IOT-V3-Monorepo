# GSS IoT V3 - Phase 6 dan keyingi execution order

## Maqsad

Bu folder Phase 6 gacha bo'lgan real repository auditiga, eski GSS loyihadagi asosiy business behaviorlarga va tasdiqlangan yangi RBAC architecturega tayangan holda tuzilgan.

Bu plan eski kodni ko'chirish uchun emas. Eski loyiha faqat business behavior reference hisoblanadi. Yangi loyiha quyidagi architecture invariantlarini saqlashi shart:

- GSS Admin RBAC va Company/User RBAC alohida.
- Backend security boundary hisoblanadi.
- Company access = permission + company/site/building scope.
- Device assignment history saqlanadi.
- MQTT commandlar GatewayCommand outbox orqali yuradi.
- Backend `GatewayCommand.id`ni MQTT `requestId` sifatida yuboradi; gateway aynan shu IDni ACKda qaytaradi.
- cmd 2/3/4/5 exact requestId correlation, strict ACK, idempotent side-effect va fast-ACK race protectionni saqlaydi.
- Super admin isSuperAdmin bypass saqlanadi.
- Inactive user token bilan ham endpointga kira olmaydi.
- Alarm recipient platform role bilan emas, CompanyPosition + scope bilan aniqlanadi.
- Alarm trigger requiredOccurrenceCount + countIntervalSeconds orqali ishlaydi.

## Auditdan chiqqan muhim xulosa

Phase 0-6 tor texnik scope bo'yicha implement qilingan. Lekin product flow hali to'liq emas. Ayniqsa:

1. Admin Company Open route yo'q va wildcard login pagega yuboradi.
2. Auth session faqat React memoryda; refresh/deep-link sessionni yo'qotadi.
3. Device assignment UI raw UUID inputlardan foydalanadi.
4. Node -> Gateway DB assignment va real MQTT cmd 2 registration bir-biriga ulanmagan.
5. Gateway alarm level va fault filter uchun faqat low-level command adapter bor; domain model, desired/applied state, building orchestration va UI yo'q.
6. Angle/gangform reading status payloadga ishonadi; status kelmasa SAFE bo'lib qoladi. Legacy threshold classification yo'q.
7. Company user/role/scope management UI qisman: role permission editor, scope assignment, position assignment yo'q.
8. Ko'p sidebar routelar PlaceholderPage.

## Phase 8 dan keyingi majburiy protocol handoff

Phase 9-14 boshlanishidan oldin har safar `03_PHASE_8_MQTT_PROTOCOL_BASELINE.md` o'qiladi. Keyingi phase hech qachon requestId correlationni gateway+cmd taxminiga qaytarmaydi.

## Phase execution order

1. `07_PHASE_6_STABILIZATION_AND_ROUTE_COMPLETION.md`
2. `08_DEVICE_PROVISIONING_MQTT_ASSIGNMENT.md`
3. `09_ALARM_LEVELS_FAULT_FILTER_AND_CLASSIFICATION.md`
4. `10_COMPANY_PORTAL_SCOPE_AND_MANAGEMENT_COMPLETION.md`
5. `11_ALARM_OCCURRENCE_COUNT_ENGINE.md`
6. `12_NOTIFICATIONS_AND_ALARM_OPERATIONS_UI.md`
7. `13_REPORTS_DASHBOARDS_AND_LEGACY_PARITY.md`
8. `14_RETENTION_MIGRATION_HARDENING_DEPLOYMENT.md`

Phase 8 planning holati faqat live cmd=2 ACK va active `NodeGatewayAssignment` exactly-once tekshiruvidan keyin complete qilinadi.

Har bir phase alohida commit va tag bilan tugatiladi. Keyingi phase faqat oldingi phase Definition of Done to'liq o'tgandan keyin boshlanadi.

## Codexga berish tartibi

Har phase promptini alohida yangi Codex chat/sessionga bering. Promptni berishdan oldin repository clean bo'lsin:

```bash

git status
pnpm install --frozen-lockfile
pnpm --filter api exec prisma migrate status
```

Phase tugaganda kamida:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
git diff --check
```

Prisma schema o'zgargan phase uchun qo'shimcha:

```bash
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate status
pnpm --filter api exec prisma db seed
```

## Har phase uchun majburiy docs update

- `docs/planning/PROJECT_STATE.md`
- `docs/planning/TODO.md`
- `docs/planning/DECISION_LOG.md`
- `docs/planning/IMPLEMENTATION_PLAN.md`
- phasega tegishli `docs/architecture/PHASE_*.md`
- kerak bo'lsa `docs/quality/*`

## Muhim qoida

Codex faqat promptda berilgan phase scopeini implement qiladi. Keyingi phasega o'tmaydi. "Already implemented" degan xulosani faqat model yoki controller borligiga qarab bermaydi; backend, frontend, permission, scope, tests va manual acceptance birga tekshiriladi.
