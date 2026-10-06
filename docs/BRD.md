# Amar Poribar — Business Requirements Document (BRD)

| Item | Value |
|---|---|
| Product | **Amar Poribar** (আমার পরিবার — "My Family"): an AI-assisted family expense tracker for Bangladesh |
| Document | Business Requirements Document |
| Version | 0.1 (draft) |
| Date | 2026-10-06 |
| Owner | Raihan (product owner) |
| Status | Draft for review |

---

## 1. Executive summary

Bangladeshi households run their money on **cash and mobile financial services (MFS)** like bKash and Nagad. Spending is often handled by **several family members** at once: one person does the daily bazaar, another pays the bills, a third sends money home from abroad. Global budgeting apps assume bank feeds and one user, so they fit Bangladesh poorly. Local apps mostly target **shop-keepers (SME ledgers)**, not families.

Amar Poribar is a **shared family wallet journal**. Any family member can record a spend in seconds in **Bangla, English or Banglish**, by typing, speaking, photographing a receipt or pasting an MFS SMS. An AI assistant turns that input into a structured, categorised expense. The family sees one shared picture of where money goes, gets budget alerts before month-end, and can ask questions such as *"এই মাসে বাজারে কত খরচ হলো?"* ("How much did we spend on bazaar this month?").

The first goal is to serve the owner's own family well (dog-fooding). The second is to grow into a freemium product for urban and semi-urban middle-income families in Bangladesh and for Bangladeshi expatriate families.

---

## 2. Background and problem statement

### 2.1 How a typical Bangladeshi family spends

- **Many spenders, many channels.** Daily bazaar (cash), rickshaw/CNG fares (cash), utility bills (DESCO/DPDC/NESCO, Titas gas, WASA, paid through bKash/Nagad/bank), school/coaching fees, house rent, domestic help salary, medical costs, mobile recharge and internet.
- **Extended-family obligations.** Money sent to parents in the village, support for siblings, zakat and fitra, and *dawat* or wedding gifts.
- **Seasonal spikes.** Eid-ul-Fitr and Eid-ul-Adha (qurbani), Puja, Pohela Boishakh, the start of the school year, and Ramadan grocery stocking.
- **Remittance-dependent households.** Many families have one earner abroad (Gulf, Malaysia, Europe) who wants to see how the money sent home is being spent.
- **Records are scattered.** Cash leaves no record. MFS leaves an SMS or in-app history per account. Bank cards leave a statement. Nobody has the full picture.

### 2.2 Problems

| # | Problem | Impact |
|---|---|---|
| P1 | Most spending is cash or MFS, and no feed or API exists for personal use | Manual entry is the only option, so people give up after a few days |
| P2 | Entry is tedious in English-only apps | Users who think and write in Bangla or Banglish drop off |
| P3 | Apps are single-user | Spending by a spouse, parent or child is never captured, so totals are wrong |
| P4 | Inflation is high (headline CPI 8–9.4% through 2026, with food the largest contributor) | Families feel squeezed but can't see *which* categories grew |
| P5 | Little financial planning culture (about 92% of individuals keep no written financial plan) | Overspending is only noticed at month-end |
| P6 | Expatriate earners can't see household spending | Friction and mistrust inside the family, and remittances are hard to plan |

---

## 3. Market analysis (Bangladesh)

### 3.1 Digital readiness

| Indicator | Figure | Implication |
|---|---|---|
| Mobile subscriptions (Jun 2025, BTRC) | ~188 million | Mobile-first is mandatory |
| Internet subscriptions (Jun 2025) | ~134 million, of which ~119 million on mobile | Most users are on mobile data, so the app must be light on data |
| Household internet access (BBS 2025) | 54.8% (up from 43.6% in 2023) | Growing fast, but offline support still matters |
| Smartphone adoption among mobile users | ~73% (2025) | Android-first; a large share are low/mid-range devices |
| 4G coverage | ~100% | A sync-first model is feasible |
| MFS registered accounts | 236 million+, ~89 million active | People already transact digitally, and MFS SMS is a rich data source |
| bKash | 70 million+ users | Main MFS for parsing and payment |
| Nagad | ~109 million registered, ~21.5 million monthly active (May 2026) | Second MFS parser |

### 3.2 Economic context

