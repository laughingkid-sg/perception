# Perception apps

This repository contains four applications, a shared navigation page, and a platform-neutral static deployment bundle managed through one npm workspace:

- `housing-affordability-calculator`
- `krisflyer-spontaneous-escapes`
- `trading-course`
- `us-compensation-compare`

## Requirements

- Node.js 26.0.0 or newer
- npm 10 or newer

## Install

Install all dependencies once from the repository root:

```bash
npm install
```

## Development

```bash
npm run dev:housing
npm run dev:escapes
npm run dev:trading
npm run dev:compensation
```

## Validation

```bash
npm run build
npm run test
npm run typecheck
npm run lint
```

## Build the combined site

```bash
npm run build
npm run verify:site
```

The combined static site is written to `dist/` with this URL structure:

- `/` — application navigation
- `/housing-affordability-calculator/`
- `/krisflyer-spontaneous-escapes/`
- `/trading-course/`
- `/us-compensation-compare/`

The output uses relative asset paths, so the entire `dist/` folder can be deployed to most static hosting platforms without provider-specific configuration.

## Continuous integration

GitHub Actions builds each application independently and publishes one `deployable-site` artifact. Each application's compiled output is cached by its source and dependency hash. If an application is unchanged, its existing output is restored and its install, validation, and build steps are skipped. Changes to the root package files invalidate every application cache because shared dependency changes can affect all three builds.

Download the `deployable-site` artifact from a completed workflow run and upload its contents to the static host of your choice.

Pushes to `main` and manual runs on `main` also deploy that verified artifact to the Cloudflare Pages project named by the `CLOUDFLARE_PAGES_PROJECT` repository variable. Pull requests never deploy. GitHub stores the Cloudflare account ID and API token as repository secrets.
