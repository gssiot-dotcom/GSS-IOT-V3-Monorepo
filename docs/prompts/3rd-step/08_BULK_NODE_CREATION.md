# CODEX TASK 08 — Bulk node creation with V2-style number input

Complete Tasks 02–07 first. Inspect the old GSS V2 bulk-create form/parser named in the source map, but rebuild the behavior with V3 validation, API contracts, transactions, auditing and Mantine.

## Goal

Implement user Requirement 7 so an admin does not have to create nodes one by one.

## Approved input behavior

Support at least:

```txt
100              -> [100]
100-105          -> [100,101,102,103,104,105]
100,102,110      -> [100,102,110]
100-103,110,120-122 -> mixed ranges and values
```

The V2 parser is a behavioral reference, but V3 should safely support mixed segments, trim whitespace and deduplicate.

## Validation rules

- positive safe integers only;
- reject malformed, descending or excessively large ranges;
- deduplicate within the request;
- use canonical decimal string storage for newly created numeric node numbers so `001` and `1` cannot create hardware-numeric ambiguity;
- enforce a documented maximum batch size;
- reject duplicate node numbers already in inventory with a clear conflict list;
- validate one selected NodeType for the whole batch;
- optional installed location may be shared only if this matches current create semantics;
- never silently partially create a batch unless a documented explicit partial mode is approved.

Default to atomic all-or-nothing creation in one transaction.

## Backend/API

Add a validated endpoint such as:

```txt
POST /admin/devices/nodes/bulk
```

Protected by `nodes.create`.

Use a typed DTO/contract. Return:

- created count;
- created node summaries;
- canonical numbers;
- actionable duplicate/validation errors.

Audit the batch operation with created IDs/numbers without logging sensitive data. Keep the existing single-create endpoint compatible unless there is a clean shared service refactor.

## Frontend

Replace or augment the single-node dialog with a bulk-friendly form inspired by V2:

- one input/textarea for values/ranges;
- localized examples/helper text;
- live parsed count;
- preview chips with truncation for large batches;
- invalid segment feedback;
- selected NodeType;
- clear submit progress/result;
- duplicate conflict feedback;
- reset only after successful creation;
- modern Mantine/GSS styling.

A single number remains valid, so a separate one-by-one workflow is not required.

## Tests

Unit-test the parser thoroughly:

- single;
- range;
- comma list;
- mixed list/range;
- spaces;
- duplicates;
- invalid tokens;
- descending range;
- unsafe integers;
- maximum size boundary.

API/E2E tests:

- successful atomic batch;
- duplicate existing node rejects whole batch;
- duplicate input canonicalizes once;
- invalid NodeType/permission rejects;
- audit created;
- no partial rows after failure.

Frontend tests:

- preview/count;
- error display;
- submit payload;
- successful refresh;
- no unauthorized create UI.

Run focused tests plus typecheck, lint, format, build and diff check.

## Out of scope

- assigning created nodes to a gateway;
- importing arbitrary CSV inventory;
- production migration.

## Definition of Done

- Admin can create a validated batch from one easy input.
- Existing single-number use still works.
- Creation is atomic, auditable and permission-protected.
- Tests and browser acceptance pass.
