#!/usr/bin/env python3
"""Scrape KrisFlyer Spontaneous Escapes offers into a stable JSON shape.

The implementation deliberately uses only Python's standard library so it can be
run locally without installing scraper dependencies.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import ssl
import subprocess
import sys
import time
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


SIA_URL = (
    "https://www.singaporeair.com/en_UK/sg/plan-travel/promotions/"
    "global/kf/kf-promo/kfescapes/"
)
SCOOT_URL = "https://www.flyscoot.com/en/krisflyer/spontaneous-escapes"
SCOOT_READER_URL = "https://r.jina.ai/http://www.flyscoot.com/en/krisflyer/spontaneous-escapes"

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/140.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-SG,en;q=0.9",
}


def clean_text(value: str) -> str:
    value = value.replace("\xa0", " ").replace("\u200b", " ")
    return re.sub(r"\s+", " ", value).strip()


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def text(self) -> str:
        return clean_text(" ".join(self.parts))


@dataclass
class ParsedTable:
    heading: str
    rows: list[list[tuple[str, str]]]


class TableExtractor(HTMLParser):
    """Extract table text and the nearest preceding h3 heading."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.heading = ""
        self._heading_parts: list[str] | None = None
        self._table_rows: list[list[tuple[str, str]]] | None = None
        self._row: list[tuple[str, str]] | None = None
        self._cell_tag: str | None = None
        self._cell_parts: list[str] = []
        self.tables: list[ParsedTable] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag == "h3":
            self._heading_parts = []
        elif tag == "table":
            self._table_rows = []
        elif tag == "tr" and self._table_rows is not None:
            self._row = []
        elif tag in {"th", "td"} and self._row is not None:
            self._cell_tag = tag
            self._cell_parts = []

    def handle_data(self, data: str) -> None:
        if self._heading_parts is not None:
            self._heading_parts.append(data)
        if self._cell_tag is not None:
            self._cell_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "h3" and self._heading_parts is not None:
            candidate = clean_text(" ".join(self._heading_parts))
            if candidate:
                self.heading = candidate
            self._heading_parts = None
        elif tag in {"th", "td"} and self._cell_tag == tag and self._row is not None:
            self._row.append((tag, clean_text(" ".join(self._cell_parts))))
            self._cell_tag = None
            self._cell_parts = []
        elif tag == "tr" and self._row is not None and self._table_rows is not None:
            if any(value for _, value in self._row):
                self._table_rows.append(self._row)
            self._row = None
        elif tag == "table" and self._table_rows is not None:
            self.tables.append(ParsedTable(self.heading, self._table_rows))
            self._table_rows = None


def html_to_text(html: str) -> str:
    parser = TextExtractor()
    parser.feed(html)
    return parser.text()


def fetch_with_curl(url: str, timeout: float) -> str:
    curl = shutil.which("curl")
    if not curl:
        raise RuntimeError(
            "Python could not verify the site's certificate and curl is not installed"
        )
    is_reader = url.startswith("https://r.jina.ai/")
    user_agent = "Mozilla/5.0" if is_reader else BROWSER_HEADERS["User-Agent"]
    accept = "text/plain" if is_reader else BROWSER_HEADERS["Accept"]
    command = [
        curl,
        "-L",
        "--fail",
        "--compressed",
        "--silent",
        "--show-error",
        "--max-time",
        str(max(1, int(timeout))),
        "-A",
        user_agent,
        "-H",
        f"Accept: {accept}",
        "-H",
        f"Accept-Language: {BROWSER_HEADERS['Accept-Language']}",
        url,
    ]
    try:
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            timeout=timeout + 5,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        detail = getattr(error, "stderr", b"")
        if isinstance(detail, bytes):
            detail = detail.decode("utf-8", errors="replace")
        raise RuntimeError(f"curl could not fetch {url}: {clean_text(detail)}") from error
    body = result.stdout.decode("utf-8", errors="replace")
    if "Access Denied" in body[:1000]:
        raise RuntimeError(f"Access denied by {url}")
    return body


