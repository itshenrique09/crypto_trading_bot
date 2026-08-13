# Crypto Trading Bot — Codex Instructions

This is an automated crypto futures trading bot. See README.md for architecture overview and STRATEGIES.md for full strategy documentation.

## Project Context

- **Stack**: Node.js + Express 5 (server), React 18 + Vite (client), SQLite via sql.js (`data.db`), MEXC Futures public API (candles/tickers/funding, Binance spot fallback), Kraken Futures API (default live venue; MEXC alternative — unavailable to EEA since Jul 2026)
- **Active strategies**: Liquidity Sweep (1H), RSI Divergence (1H), Break & Retest (4H) — frozen 2026-07-02; validate any change with `script/validate-pipeline.ts` (full-pipeline A/B), see registry.ts for retirements
- **Paper engine**: running, scanning the 41-coin universe (union of strategy preferredSymbols) every 3 min; position management every 30s
- **Live engine**: Kraken Futures by default; keys configured at runtime via Settings (AES-256 encrypted in `bot_settings`, KDF = sha256(APP_PASSWORD))
- **Key files**: `server/routes.ts` (engines + API), `server/strategies/` (signal logic), `client/src/pages/` (UI: live, paper, markets, symbol, activity, settings), `client/src/components/ui-kit.tsx` + `client/src/index.css` (design system), `client/src/lib/api.ts` (data hooks)
- **API reference**: `API.md` — includes SSE (`/api/events`), health (`/api/health`), engine config (`/api/engine/config`), journal export/import

## Active MCPs

- **context7**: Use for any library/API docs (MEXC, Binance, React Query, Tailwind, etc.)
- **playwright**: Use for automated UI testing
- **tavily**: Use for web research on trading strategies, market conditions, crypto news

Always prefer context7 over guessing when working with external APIs or libraries.

---

## Skill: Deep Research

**Trigger**: When the user asks for "deep research", "comprehensive analysis", "research report", or wants to compare strategies/approaches in depth.

**Do NOT use for**: simple lookups, debugging, questions answerable with 1-2 searches.

### Research Modes

Select based on complexity:

| Mode | Phases | Time | Use when |
|------|--------|------|----------|
| Quick | 3 | 2-5 min | Focused question, clear scope |
| Standard | 6 | 5-10 min | Default — most research tasks |
| Deep | 8 | 10-20 min | Complex multi-faceted topic |
| UltraDeep | 8+ | 20-45 min | Comprehensive report needed |

### Workflow Phases

`SCOPE → PLAN → RETRIEVE → TRIANGULATE → OUTLINE → SYNTHESIZE → CRITIQUE → REFINE → PACKAGE`

- **SCOPE**: Define the question, constraints, and assumptions. State them explicitly.
- **PLAN**: Map sources to query. Use tavily_search + tavily_research.
- **RETRIEVE**: Execute searches. Minimum 10 sources, 3+ per major claim.
- **TRIANGULATE**: Cross-reference sources. Flag contradictions.
- **SYNTHESIZE**: Build the analysis. Every claim must be immediately cited.
- **CRITIQUE**: Self-review for gaps, bias, missing perspectives.
- **REFINE**: Address critique findings.
- **PACKAGE**: Deliver structured output (see below).

### Output Format

Every research report must include:
1. **Executive Summary** (200-400 words)
2. **Introduction** — methodology and assumptions
3. **Main Analysis** — 4-8 findings, each 600-2000 words, fully cited
4. **Synthesis & Insights**
5. **Limitations & Caveats**
6. **Recommendations**
7. **Bibliography** — complete, no fabricated citations

**Quality rules**: No placeholders. No fabricated citations. No unsupported claims. Cite immediately after every claim.

### Example triggers for this project
- "Deep research on RSI divergence win rate in crypto futures"
- "Research the best position sizing models for algorithmic trading"
- "Comprehensive analysis of MEXC vs Binance futures fees and liquidity"
- "Research trailing stop strategies used by professional crypto traders"

---

## Skill: Frontend Design

**Trigger**: When building or redesigning any UI component, page, or visual element in the trading bot dashboard.

### Design Philosophy

Before writing any code, establish a **clear conceptual direction**. Ask: what is the purpose, tone, and context of this interface? Then execute that direction with precision.

This is a **trading bot dashboard** — the aesthetic should feel:
- Professional and data-dense (not decorative)
- High contrast, dark theme (traders work at night, reduce eye strain)
- Numbers and charts should be the hero — UI chrome should recede
- Micro-interactions should confirm actions, not entertain

### What to avoid
- Generic AI-generated aesthetics (overused gradients, rounded-everything, pastel colors)
- Predictable card-based layouts when a table or chart works better
- Animation for animation's sake — every motion should communicate state change
- Cluttered toolbars — if it's not needed every session, it's a secondary action

### Implementation rules
1. **Typography**: Choose deliberately. Monospace for numbers/prices. Sans-serif for labels.
2. **Color**: One dominant hue (already: dark bg + green/red for P&L). Sharp accent for CTAs only.
3. **Spacing**: Generous whitespace around data, tight spacing within data groups.
4. **Complexity matches vision**: A simple status badge needs 3 lines. A full chart component needs proper abstraction.
5. **Production-grade**: No `TODO`, no hardcoded test data, no placeholder text in final output.

### Design system (v2 — use these, never raw zinc/gray classes)
- **Tokens** in `client/src/index.css` → Tailwind classes: `bg-card`, `bg-card-2`, `border-border`, `text-up`, `text-down`, `text-warn`, `text-accent`.
- **Primitives** in `client/src/components/ui-kit.tsx`: `Page`, `PageHeader`, `Panel`, `StatCard`, `Segmented`, `Pnl`, `DirectionBadge`, `ModeBadge`, `SourceTag`, `EmptyState`, `Th`/`Td`. Build pages from these — do not hand-roll variants.
- **Numbers**: `num` class (JetBrains Mono, tabular-nums); numeric table columns right-aligned.
- **Mode identity**: live = `warn` amber ("dinheiro real"), paper = `accent` violet ("simulado"). Never mix paper and live data in one panel.
- **Data provenance**: every panel gets a `SourceTag` naming its real source; engine constants come from `GET /api/engine/config` — never hardcode them in the UI.
- **Data access**: hooks in `client/src/lib/api.ts` (+ SSE invalidation in `lib/sse.ts`); mutations via `useAction` (auto toast on error).
- **Layout**: responsive grids MUST have a base column class (`grid grid-cols-1 … xl:grid-cols-3`); wrap every table in `overflow-x-auto`.
- Live data: always show loading skeleton, never empty flash.

---

## Development Guidelines

- Always run `npx tsc --noEmit` after editing TypeScript files
- Paper and live engines must stay in sync — changes to one apply to both
- Never commit `.mcp.json` (contains API keys, in .gitignore)
- Preferred commit style: `feat:`, `fix:`, `chore:`, `docs:` prefixes
