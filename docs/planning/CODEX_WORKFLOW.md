# Codex Working Workflow

## Nega bu workflow kerak

Katta architecture loyihasini bitta uzun prompt bilan qurish scope drift, test yetishmasligi va docs/code nomuvofiqligiga olib keladi. Codex har safar bitta coherent phase yoki vertical slice ustida ishlashi kerak.

## Har yangi Codex session boshida

Codexga quyidagini ayting:

```txt
Read AGENTS.md and all mandatory files it references. Summarize the active architecture constraints, current phase, open decisions, and quality gates. Do not modify code yet.
```

Keyin tegishli `prompts/` faylini bering.

## Task template

```txt
Goal:
Scope:
Out of scope:
Required source files:
Acceptance criteria:
Commands that must pass:
Documentation updates:
```

## Session yakunida Codex majburiy hisoboti

1. Changed files.
2. Implemented behavior.
3. Commands/tests run va exact result.
4. Schema/migration/seed effects.
5. Security va data risks.
6. Remaining TODO.
7. `PROJECT_STATE.md`, `TODO.md`, `DECISION_LOG.md` updates.
8. Next recommended prompt.

## Parallel agent qoidasi

Parallel tasklar faqat file ownership kesishmasa ishlatiladi. Masalan:

- Agent A: API schema/DTO.
- Agent B: UI design system.
- Agent C: test fixture/docs.

Bitta Prisma schema, permission catalog yoki shared contractsni bir nechta agent parallel tahrirlamaydi.

## Review gate

Har phase tugagach alohida review task yuboring:

```txt
Review the completed phase against AGENTS.md, architecture blueprint, acceptance criteria, security checklist and tests. Do not add features. Report blocking, high, medium and low findings with exact file references.
```