def fetch_text(url: str, timeout: float, attempts: int = 2) -> str:
    last_error: Exception | None = None
    for attempt in range(attempts):
        headers = dict(BROWSER_HEADERS)
        if url.startswith("https://r.jina.ai/"):
            headers.update({"User-Agent": "Mozilla/5.0", "Accept": "text/plain"})
        request = Request(url, headers=headers)
        try:
            with urlopen(request, timeout=timeout) as response:
                charset = response.headers.get_content_charset() or "utf-8"
                body = response.read().decode(charset, errors="replace")
            if "Access Denied" in body[:1000]:
                raise RuntimeError(f"Access denied by {url}")
            return body
        except HTTPError as error:
            last_error = error
            if attempt + 1 < attempts:
                time.sleep(0.75 * (attempt + 1))
        except URLError as error:
            if isinstance(error.reason, ssl.SSLCertVerificationError):
                try:
                    return fetch_with_curl(url, timeout)
                except RuntimeError as curl_error:
                    last_error = curl_error
                if attempt + 1 < attempts:
                    time.sleep(0.75 * (attempt + 1))
                continue
            last_error = error
            if attempt + 1 < attempts:
                time.sleep(0.75 * (attempt + 1))
        except (TimeoutError, RuntimeError) as error:
            last_error = error
            if attempt + 1 < attempts:
                time.sleep(0.75 * (attempt + 1))
    raise RuntimeError(f"Could not fetch {url}: {last_error}") from last_error


def read_or_fetch(path: str | None, url: str, timeout: float) -> str:
    if path:
        return Path(path).read_text(encoding="utf-8")
    return fetch_text(url, timeout)


def split_route(route: str) -> tuple[str, str]:
    match = re.match(r"^(.+?)\s+to\s+(.+)$", clean_text(route), flags=re.IGNORECASE)
    if not match:
        raise ValueError(f"Could not split route: {route!r}")
    return clean_text(match.group(1)), clean_text(match.group(2))


def parse_miles(value: str) -> int | None:
    digits = re.sub(r"[^0-9]", "", value)
    return int(digits) if digits else None


def parse_flight_numbers(value: str) -> list[str]:
    if clean_text(value) in {"", "-"}:
        return []
    if re.search(r"\bAll\b", value, flags=re.IGNORECASE):
        return ["All"]
    return re.findall(r"\b(?:SQ|TR)\s*\d+[A-Z]?\b", value.upper().replace(" ", ""))


MONTHS = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


def expand_blackout_dates(value: str | None) -> list[str]:
    if not value or clean_text(value) == "-":
        return []

    normalized = unicodedata.normalize("NFKC", value).replace("–", "-").replace("—", "-")
    years = re.findall(r"\b(20\d{2}|\d{2})\b", normalized)
    if not years:
        return []
    default_year = int(years[-1])
    if default_year < 100:
        default_year += 2000

    pattern = re.compile(
        r"\b(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s+"
        r"(January|February|March|April|May|June|July|August|September|October|"
        r"November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)"
        r"(?:\s+(20\d{2}|\d{2}))?\b",
        flags=re.IGNORECASE,
    )
    dates: set[date] = set()
    for match in pattern.finditer(normalized):
        start_day = int(match.group(1))
        end_day = int(match.group(2) or start_day)
        month = MONTHS[match.group(3).lower()]
        year = int(match.group(4) or default_year)
        if year < 100:
            year += 2000
        for day in range(start_day, end_day + 1):
            dates.add(date(year, month, day))
    return [value.isoformat() for value in sorted(dates)]


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")


def make_offer(
    *,
    airline: str,
    airline_code: str,
    region: str,
    route: str,
    miles: int,
    cabin_class: str,
    flight_numbers: list[str],
    blackout_period: str | None,
    origin_code: str | None = None,
    destination_code: str | None = None,
) -> dict:
    origin, destination = split_route(route)
    clean_blackout = clean_text(blackout_period or "")
    if clean_blackout == "-":
        clean_blackout = ""
    offer_id = slugify(f"{airline_code}-{origin}-{destination}-{cabin_class}")
    return {
        "id": offer_id,
        "airline": airline,
        "airline_code": airline_code,
        "region": clean_text(region),
        "origin": origin,
        "origin_code": origin_code,
        "destination": destination,
        "destination_code": destination_code,
        "miles_required": miles,
        "cabin_class": cabin_class,
        "flight_numbers": flight_numbers,
        "blackout_period": clean_blackout or None,
        "blackout_dates": expand_blackout_dates(clean_blackout),
    }


