# Crypto Trading Bot — Claude Instructions

This is an automated crypto futures trading bot. See README.md for architecture overview and STRATEGIES.md for full strategy documentation.

## Project Context

- **Stack**: Node.js + Express (server), React + Vite (client), SQLite, Binance API (candles), MEXC Futures API (execution)
- **Active strategies**: Confluence Swing (1H), SMC (4H), Break & Retest (4H), RSI Divergence (1H)
- **Paper engine**: running, scanning 24 coins every 3 min
- **Live engine**: ready to activate with MEXC API keys
- **Key files**: `server/routes.ts` (engine + API), `server/strategies/` (signal logic), `client/src/pages/` (UI)

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

### Component patterns used in this project
- Cards: `bg-zinc-900 border border-zinc-800 rounded-xl p-4`
- Badges: strategy-specific colors from `STRATEGY_COLORS` in `client/src/lib/types.ts`
- Tables: `text-sm text-zinc-300` rows, `text-zinc-500` headers
- Buttons: primary = green-600, destructive = red-600, secondary = zinc-700
- Live data: always show loading skeleton, never empty flash

---

## Development Guidelines

- Always run `npx tsc --noEmit` after editing TypeScript files
- Paper and live engines must stay in sync — changes to one apply to both
- Never commit `.mcp.json` (contains API keys, in .gitignore)
- Preferred commit style: `feat:`, `fix:`, `chore:`, `docs:` prefixes
