# Whole-Project Redesign Workflow

A whole-project redesign is feasible for Codex, but execute it as reviewed phases rather than one giant rewrite.

## Phase 0 - Audit and freeze

- inspect current branch and working tree;
- inventory routes, permissions, tabs, tables, forms, cards, and current tests;
- capture baseline screenshots;
- freeze business behavior and API contracts;
- record visual decisions.

## Phase 1 - Tokens and theme infrastructure

- extend semantic tokens for both schemes;
- implement Mantine color-scheme handling;
- add typography, spacing, radii, border, shadow, and control tokens;
- create visual demo fixtures;
- do not migrate feature pages yet.

## Phase 2 - Shell

- redesign portal sidebar, header, breadcrumbs, account, notifications, and responsive drawer;
- preserve permission filtering, unread API/socket, realtime state, and logout behavior;
- add shell visual tests.

## Phase 3 - Shared primitives

- context section layout;
- entity cards and grids;
- data toolbar and improved table;
- form workspace and form sections;
- chart/status panels;
- loading skeletons.

## Phase 4 - Organizations

- companies card grid;
- construction sites card grid;
- buildings card grid;
- admin company detail inner sidebar;
- company area/building detail layouts.

## Phase 5 - Users, roles, and settings

- full-page or large-drawer user forms;
- role editor;
- effective access preview;
- settings inner navigation;
- preserve self-lockout behavior.

## Phase 6 - Devices and commands

- dense device workspace;
- gateway/node detail;
- command history and detail timeline;
- permission-aware actions.

## Phase 7 - Monitoring

- admin operational overview;
- preserve company node-type image cards;
- keep realtime tabs;
- polish node card/table/detail drawer and responsive behavior.

## Phase 8 - Alarms, notifications, and reports

- alarm operations workspace;
- alarm rule form workspace;
- notification delivery states;
- report jobs and exports.

## Phase 9 - Cross-route QA

- all permissions and roles;
- no-permission and inactive sessions;
- desktop/tablet/mobile;
- light/dark;
- long Korean and English content;
- Playwright screenshots;
- performance and bundle review.

Each phase should end with a reviewable commit and visual acceptance before the next broad migration.
