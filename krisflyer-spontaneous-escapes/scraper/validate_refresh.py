#!/usr/bin/env python3
"""Validate and summarize a candidate Spontaneous Escapes data refresh."""

from __future__ import annotations

import argparse
import copy
import json
from datetime import date, datetime
from pathlib import Path


EXPECTED_AIRLINES = {"Scoot", "Singapore Airlines"}
MINIMUM_SOURCE_RETENTION = 0.5


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def parse_date(value: object, field: str) -> date:
    require(isinstance(value, str), f"{field} must be an ISO date string")
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f"{field} must be a valid ISO date") from error


def parse_timestamp(value: object, field: str) -> datetime:
    require(isinstance(value, str), f"{field} must be an ISO timestamp")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f"{field} must be a valid ISO timestamp") from error
    require(parsed.tzinfo is not None, f"{field} must include a timezone")
    return parsed


def validate_window(window: object, field: str) -> tuple[date, date]:
    require(isinstance(window, dict), f"{field} is missing")
    start = parse_date(window.get("start"), f"{field}.start")
    end = parse_date(window.get("end"), f"{field}.end")
    require(start <= end, f"{field}.start must not be after its end")
    return start, end


def validate_document(document: object, label: str) -> None:
    require(isinstance(document, dict), f"{label} must be a JSON object")
    require(document.get("schema_version") == 1, f"{label} has an unsupported schema_version")
    parse_timestamp(document.get("generated_at"), f"{label}.generated_at")

    promotion = document.get("promotion")
    require(isinstance(promotion, dict), f"{label}.promotion is missing")
    booking_start, booking_end = validate_window(
        promotion.get("booking_window"), f"{label}.promotion.booking_window"
    )
    travel_start, travel_end = validate_window(
        promotion.get("travel_window"), f"{label}.promotion.travel_window"
    )
    require(booking_start <= travel_end, f"{label} booking window is after the travel window")
    require(booking_end <= travel_end, f"{label} booking window ends after the travel window")

    offers = document.get("offers")
    require(isinstance(offers, list) and offers, f"{label}.offers must not be empty")
    offer_ids: set[str] = set()
    airline_counts = {airline: 0 for airline in EXPECTED_AIRLINES}
    cabin_classes: set[str] = set()

    required_text_fields = ("id", "airline", "airline_code", "region", "origin", "destination", "cabin_class")
    for index, offer in enumerate(offers):
        prefix = f"{label}.offers[{index}]"
        require(isinstance(offer, dict), f"{prefix} must be an object")
        for field in required_text_fields:
            require(
                isinstance(offer.get(field), str) and bool(offer[field].strip()),
                f"{prefix}.{field} must be a non-empty string",
            )
        offer_id = offer["id"]
        require(offer_id not in offer_ids, f"{label} contains duplicate offer id {offer_id!r}")
        offer_ids.add(offer_id)

        airline = offer["airline"]
        require(airline in EXPECTED_AIRLINES, f"{prefix}.airline is not recognised")
        airline_counts[airline] += 1
        cabin_classes.add(offer["cabin_class"])

        miles = offer.get("miles_required")
        require(
            isinstance(miles, int) and not isinstance(miles, bool) and miles > 0,
            f"{prefix}.miles_required must be a positive integer",
        )
        flights = offer.get("flight_numbers")
        require(
            isinstance(flights, list)
            and bool(flights)
            and all(isinstance(flight, str) and flight.strip() for flight in flights),
            f"{prefix}.flight_numbers must contain at least one flight",
        )
        for code_field in ("origin_code", "destination_code"):
            code = offer.get(code_field)
            require(
                code is None
                or (isinstance(code, str) and len(code) == 3 and code.isalpha() and code.isupper()),
                f"{prefix}.{code_field} must be null or a three-letter uppercase code",
            )

        blackout_dates = offer.get("blackout_dates")
        require(isinstance(blackout_dates, list), f"{prefix}.blackout_dates must be a list")
        require(
            blackout_dates == sorted(set(blackout_dates)),
            f"{prefix}.blackout_dates must be sorted and unique",
        )
        for blackout_index, value in enumerate(blackout_dates):
            blackout = parse_date(value, f"{prefix}.blackout_dates[{blackout_index}]")
            require(
                travel_start <= blackout <= travel_end,
                f"{prefix} contains a blackout date outside the travel window",
            )

    summary = document.get("summary")
    require(isinstance(summary, dict), f"{label}.summary is missing")
    require(summary.get("offer_count") == len(offers), f"{label}.summary.offer_count is incorrect")
    require(summary.get("airlines") == sorted(EXPECTED_AIRLINES), f"{label}.summary.airlines is incorrect")
    require(summary.get("cabin_classes") == sorted(cabin_classes), f"{label}.summary.cabin_classes is incorrect")

    sources = document.get("sources")
    require(isinstance(sources, list), f"{label}.sources must be a list")
    source_by_airline: dict[str, dict] = {}
    for index, source in enumerate(sources):
        prefix = f"{label}.sources[{index}]"
        require(isinstance(source, dict), f"{prefix} must be an object")
        airline = source.get("airline")
        require(airline in EXPECTED_AIRLINES, f"{prefix}.airline is not recognised")
        require(airline not in source_by_airline, f"{label} contains duplicate source {airline!r}")
        require(isinstance(source.get("url"), str) and source["url"], f"{prefix}.url is missing")
        parse_timestamp(source.get("retrieved_at"), f"{prefix}.retrieved_at")
        require(
            source.get("offer_count") == airline_counts[airline],
            f"{prefix}.offer_count does not match parsed offers",
        )
        source_by_airline[airline] = source
    require(set(source_by_airline) == EXPECTED_AIRLINES, f"{label} must contain both airline sources")