def table_headers_and_rows(table: ParsedTable) -> tuple[list[str], list[list[str]]]:
    header_index = next(
        (index for index, row in enumerate(table.rows) if any(tag == "th" for tag, _ in row)),
        None,
    )
    if header_index is None:
        return [], []
    headers = [clean_text(value).upper() for _, value in table.rows[header_index]]
    rows = [[value for _, value in row] for row in table.rows[header_index + 1 :]]
    return headers, rows


def parse_sia_html(html: str) -> list[dict]:
    parser = TableExtractor()
    parser.feed(html)
    offers: list[dict] = []

    for table in parser.tables:
        headers, rows = table_headers_and_rows(table)
        if not headers or "FROM" not in headers[0] or not any("MILES REQUIRED" in h for h in headers):
            continue
        cabin_columns: list[tuple[int, str]] = []
        for index, header in enumerate(headers):
            match = re.search(r"MILES REQUIRED FOR (.+?) CLASS", header)
            if match:
                cabin_columns.append((index, clean_text(match.group(1)).title()))

        for row in rows:
            if not row or " to " not in row[0].lower():
                continue
            for miles_index, cabin_class in cabin_columns:
                if miles_index >= len(row):
                    continue
                miles = parse_miles(row[miles_index])
                if miles is None:
                    continue
                flight_value = row[miles_index + 1] if miles_index + 1 < len(row) else ""
                blackout_value = row[miles_index + 2] if miles_index + 2 < len(row) else ""
                offers.append(
                    make_offer(
                        airline="Singapore Airlines",
                        airline_code="SQ",
                        region=table.heading,
                        route=row[0],
                        miles=miles,
                        cabin_class=cabin_class,
                        flight_numbers=parse_flight_numbers(flight_value),
                        blackout_period=blackout_value,
                    )
                )
    return deduplicate_offers(offers)


def parse_scoot_html(html: str) -> list[dict]:
    parser = TableExtractor()
    parser.feed(html)
    offers: list[dict] = []
    route_code = re.compile(r"\b([A-Z]{3})\s*-\s*([A-Z]{3})\b")

    for table in parser.tables:
        headers, rows = table_headers_and_rows(table)
        if not any("SCOOT ECONOMY" in header for header in headers):
            continue
        for row in rows:
            if len(row) < 4:
                continue
            code_match = route_code.search(row[0])
            if not code_match:
                continue
            route = clean_text(route_code.sub("", row[0]))
            miles = parse_miles(row[1])
            if miles is None:
                continue
            offers.append(
                make_offer(
                    airline="Scoot",
                    airline_code="TR",
                    region=table.heading,
                    route=route,
                    miles=miles,
                    cabin_class="Economy",
                    flight_numbers=parse_flight_numbers(row[2]),
                    blackout_period=row[3],
                    origin_code=code_match.group(1),
                    destination_code=code_match.group(2),
                )
            )
    return deduplicate_offers(offers)


SCOOT_CODE_LINE = re.compile(r"\*\*([A-Z]{3})\s*-\s*([A-Z]{3})\*\*(.*)")


def looks_like_scoot_data_continuation(line: str) -> bool:
    return bool(re.match(r"^(?:\d|TR\s*\d|All\b|-\s*$)", line, flags=re.IGNORECASE))


def parse_scoot_payload(payload: str) -> tuple[int, list[str], str | None]:
    payload = clean_text(payload)
    miles_match = re.match(r"([0-9][0-9,]*)\s*(.*)$", payload)
    if not miles_match:
        raise ValueError(f"Could not parse Scoot row payload: {payload!r}")
    miles = int(miles_match.group(1).replace(",", ""))
    remainder = miles_match.group(2).strip()
    date_match = re.search(
        r"\b\d{1,2}\s*(?:-|–|—)?\s*(?:\d{1,2}\s+)?"
        r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)",
        remainder,
        flags=re.IGNORECASE,
    )
    if date_match:
        flight_text = remainder[: date_match.start()].strip()
        blackout = remainder[date_match.start() :].strip()
    else:
        flight_text = remainder[:-1].strip() if remainder.endswith("-") else remainder
        blackout = None
    return miles, parse_flight_numbers(flight_text), blackout