- Headline inflation was 8.3–9.4% through 2026 (May 2026: 9.42%; July 2026: 8.32%). Food inflation is about 8–9% and makes up the largest share of household spending.
- Middle-income urban families are under pressure. They want to **see and control** spending more than to "invest", which favours a tracking-and-budgeting value proposition over wealth management.

### 3.3 Competitive landscape

| Product | Type | Strengths | Gaps for Bangladeshi families |
|---|---|---|---|
| Money Manager, Monefy, Wallet (BudgetBakers), Spendee | Global personal finance | Polished UI, charts | No BD bank or MFS feeds, English-centric, weak family sharing, pricing in USD |
| Splitwise | Shared expenses | Good at splitting | Built for roommates and trips, not household budgets; no AI entry; key features paywalled |
| Amar Hishab | Local, voice-first personal tracker | Bangla voice entry, loans and savings | Single-user focus; no shared family ledger or remittance view |
| TallyKhata, Hishabee | Local digital *khata* (ledger) | Huge reach, Bangla UI, trust | Built for **shops and SMEs** (customer dues), not family budgets |
| Spreadsheets, notebooks (*hisab khata*) | Manual | Free, familiar | No automation, no sharing, no insight |

**Opportunity.** No product combines (a) a **shared family ledger**, (b) **AI entry in Bangla/Banglish across text, voice, receipt and SMS**, (c) **MFS-aware parsing**, and (d) **remittance and expatriate visibility**.

### 3.4 Target segments and personas

| Persona | Profile | Needs |
|---|---|---|
| **Shathi** (38, household manager, Dhaka) | Runs daily bazaar and bills, uses bKash, more comfortable writing Bangla | Fastest possible entry, Bangla UI, bazaar budget alerts |
| **Rahim** (42, salaried earner) | Pays rent, school fees and utilities, uses a bank app and bKash | Monthly overview, category trends, budget vs actual |
| **Tanvir** (29, expatriate in Riyadh) | Sends monthly remittance home | A read-only view of how the money was used and running balances |
| **Nusrat** (19, university student) | Has a pocket-money allowance | Simple personal spend logging inside the family plan, with privacy controls |

**Primary market:** urban and peri-urban middle-income families (Dhaka, Chattogram, Sylhet, Khulna, Rajshahi), plus expatriate Bangladeshi families.

### 3.5 SWOT

| Strengths | Weaknesses |
|---|---|
| AI entry in Bangla, Banglish and English; built for the family; MFS-aware; owner dog-foods it | Manual-first (no bank feeds); AI usage costs money per request; a new brand |
| **Opportunities** | **Threats** |
| Growing smartphone and MFS use; inflation makes people cost-aware; a large diaspora; no direct competitor | Google Play SMS-permission policy; MFS providers adding their own budgeting features; low willingness to pay; data-privacy concerns |

---

## 4. Business objectives and success metrics

| ID | Objective | KPI | Target |
|---|---|---|---|
| BO-1 | Make expense capture effortless | Median time to log one expense | ≤ 10 seconds |
| BO-2 | Capture the whole family's spending | Average active members per family | ≥ 2.5 |
| BO-3 | Make AI parsing trustworthy | Share of AI drafts accepted without edits | ≥ 85% |
| BO-4 | Build a habit | 30-day retention of families | ≥ 40% |
| BO-5 | Improve budget control | Families that set ≥ 1 budget; months ending under budget | ≥ 60%; ≥ 50% |
| BO-6 | Keep it sustainable | AI cost per active family per month | ≤ ৳15 |
| BO-7 | Earn revenue (phase 3) | Conversion from free to paid | ≥ 4% |

---

## 5. Scope

### 5.1 In scope (by phase)

**Phase 1: MVP (own family, about 8 weeks)**
- Family workspace with invitations and roles (owner, admin, member, viewer)
- Accounts/wallets: Cash, bKash, Nagad, Rocket, Upay, bank, card
- Manual and AI entry from **text** (Bangla, Banglish, English) and **pasted MFS SMS**
- Bangladesh-specific categories (bazaar, utilities, rent, education, medical, transport, remittance-out, zakat/charity, festival and so on)
- Monthly budgets per category with alerts
- Dashboard: month total, by category, by member, by account
- Bangla and English UI, BDT (৳) formatting, Bangla numerals optional
- Web app and Android app

**Phase 2: v1 (about 8 weeks later)**
- Voice entry (Bangla speech-to-text)
- Receipt or memo photo → expense (vision AI)
- "Ask Amar Poribar": natural-language questions over the family's own data
- Income and remittance tracking; expatriate (read-only) view
- Recurring expenses (rent, salaries, subscriptions), bill reminders
- Offline-first capture with background sync
- Festival budgets (Eid/Puja planner)

