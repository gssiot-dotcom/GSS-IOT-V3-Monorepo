# Codex Setup for GSS IoT V3

## 1. Repository-level instructions

Codex repository rootdagi `AGENTS.md`ni har run boshida o‘qiydi. Nested folderlarda maxsus override kerak bo‘lsa keyin quyidagilar qo‘shiladi:

```txt
apps/api/AGENTS.md
apps/web/AGENTS.md
packages/ui/AGENTS.md
```

Root `AGENTS.md`ni juda katta knowledge dumpga aylantirmang; batafsil qoidalar `docs/` va skill referencesda qoladi.

## 2. Project skill

Repo skill manzili:

```txt
.agents/skills/gss-iot-v3-engineering/
```

Codex uni task description mos kelganda implicit tanlashi yoki promptda explicit chaqirilishi mumkin:

```txt
$gss-iot-v3-engineering
```

Skillni user-level barcha GSS repositorylar uchun ishlatish kerak bo‘lsa:

```txt
$HOME/.agents/skills/gss-iot-v3-engineering/
```

Lekin bu loyiha uchun repo-level joylashuv tavsiya qilinadi, chunki skill source control bilan birga versionlanadi.

## 3. Project config

`.codex/config.toml` project trusted bo‘lgandan keyin ishlaydi. Starter config:

- instruction limitni 64 KiBga oshiradi;
- `CODEX_GUIDE.md`ni fallback instruction file qiladi;
- workspace-write sandboxdan foydalanadi;
- networkni default o‘chiradi;
- approvalni on-request qiladi.

Dependency documentation yoki package install uchun network kerak bo‘lsa, task-level permission bilan yoqing; doimiy unrestricted network bermang.

## 4. Optional global user instruction

`~/.codex/AGENTS.md`ga umumiy shaxsiy qoidalarni yozing. Loyiha-specific architecture bu faylga qo‘yilmaydi.

Tavsiya template:

```md
# Global Codex preferences

- Prefer pnpm for JavaScript/TypeScript repositories.
- Read repository AGENTS.md before work.
- Ask before adding a new production dependency unless the repository explicitly authorizes it.
- Run available lint, typecheck, tests and build before reporting completion.
- Never expose or commit secrets.
- Report exact failed/skipped checks.
```

## 5. Verify setup

Repository rootdan Codexga yuboring:

```txt
Summarize all active instruction sources, the selected project skill, architecture source of truth, current phase, and commands required before completion. Do not modify files.
```

Expected:

- root `AGENTS.md` recognized;
- `CODEX_GUIDE.md` fallback recognized only as configured;
- `gss-iot-v3-engineering` skill visible;
- architecture blueprint and planning docs mentioned.

## 6. Skills strategy

Bu loyiha uchun ko‘p mayda custom skill yaratish shart emas. Bitta opinionated project skill context driftni kamaytiradi. Generic document, spreadsheet, browser yoki deployment skillsni faqat real task talab qilganda qo‘shing.

Project skill ichidagi references:

- architecture/RBAC;
- delivery workflow;
- UI design;
- alarm occurrence flow;
- quality gates.

## 7. Codex task sizing

Good task:

```txt
Implement CompanyRole permission resolver and denial-path tests.
```

Bad task:

```txt
Build the entire backend, frontend, MQTT, alarms, reports, migration and deploy it.
```

Har task 1 vertical slice va aniq acceptance criteria bilan beriladi.