def parse_scoot_markdown(markdown: str) -> list[dict]:
    match = re.search(r"## Travel Destinations(.*?)(?:## How to Redeem|\Z)", markdown, re.DOTALL)
    if not match:
        return []

    lines = [line.strip() for line in match.group(1).splitlines()]
    region = ""
    pending_route: list[str] = []
    current: dict | None = None
    offers: list[dict] = []

    def finish_current() -> None:
        nonlocal current
        if not current:
            return
        miles, flights, blackout = parse_scoot_payload(" ".join(current["payload"]))
        offers.append(
            make_offer(
                airline="Scoot",
                airline_code="TR",
                region=current["region"],
                route=current["route"],
                miles=miles,
                cabin_class="Economy",
                flight_numbers=flights,
                blackout_period=blackout,
                origin_code=current["origin_code"],
                destination_code=current["destination_code"],
            )
        )
        current = None

    for line in lines:
        if not line:
            continue
        if line.startswith("### "):
            finish_current()
            region = clean_text(line[4:])
            pending_route = []
            continue
        if line.startswith(("From Miles Required", "Scoot Economy Flight No.")):
            pending_route = []
            continue
        code_match = SCOOT_CODE_LINE.match(line)
        if code_match:
            finish_current()
            route = clean_text(" ".join(pending_route))
            pending_route = []
            current = {
                "region": region,
                "route": route,
                "origin_code": code_match.group(1),
                "destination_code": code_match.group(2),
                "payload": [code_match.group(3)],
            }
            continue
        if current and looks_like_scoot_data_continuation(line):
            current["payload"].append(line)
        elif not line.startswith(("[", "*", "↑")):
            pending_route.append(line)

    finish_current()
    return deduplicate_offers(offers)


def deduplicate_offers(offers: Iterable[dict]) -> list[dict]:
    by_id: dict[str, dict] = {}
    for offer in offers:
        by_id[offer["id"]] = offer
    return sorted(
        by_id.values(),
        key=lambda offer: (
            offer["airline"],
            offer["region"],
            offer["origin"],
            offer["destination"],
            offer["cabin_class"],
        ),
    )


def named_date(value: str) -> str:
    match = re.match(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})", clean_text(value))
    if not match:
        raise ValueError(f"Invalid date: {value}")
    year = int(match.group(3))
    if year < 100:
        year += 2000
    month = MONTHS[match.group(2).lower()]
    return date(year, month, int(match.group(1))).isoformat()


def extract_promotion_windows(text: str) -> dict:
    text = clean_text(text.replace("*", ""))
    booking = re.search(
        r"(?:tickets|flights) must be (?:issued|redeemed)\s+(?:between\s+){1,2}"
        r"(\d{1,2}\s+[A-Za-z]+\s+\d{2,4}).{0,180}?\band\s+"
        r"(\d{1,2}\s+[A-Za-z]+\s+\d{2,4})",
        text,
        flags=re.IGNORECASE,
    )
    travel = re.search(
        r"for travel (?:from|between)\s+(\d{1,2}\s+[A-Za-z]+\s+\d{2,4})"
        r".{0,180}?(?:\bto\b|\band\b)\s+(\d{1,2}\s+[A-Za-z]+\s+\d{2,4})",
        text,
        flags=re.IGNORECASE,
    )
    result: dict[str, dict[str, str]] = {}
    if booking:
        result["booking_window"] = {
            "start": named_date(booking.group(1)),
            "end": named_date(booking.group(2)),
        }
    if travel:
        result["travel_window"] = {
            "start": named_date(travel.group(1)),
            "end": named_date(travel.group(2)),
        }
    return result


