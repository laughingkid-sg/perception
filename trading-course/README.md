# US Markets Trading Lab

A self-contained, six-week course reader for paper-first study of US stocks and unleveraged ETFs. It contains 30 lessons, weekly checkpoints, answer keys, templates, evidence notes and a small offline Python lab.

## Run locally

From the repository root:

```bash
npm run dev:trading
```

Or from this directory:

```bash
npm run dev
```

The reader is a static site. A production build is created with `npm run build`.

## Study workflow

Open one lesson and attempt its practice and knowledge-check questions before viewing the answer key. Every section has a **copy reference** control. Paste that reference and your answer into a Codex conversation for review; the site itself does not contain an AI tutor.

Mark a lesson complete only after review. Completion marks and the most recently opened lesson use browser storage for this site's domain. There is no account or server sync. Clearing site data, using private browsing, switching device, or deploying under a different domain creates a separate progress record.

## Validation and Python lab

From this directory:

```bash
npm test
python3 tools/trading_math.py size --equity 10000 --entry 100 --stop 96 \
  --risk-fraction 0.005 --name-cap-fraction 0.10 --cash 10000
python3 tools/trading_math.py analyze resources/sample-trades.json
python3 tools/trading_math.py bootstrap resources/sample-trades.json --draws 2000 --seed 7
```

The utility uses only Python's standard library. It performs transparent arithmetic and never downloads data, connects to a broker, or places orders. The sample journal is explicitly synthetic.

See [VALIDATION.md](./VALIDATION.md) for the editorial and evidence review scope.
