# SG Property Options

A React/Vite affordability comparison table for Singapore housing options.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## What is editable

- Cash available
- CPF OA available
- Gross household income
- Existing monthly debt
- Monthly savings
- Annual income and cash-savings growth rate
- CPF contributor age band and number of CPF-earning household members
- Draggable 0–120 month projection timeline
- Every property row's unit price
- Bank/HDB interest rates and stress rates
- Loan tenures
- Buyer citizenship and pre-purchase property count (for ABSD scenarios)

## Modelled rules (snapshot: Sep 2026)

- New subsidised HDB family income ceiling: S$16,000
- New EC income ceiling under the new 2026 regime: S$18,000
- Up to 75% LTV
- 30% MSR for HDB / new EC
- 55% TDSR
- 4% medium-term bank stress rate (editable)
- 3% HDB-loan stress rate (editable)
- Current residential BSD marginal bands
- Current headline ABSD rates for SC/PR/foreigner buyer profiles
- 2026 CPF contribution and OA allocation rates, with the S$8,000 monthly Ordinary Wage ceiling per contributor

The app is a planning model only and deliberately does not attempt to encode every HDB eligibility, CPF valuation/lease limit, grant, resale levy, COV, age/tenure or remission rule.
