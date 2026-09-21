# KrisFlyer Spontaneous Escapes

A local scraper and flight-search-style interface for the monthly KrisFlyer
Spontaneous Escapes offers published by Singapore Airlines and Scoot.

## Phase 1: scraper

The scraper uses only the Python standard library and writes a frontend-ready JSON
file containing the route, miles, airline, flight numbers, cabin class, raw blackout
period, and expanded ISO blackout dates for each offer.

```bash
cd krisflyer-spontaneous-escapes
python3 scraper/scrape.py
```

The default output is `data/spontaneous-escapes.json`. To write elsewhere or limit
the run to one source:

```bash
python3 scraper/scrape.py --output /tmp/escapes.json
python3 scraper/scrape.py --source singapore-airlines
python3 scraper/scrape.py --source scoot
```

Singapore Airlines is fetched directly. Scoot currently rejects non-browser local
requests at its Akamai edge, so the scraper tries the official page first and falls
back to the public Jina Reader representation when access is denied. Use
`--no-scoot-fallback` to require direct-only access.

For repeatable local parsing during development, the scraper also accepts an HTML
or Reader Markdown file without making a network request:

```bash
python3 scraper/scrape.py --source singapore-airlines --sia-input /path/to/page.html
python3 scraper/scrape.py --source scoot --scoot-input /path/to/page.md
```

## Tests

```bash
python3 -m unittest discover -s tests -v
npm test
```

The tests use small synthetic source fragments. Real provider responses are not
stored as fixtures or committed to the repository.

## JSON notes

- `miles_required` is per person, one way.
- `flight_numbers: ["All"]` means every Scoot flight on that listed route is eligible.
- `blackout_period: null` means the source lists no blackout period.
- `blackout_dates` expands the human-readable period into ISO dates for frontend date filtering.
- Source URLs and retrieval details live once in the top-level `sources` collection.

## Frontend

The React frontend supports one-way and round-trip searches, cabin and airline
filters, miles budgets, blackout-date eligibility, and combined round-trip mileage.

```bash
npm run dev
npm run build
```

The app is also registered in the repository's root npm workspace, navigation,
combined build, and deployment verification.

## Manual data refresh pull request

Run the **Refresh KrisFlyer Spontaneous Escapes** workflow from the repository's
Actions page whenever the monthly offers are published. The workflow:

1. tests the scraper and application;
2. scrapes both airline sources into temporary storage;
3. validates the schema, source counts, promotion windows, and offer data;
4. stops without creating a pull request when only retrieval metadata changed;
5. builds the application with materially changed candidate data; and
6. commits the JSON to a `feature/krisflyer-escapes-YYYY-MM` branch and opens or
   updates a pull request.

The workflow never merges its pull request. Review and merge it manually to trigger
the existing main-branch build and Cloudflare Pages deployment. The page derives its
travel month, booking deadline, date limits, and offer list from the refreshed JSON,
so they update together after deployment.

The optional `allow_large_drop` input bypasses the safety check that normally blocks
a source whose offer count falls by more than 50%. Use it only after confirming that
the provider intentionally published a much smaller offer set.