**Phase 3: growth**
- Freemium plans with bKash/Nagad payment for subscriptions
- Android notification-listener capture for MFS (opt-in), where policy allows
- Savings goals, loan or *dhar* (lent/borrowed) tracking
- iOS app, export (PDF/Excel), a monthly AI insight report in Bangla

### 5.2 Out of scope

- Moving money, holding funds or initiating payments (the app is **not** a payment service provider)
- Scraping MFS or bank apps, or any use of credentials for third-party financial accounts
- Investment advice, credit scoring, lending
- Tax filing (a possible future add-on for income-tax return support)

---

## 6. Business requirements

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| BR-01 | A family can create one shared workspace and invite members by phone number or link | Must | 1 |
| BR-02 | Members have roles that control who can view, add, edit and manage budgets | Must | 1 |
| BR-03 | Users can record an expense in Bangla, Banglish or English free text, and AI turns it into a structured draft for confirmation | Must | 1 |
| BR-04 | Users can paste a bKash, Nagad or Rocket SMS and get a correctly parsed transaction (amount, fee, counterparty, TrxID) | Must | 1 |
| BR-05 | The system tracks money per account/wallet (cash, MFS, bank, card) | Must | 1 |
| BR-06 | Categories reflect Bangladeshi household spending and can be customised per family | Must | 1 |
| BR-07 | Families can set monthly budgets per category and get alerts at 80% and 100% | Must | 1 |
| BR-08 | A dashboard shows spending by category, member, account and over time | Must | 1 |
| BR-09 | The UI is fully usable in Bangla and English, with BDT formatting | Must | 1 |
| BR-10 | Users can log expenses by voice in Bangla | Should | 2 |
| BR-11 | Users can photograph a receipt or handwritten memo and get an expense draft | Should | 2 |
| BR-12 | Users can ask questions about family spending in natural language and get answers grounded in their data | Should | 2 |
| BR-13 | Expatriate members can see a read-only remittance and spending summary | Should | 2 |
| BR-14 | Capture works offline and syncs later | Should | 2 |
| BR-15 | Recurring expenses and bill reminders | Should | 2 |
| BR-16 | Personal (private) expenses are hidden from other members when the user chooses | Should | 2 |
| BR-17 | Subscriptions can be paid with bKash or Nagad | Could | 3 |
| BR-18 | Loans and *dhar* (money lent or borrowed) tracking | Could | 3 |
| BR-19 | Data export (PDF, Excel) and a monthly AI summary report | Could | 3 |
| BR-20 | Comply with Bangladesh's Personal Data Protection Ordinance 2025 | Must | 1 |

---

## 7. Stakeholders

| Stakeholder | Interest |
|---|---|
| Product owner (Raihan) | Vision, priorities, first family user |
| Family members (pilot users) | Ease of use, privacy, accurate totals |
| Developers | Clear requirements, maintainable codebase |
| AI provider (Anthropic Claude API) | Usage under its terms and acceptable-use policy |
| Regulators (National Data Governance Authority) | Personal-data protection compliance |
| Google Play, Apple App Store | Store policy compliance (SMS and notification permissions, financial-app declarations) |

---

## 8. Monetisation (phase 3, indicative)

| Plan | Price (indicative) | Includes |
|---|---|---|
| Free | ৳0 | 1 family, up to 3 members, 100 AI entries per month, 6-month history |
| Poribar Plus | ৳99 per month or ৳999 per year | Up to 8 members, unlimited history, 1,000 AI entries, voice and receipt entry, "Ask" queries, export |
| Probashi (expatriate) | ৳149 per month | Plus features, remittance planner, multi-currency (SAR/AED/MYR/GBP → BDT) |

Payment by bKash or Nagad checkout through a licensed payment gateway (for example SSLCommerz or the MFS merchant APIs).

---

## 9. Regulatory and policy considerations

