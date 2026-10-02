# SG Electricity Savings Calculator

React/TypeScript mini app in the Perception npm workspace, served at `/sg-electricity-savings-calculator/` in the combined static site.

```bash
npm run dev:electricity
npm run build:electricity
npm test --workspace=sg-electricity-savings-calculator
```

## Calculation and browser storage

Enter a fixed retailer rate in cents/kWh, selecting whether the entered rate includes GST. Choose a start month from January 2026 onwards and enter actual monthly kWh. A blank usage cell is missing; zero is a recorded bill. Enter the one-time received voucher/cash rebate in SGD under Your electricity plan. It counts once in the total, independently of the number of usage months. Monthly comparisons and the trend show electricity savings before the rebate. Only records from the chosen start month through the current Singapore month count. Changing the start month preserves other saved entries.

SP costs use each month's historical domestic quarter. The fixed rate is normalized to before GST; each month's GST is then applied to electricity costs in the inclusive view. Each monthly bill rounds to cents before subtraction and aggregation. Rebates are not uplifted for GST. Missing SP rates are unavailable and never replaced with a stale quarter. The summary counts recorded usage only, with missing months disclosed. Negative savings indicate higher costs. The comparison excludes other fees, deposits, termination charges and U-Save credits. For partial first months, enter only usage under the retailer plan.

Inputs and display preferences persist in versioned `localStorage` under `perception:electricity-savings:v2`. Existing v1 monthly rebate amounts are combined into the one-time plan rebate; the original v1 record is retained. Storage is validated on read, and blocked/full storage is reported without preventing calculation. Tariff JSON is bundled with the frontend in the Vite asset cache; browsers do not scrape SP or make tariff API calls. A new deployment creates a new content-hashed bundle while preserving user inputs.

## Official tariff data

`data/sp-tariffs.json` stores normalized quarterly domestic tariffs starting in 2026, with GST, month boundaries and source URLs. The updater reads the domestic row from [SP's historical workbook](https://www.spgroup.com.sg/dam/spgroup/pdf/resources/billing/Historical-Electricity-Tariff.xlsx) and reconciles the latest quarter, before-GST rate and GST-inclusive rate against [SP's tariff page](https://www.spgroup.com.sg/our-services/utilities/tariff-information). It does not save provider downloads in the repository.

```bash
npm run refresh:tariffs --workspace=sg-electricity-savings-calculator
```

Missing quarters, changed historical records, unexpected GST declarations, stale current-quarter data and conflicting sources fail before the JSON is replaced. Changes requiring review remain visible as workflow failures. An unchanged response does not change the timestamp or generate a commit. Tests use synthetic provider structures only.

## Quarterly CI/CD

`.github/workflows/refresh-electricity-tariffs.yml` runs at 11:15 Singapore time on days 1–7 of January, April, July and October. The first successful changed download commits the validated JSON to `main` and explicitly dispatches `ci.yml`, which builds and deploys the combined site using the existing Cloudflare configuration. Subsequent unchanged downloads do nothing. The first-week retries cover publication or transient network delays; the workflow can also be run manually on `main`.

The workflow needs `contents: write` and `actions: write`. Branch rules must allow its validated data commit; a protected-branch rejection remains a failed run and never triggers a force push. If dispatch fails after a successful data commit, manually run “Build deployable site” on `main`. Schedules activate after the workflow is merged into the default branch. No additional provider credentials are needed.
