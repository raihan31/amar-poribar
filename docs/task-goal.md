Use a workflow with multiple agents to complete ALL milestones M0 to M8 of the Amar Poribar task backlog, one milestone at a time. Tasks inside a milestone run in parallel whenever their dependencies and files allow.

AUTHORITY (read first, in this order)
1. docs/SRS.md (v1.0). The SRS wins over everything else.
2. docs/tasks/README.md (rules, task template, commands).
3. docs/tasks/01-platform.md, 02-backend-core.md, 03-backend-engage.md, 04-mobile.md, 05-web-admin.md. Every task has: Closes, Depends on, Milestone, Files, Steps, Contract, Tests, Acceptance, Done when.
4. docs/design/screens/*.dc.html are the visual spec; docs/design/strings.json lists the Bangla copy.

STARTING STATE
- Branch feat/m0-foundation already has T-PLAT-01..03 done. Continue from there.
- Create docs/tasks/PROGRESS.md if missing: one line per task ID (283 tasks) with status todo | doing | done | blocked-env | blocked, commit sha, and the date. Only you (the orchestrator) edit this file. Parse the existing "Milestone" and "Depends on" lines of every task to build the dependency graph; do not guess.

NO HUMAN GATES (SRS 1.5)
- Never stop to ask me. CI-style commands are the only gate. If a task is unclear, follow the SRS, choose the simplest option that satisfies the nearest requirement, and record the decision in the task's commit message.
- A task is "done" ONLY after its Acceptance commands were actually run and exited 0. Never mark done from reading code. If a command cannot run here (for example Flutter or Docker is missing), mark the task blocked-env, finish everything else that does not need it, and list it in the final report. Do not fake or skip checks.

MILESTONE LOOP (M0, then M1, ... then M8)
For each milestone N:
1. Create branch m<N> from the previous milestone's branch (m0 continues feat/m0-foundation).
2. Compute the ready set: tasks of milestone N whose Depends-on tasks are all done (dependencies on earlier milestones are already done).
3. Split the ready set into waves of tasks that can safely run at once. Two tasks may NOT run in the same wave if any of these is true:
   - their "Files" lists overlap;
   - both add a SQL migration, a Drift schema version, or an entry in modules/registry.ts, package.json scripts, docker-compose.yml, .github/workflows/ci.yml, or apps/api/openapi.json;
   - one depends on the other.
   Put such tasks in later waves. Run at most 6 agents at once.
4. For each task in a wave, launch one agent in its own git worktree (isolation: worktree) on branch task/<TASK-ID>. Give it: the task ID, the exact text of the task, the SRS sections it closes, the relevant design files, and these rules:
   - Implement exactly the task. Change files outside its Files list only when unavoidable, and say so in the commit message.
   - Write the tests named in the task first, then the code. Run every Acceptance command plus `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` and `pnpm arch` (and `flutter analyze && flutter test` for mobile tasks).
   - Do not edit docs/tasks/*.md, docs/SRS.md, or PROGRESS.md. If the task text is wrong, report it in the final message instead.
   - Commit with the message "<TASK-ID>: <title>" and the trailer line "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>". Final message: files changed, commands run with pass/fail, anything left undone.
5. After each wave, merge the task branches into m<N> one by one in dependency order. Resolve conflicts yourself. After merging, regenerate generated files (apps/api/openapi.json via `pnpm openapi:check` fix mode, Drizzle migrations, l10n output), renumber Drift/SQL migrations if two tasks took the same number, then run the full verification again on m<N>. If it fails, start ONE fix agent with the failing output; allow two fix attempts per failure. Then mark the task blocked and continue with tasks that do not depend on it.
6. Update PROGRESS.md and commit it. Repeat from step 2 until every task of milestone N is done or blocked.
7. Milestone gate: run `pnpm verify:m<N>` (and the acceptance scenarios AC-xx listed for that milestone in SRS 13.1 / section 15). If it passes, tag m<N>-done and go to the next milestone. If a blocked task prevents the gate, finish all unrelated work, report the gap, and still continue to the next milestone only when its tasks do not depend on the blocked ones; otherwise stop and report.

PARALLELISM HINTS
- M0: follow the "Build order and parallelism" waves at the top of 01-platform.md. The module-move tasks T-PLAT-23..31 edit the same files and run in order.
- Backend and mobile/web tasks of the same feature can run in parallel from the first day: each screen task defines a repository interface and a fake, so UI does not wait for the API.
- Independent modules (comms, shopping, lending, billing, privacy, admin) run in parallel once their dependencies exist.

CONTEXT HYGIENE
- Do not paste long command output into your own context; keep summaries (pass/fail plus the first failing lines).
- Keep PROGRESS.md as the single source of truth so the run can be resumed after an interruption: on start, read it and continue with the first unfinished milestone.

DO NOT
- Do not push, open pull requests, or touch other branches unless I later say so.
- Do not change the SRS decisions (DEC-01..18) or the design. Report conflicts instead.
- Do not delete tests to make a gate pass.

FINAL REPORT (after M8, or when blocked)
Per milestone: tasks done/blocked/blocked-env, gate result, notable decisions, and the list of anything I must do (for example install Flutter, supply real credentials). Keep it under 60 lines.