- **Personal Data Protection Ordinance 2025** (gazetted November 2025; some sections take effect 18 months after the gazette). Financial information counts as personal data, so the product needs **explicit consent**, purpose limitation, data-subject rights (access, correction, deletion), breach handling and care with **cross-border transfer** (AI processing and cloud hosting outside Bangladesh). Requirements: a consent screen, a privacy policy in Bangla and English, data minimisation before AI calls, and a record of processing.
- **Bangladesh Bank / MFS rules.** The app neither moves nor holds money, so it needs no payment licence. It must not imitate MFS branding or ask for MFS PINs or OTPs.
- **Google Play SMS and Call Log policy.** `READ_SMS` is restricted to default SMS apps and a few approved uses. The MVP therefore uses **user-initiated paste or share** of SMS text. Automatic capture through a notification listener is a phase-3 option after a policy review.
- **AI provider terms.** Don't send unnecessary personal identifiers. Keep a human confirmation step for every AI-generated record.

---

## 10. Assumptions, constraints and dependencies

**Assumptions**
- Users have Android phones (Android 8+, about 2–3 GB RAM) with intermittent 4G.
- At least one family member is comfortable with a smartphone and can onboard the others.
- Users accept confirming AI drafts (one tap) rather than fully automatic entry.

**Constraints**
- No public personal-account APIs from Bangladeshi MFS providers or banks.
- Small team and budget, so prefer managed services and one TypeScript codebase.
- AI cost must stay within the BO-6 target. Use the cheapest path first (rule-based SMS parsing, caching) and call the LLM only when needed.

**Dependencies**
- Claude API (Anthropic) for language understanding, vision and Q&A
- Speech-to-text with Bangla support (phase 2)
- An SMS or OTP gateway in Bangladesh for phone login (for example SSL Wireless or Alpha SMS), or Firebase Auth
- PostgreSQL hosting; a region close to Bangladesh is preferred (for example Singapore or Mumbai)

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Users stop logging after the novelty wears off | High | High | ≤ 10-second entry, daily nudge, family visibility as social motivation |
| AI misreads amounts or categories | Medium | High | Structured output, confidence score, mandatory confirm, deterministic SMS parser |
| AI cost grows faster than revenue | Medium | Medium | Rule-based parsing first, quotas per plan, prompt caching |
| Privacy concerns inside the family | Medium | Medium | Private expenses, role-based visibility |
| MFS SMS formats change | Medium | Low | Template-driven parsers with an AI fallback; parser tests |
| Store policy rejection (SMS) | Medium | Medium | No `READ_SMS`; paste/share flow |
| Data-protection non-compliance | Low | High | Privacy by design, consent, deletion, DPIA before public launch |

---

## 12. Glossary

| Term | Meaning |
|---|---|
| MFS | Mobile Financial Services (bKash, Nagad, Rocket, Upay) |
| TrxID | Transaction ID in MFS SMS |
| Bazaar | Daily or weekly grocery and market shopping |
| Banglish | Bangla written in Latin script (for example "bazar e 500 taka") |
| Probashi | A Bangladeshi living or working abroad |
| Dhar | Informal loan between people |
| Hisab / khata | Account / ledger book |
| PDPO | Personal Data Protection Ordinance 2025 |

---

## 13. Sources

- [The Daily Star — Tk 6,000cr moves daily, not every wallet winning](https://www.thedailystar.net/business/news/tk-6000cr-moves-daily-not-every-wallet-winning-4220811)
- [TBS — Nagad records highest-ever first-quarter transactions](https://www.tbsnews.net/node/1401366)
- [TBS — Bangladesh mobile payments surge, but active use lags](https://www.tbsnews.net/node/1250396)
- [Financial Express — Internet subscriber growth outpaces mobile connections](https://thefinancialexpress.com.bd/trade/internet-subscriber-growth-outpaces-mobile-connections-in-h1)
- [Wikipedia — Internet in Bangladesh](https://en.wikipedia.org/wiki/Internet_in_Bangladesh)
- [Financial Express — Inflation climbs to 9.42% in May](https://thefinancialexpress.com.bd/economy/inflation-climbs-to-942pc-in-may-amid-higher-food-prices)
- [Financial Express — Inflation eases to 8.32% in July](https://thefinancialexpress.com.bd/economy/inflation-eases-further-to-832pc-in-july)
- [The Daily Star — PDPO 2025 key takeaways](https://www.thedailystar.net/tech-startup/news/bangladeshs-personal-data-protection-ordinance-2025-key-takeaways-4015401)
- [TBS — Govt issues gazettes of data protection ordinances](https://www.tbsnews.net/node/1281356)
- [Pocketclear — Expense tracking in Bangladesh](https://pocketclear.app/blog/expense-tracker-bangladesh.html)
