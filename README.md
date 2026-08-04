# GSS IoT V3 — Codex Starter Pack

Bu paket yangi GSS IoT V3 repositorysini Codex bilan xavfsiz va izchil boshlash uchun tayyorlangan.

## Paket tarkibi

- `AGENTS.md` — Codex uchun repository-level majburiy qoidalar.
- `.agents/skills/gss-iot-v3-engineering/` — loyiha uchun custom Codex skill.
- `.codex/config.toml` — project-scoped Codex konfiguratsiyasi.
- `docs/architecture/` — asosiy architecture blueprint.
- `docs/design/` — UI/UX, sahifalar, design system va legacy asset qoidalari.
- `docs/planning/` — implementation plan, project state, TODO va decision log.
- `docs/quality/` — test, security va Definition of Done.
- `docs/migration/` — eski loyihadan yangi loyihaga migration/refactoring yo‘li.
- `prompts/` — Codexga bosqichma-bosqich beriladigan tayyor promptlar.
- `reference/source-materials/` — eski loyiha, Parfumbox va talablar source materiallari.
- `assets/legacy-node-types/` — monitoring node-type selectionda o‘zgarmas saqlanadigan 3 ta rasm.

## Ishga tushirish tartibi

1. Paketni yangi Git repository rootiga ko‘chiring.
2. Codexni repository rootdan oching.
3. Avval `prompts/00_REPOSITORY_BOOTSTRAP.md` promptini yuboring.
4. Codex Phase 0 yakunida `docs/planning/PROJECT_STATE.md`, `TODO.md` va `DECISION_LOG.md`ni yangilashi shart.
5. Keyingi promptga faqat oldingi phase testlari va acceptance checklist o‘tgandan so‘ng o‘ting.

## Source of truth tartibi

1. `docs/architecture/gss_iot_rbac_architecture_blueprint.md`
2. `AGENTS.md`
3. `docs/design/*`
4. `docs/planning/DECISION_LOG.md`
5. Source code va tests

Eski ZIP fayllar reference hisoblanadi. Ularning arxitekturasi yangi loyihaga ko‘chirib olinmaydi.

## Development infrastructure

`docker-compose.yml` faqat lokal PostgreSQL'ni ko‘taradi. API Redis ishlatmaydi va lokal MQTT
broker yaratmaydi; kerak bo‘lsa `.env` ichidagi `MQTT_BROKER_URL` tashqi brokerga yo‘naltiriladi.

```bash
docker compose up -d
pnpm install --frozen-lockfile
pnpm --filter api prisma:generate
pnpm --filter api exec prisma migrate deploy
pnpm --filter api dev
pnpm --filter web dev
```

## Production deployment

Production modeli: App EC2 (`api` + `web` container), alohida DB EC2 va doimiy tashqi fizik MQTT
broker. App EC2 ichida DB, Redis yoki MQTT container yo‘q. Dockerfiles,
`docker-compose.production.yml`, GitHub Actions, Nginx/Certbot, backup, migration, smoke va rollback
flow'i [EC2 deployment runbook](docs/deployment/EC2_DEPLOYMENT_RUNBOOK.md) ichida yozilgan.
AWS, private S3, Docker Hub va GitHub Environment'larni birma-bir tayyorlash uchun
[infrastructure setup guide](docs/deployment/INFRASTRUCTURE_SETUP_GUIDE.md) dan foydalaning.