def build_document(
    offers: list[dict], source_records: list[dict], source_texts: list[str], generated_at: str
) -> dict:
    windows: dict = {}
    for source_text in source_texts:
        windows.update(extract_promotion_windows(source_text))
    airlines = sorted({offer["airline"] for offer in offers})
    cabins = sorted({offer["cabin_class"] for offer in offers})
    return {
        "schema_version": 1,
        "generated_at": generated_at,
        "promotion": {
            "name": "KrisFlyer Spontaneous Escapes",
            "currency": "KrisFlyer miles",
            "pricing_basis": "per person, one-way",
            **windows,
        },
        "summary": {
            "offer_count": len(offers),
            "airlines": airlines,
            "cabin_classes": cabins,
        },
        "sources": source_records,
        "offers": offers,
    }


def scrape(args: argparse.Namespace) -> dict:
    retrieved_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    offers: list[dict] = []
    sources: list[dict] = []
    source_texts: list[str] = []

    if args.source in {"all", "singapore-airlines"}:
        sia_html = read_or_fetch(args.sia_input, SIA_URL, args.timeout)
        sia_offers = parse_sia_html(sia_html)
        if not sia_offers:
            raise RuntimeError("Singapore Airlines page returned no recognised offer rows")
        offers.extend(sia_offers)
        source_texts.append(html_to_text(sia_html))
        sources.append(
            {
                "airline": "Singapore Airlines",
                "url": SIA_URL,
                "retrieved_at": retrieved_at,
                "access_method": "local file" if args.sia_input else "direct",
                "offer_count": len(sia_offers),
            }
        )

    if args.source in {"all", "scoot"}:
        scoot_content = ""
        access_method = "local file" if args.scoot_input else "direct"
        if args.scoot_input:
            scoot_content = read_or_fetch(args.scoot_input, SCOOT_URL, args.timeout)
        else:
            try:
                scoot_content = fetch_text(SCOOT_URL, args.timeout, attempts=1)
            except RuntimeError:
                if args.no_scoot_fallback:
                    raise
                scoot_content = fetch_text(SCOOT_READER_URL, args.timeout)
                access_method = "Jina Reader fallback"

        if "<html" in scoot_content[:1000].lower():
            scoot_offers = parse_scoot_html(scoot_content)
            source_text = html_to_text(scoot_content)
        else:
            scoot_offers = parse_scoot_markdown(scoot_content)
            source_text = scoot_content

        if not scoot_offers and not args.no_scoot_fallback and access_method == "direct":
            scoot_content = fetch_text(SCOOT_READER_URL, args.timeout)
            scoot_offers = parse_scoot_markdown(scoot_content)
            source_text = scoot_content
            access_method = "Jina Reader fallback"
        if not scoot_offers:
            raise RuntimeError("Scoot page returned no recognised offer rows")
        offers.extend(scoot_offers)
        source_texts.append(source_text)
        sources.append(
            {
                "airline": "Scoot",
                "url": SCOOT_URL,
                "retrieved_at": retrieved_at,
                "access_method": access_method,
                "offer_count": len(scoot_offers),
            }
        )

    offers = deduplicate_offers(offers)
    return build_document(offers, sources, source_texts, retrieved_at)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        default=str(Path(__file__).resolve().parents[1] / "data" / "spontaneous-escapes.json"),
        help="JSON output path (default: project data directory)",
    )
    parser.add_argument(
        "--source",
        choices=("all", "singapore-airlines", "scoot"),
        default="all",
        help="Limit the scrape to one airline",
    )
    parser.add_argument("--sia-input", help="Parse a local Singapore Airlines HTML file")
    parser.add_argument("--scoot-input", help="Parse a local Scoot HTML or Reader Markdown file")
    parser.add_argument("--timeout", type=float, default=30, help="Per-request timeout in seconds")
    parser.add_argument(
        "--no-scoot-fallback",
        action="store_true",
        help="Fail instead of using the Jina Reader fallback when Scoot blocks direct access",
    )
    parser.add_argument("--compact", action="store_true", help="Write compact JSON")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        document = scrape(args)
        output = Path(args.output).resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("w", encoding="utf-8") as handle:
            json.dump(
                document,
                handle,
                ensure_ascii=False,
                indent=None if args.compact else 2,
                separators=(",", ":") if args.compact else None,
            )
            handle.write("\n")
        print(f"Wrote {document['summary']['offer_count']} offers to {output}")
        return 0
    except (OSError, RuntimeError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
