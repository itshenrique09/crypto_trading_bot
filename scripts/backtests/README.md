# Backtest scripts

Standalone one-off scripts used during strategy research. They are **not** part of the build and are **not** imported by the server/client. Each script runs independently:

```bash
npx tsx scripts/backtests/backtest-swing.ts
```

If a script references `./server/...` it has been updated to `../../server/...` after the move from the repo root. Keep new scripts in this directory.