def normalized_document(document: dict) -> dict:
    normalized = copy.deepcopy(document)
    normalized.pop("generated_at", None)
    for source in normalized.get("sources", []):
        source.pop("retrieved_at", None)
        source.pop("access_method", None)
    normalized["sources"] = sorted(normalized.get("sources", []), key=lambda item: item["airline"])
    normalized["offers"] = sorted(normalized.get("offers", []), key=lambda item: item["id"])
    return normalized


def source_counts(document: dict) -> dict[str, int]:
    return {source["airline"]: source["offer_count"] for source in document["sources"]}


def compare_documents(current: dict, candidate: dict, allow_large_drop: bool) -> dict:
    current_travel_start, _ = validate_window(
        current["promotion"]["travel_window"], "current.promotion.travel_window"
    )
    candidate_travel_start, _ = validate_window(
        candidate["promotion"]["travel_window"], "candidate.promotion.travel_window"
    )
    require(candidate_travel_start >= current_travel_start, "candidate travel window regresses")

    current_counts = source_counts(current)
    candidate_counts = source_counts(candidate)
    if not allow_large_drop:
        for airline in sorted(EXPECTED_AIRLINES):
            minimum = max(1, int(current_counts[airline] * MINIMUM_SOURCE_RETENTION))
            require(
                candidate_counts[airline] >= minimum,
                f"{airline} offer count fell from {current_counts[airline]} to "
                f"{candidate_counts[airline]}; rerun with --allow-large-drop only after review",
            )

    current_offers = {offer["id"]: offer for offer in current["offers"]}
    candidate_offers = {offer["id"]: offer for offer in candidate["offers"]}
    added = candidate_offers.keys() - current_offers.keys()
    removed = current_offers.keys() - candidate_offers.keys()
    changed = {
        offer_id
        for offer_id in current_offers.keys() & candidate_offers.keys()
        if current_offers[offer_id] != candidate_offers[offer_id]
    }
    materially_changed = normalized_document(current) != normalized_document(candidate)
    refresh_key = candidate["promotion"]["travel_window"]["start"][:7]

    return {
        "changed": materially_changed,
        "refresh_key": refresh_key,
        "added_offers": len(added),
        "removed_offers": len(removed),
        "changed_offers": len(changed),
        "current_offer_count": len(current_offers),
        "candidate_offer_count": len(candidate_offers),
        "current_source_counts": current_counts,
        "candidate_source_counts": candidate_counts,
        "large_drop_override": allow_large_drop,
    }


def render_report(current: dict, candidate: dict, result: dict) -> str:
    old_booking = current["promotion"]["booking_window"]
    new_booking = candidate["promotion"]["booking_window"]
    old_travel = current["promotion"]["travel_window"]
    new_travel = candidate["promotion"]["travel_window"]
    lines = [
        "## KrisFlyer refresh summary",
        "",
        "| Check | Current | Candidate |",
        "| --- | ---: | ---: |",
        f"| Total offers | {result['current_offer_count']} | {result['candidate_offer_count']} |",
    ]
    for airline in sorted(EXPECTED_AIRLINES):
        lines.append(
            f"| {airline} offers | {result['current_source_counts'][airline]} | "
            f"{result['candidate_source_counts'][airline]} |"
        )
    lines.extend(
        [
            f"| Booking window | {old_booking['start']} to {old_booking['end']} | "
            f"{new_booking['start']} to {new_booking['end']} |",
            f"| Travel window | {old_travel['start']} to {old_travel['end']} | "
            f"{new_travel['start']} to {new_travel['end']} |",
            "",
            f"- Added offers: **{result['added_offers']}**",
            f"- Removed offers: **{result['removed_offers']}**",
            f"- Changed offers: **{result['changed_offers']}**",
            f"- Material JSON change: **{'yes' if result['changed'] else 'no'}**",
            "- Schema and source reconciliation: **passed**",
        ]
    )
    if result["large_drop_override"]:
        lines.append("- Large-drop safety guard: **manually overridden**")
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("current", type=Path)
    parser.add_argument("candidate", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--result", type=Path, required=True)
    parser.add_argument("--allow-large-drop", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        current = json.loads(args.current.read_text(encoding="utf-8"))
        candidate = json.loads(args.candidate.read_text(encoding="utf-8"))
        validate_document(current, "current")
        validate_document(candidate, "candidate")
        result = compare_documents(current, candidate, args.allow_large_drop)
        args.report.write_text(render_report(current, candidate, result), encoding="utf-8")
        args.result.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(f"Validated {result['candidate_offer_count']} candidate offers")
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"error: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
