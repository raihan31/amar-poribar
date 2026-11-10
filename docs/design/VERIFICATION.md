# Verification: tasks vs design

Date: 2026-11-11. Method: scripted checks over `docs/design/screens/*.dc.html`, `docs/design/canvas.json`, `docs/SRS.md` and `docs/tasks/*.md`. Nothing was rendered in a browser, so layout and overflow are **not** verified here.

## Results

| Check | Result | Action |
|---|---|---|
| Every canvas board has a file | 52 of 52 | — |
| Every board is cited by a mobile or web/admin task | 52 of 52 (mobile 44, web 38, admin 9; several overlap) | — |
| Each task cites the right board for its screen code | All correct (task title code matches the board's canvas code) | — |
| A board file that is not on the canvas | `Dash.dc.html` (old dashboard, replaced by the unified Home) | Removed |
| Bangla strings in the 43 non-admin boards | 750: 530 static UI strings, 220 dynamic (amounts, names, dates) | Extracted to `docs/design/strings.json` |
| Static design strings quoted in some task | In the first pass (804 strings, counted before removing the admin and old dashboard files) 147 were not quoted anywhere (mostly field labels, helper text and sample data) | Replaced by an automatic test: T-MOB-77 and T-WEB-42 compare app strings with the design, so tasks no longer need to quote them |
| Colours in tasks that the design does not use | `#151614 #1E3A21 #1F201D #33342F #4CAF50 #B7B6AE #ECEBE6 #F2827A` | Expected: they are the **dark theme** tokens the tasks derive. The design has no dark boards, so dark goldens cannot be compared with a design (see Open items) |
| Two reds | Design used `#B3261E` everywhere except the video-call hang-up button (`#D93025`) | Unified to `#B3261E` (contrast with white 6.5:1) in design files and tasks |
| Text contrast of the 16 main colour pairs | All ≥ 4.5:1 (lowest: white on red 4.8, before the fix) | — |
| Touch targets in mobile boards | No element has an explicit size under 48. Green/amber buttons at 48–52 px are secondary actions (for example "আম্মুকে জানান") | SRS FR-A11Y-01 now states primary ≥ 56, secondary ≥ 48 |
| Touch targets in admin boards | Buttons at 44 and 46 px (desktop tool) | SRS FR-A11Y-01 now states admin ≥ 44 px |
| Navigation | Home, transactions, budgets, members and the chat list use the same five tabs | — |

## Open items (not blockers)

1. **No dark-theme boards.** Tasks T-MOB-02 and T-WEB-06 define dark tokens; their goldens compare against themselves, not a design.
2. **Buzz phrase "বাজেট শেষ"** is in SRS FR-NUDGE-01 but is not a button on the Buzz board; it is sent only by the budget alert action.
3. **Layout not rendered.** Overflow and spacing are unverified until the first screen tasks produce goldens.
4. **Web at desktop width.** The family web screens are designed at 390 px; wider layouts are left to the web tasks.

## Re-running the checks

```
node tools/design/extract-strings.mjs --check   # design strings file is current
```
