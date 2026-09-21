import copy
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "scraper"))

from validate_refresh import compare_documents, normalized_document, validate_document  # noqa: E402


def make_document(sq_count=2, scoot_count=2):
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    offers = []
    for airline, code, count in (
        ("Singapore Airlines", "SQ", sq_count),
        ("Scoot", "TR", scoot_count),
    ):
        for index in range(count):
            offers.append(
                {
                    "id": f"{code.lower()}-route-{index}-economy",
                    "airline": airline,
                    "airline_code": code,
                    "region": "Test region",
                    "origin": "Singapore",
                    "origin_code": "SIN" if code == "TR" else None,
                    "destination": f"Destination {index}",
                    "destination_code": "DPS" if code == "TR" else None,
                    "miles_required": 5000 + index,
                    "cabin_class": "Economy",
                    "flight_numbers": [f"{code}{100 + index}"],
                    "blackout_period": None,
                    "blackout_dates": [],
                }
            )
    return {
        "schema_version": 1,
        "generated_at": generated_at,
        "promotion": {
            "name": "KrisFlyer Spontaneous Escapes",
            "currency": "KrisFlyer miles",
            "pricing_basis": "per person, one-way",
            "booking_window": {"start": "2026-09-15", "end": "2026-09-30"},
            "travel_window": {"start": "2026-10-01", "end": "2026-10-31"},
        },
        "summary": {
            "offer_count": len(offers),
            "airlines": ["Scoot", "Singapore Airlines"],
            "cabin_classes": ["Economy"],
        },
        "sources": [
            {
                "airline": "Singapore Airlines",
                "url": "https://example.com/sia",
                "retrieved_at": generated_at,
                "access_method": "direct",
                "offer_count": sq_count,
            },
            {
                "airline": "Scoot",
                "url": "https://example.com/scoot",
                "retrieved_at": generated_at,
                "access_method": "direct",
                "offer_count": scoot_count,
            },
        ],
        "offers": offers,
    }


class RefreshValidationTests(unittest.TestCase):
    def test_valid_document_passes_source_and_schema_checks(self):
        validate_document(make_document(), "candidate")

    def test_metadata_only_refresh_is_not_material(self):
        current = make_document()
        candidate = copy.deepcopy(current)
        candidate["generated_at"] = "2026-09-21T01:00:00+00:00"
        for source in candidate["sources"]:
            source["retrieved_at"] = candidate["generated_at"]
            source["access_method"] = "Jina Reader fallback"
        self.assertEqual(normalized_document(current), normalized_document(candidate))
        self.assertFalse(compare_documents(current, candidate, False)["changed"])

    def test_offer_change_is_reported(self):
        current = make_document()
        candidate = copy.deepcopy(current)
        candidate["offers"][0]["miles_required"] = 7500
        result = compare_documents(current, candidate, False)
        self.assertTrue(result["changed"])
        self.assertEqual(1, result["changed_offers"])

    def test_missing_airline_source_is_rejected(self):
        candidate = make_document()
        candidate["sources"].pop()
        with self.assertRaisesRegex(ValueError, "both airline sources"):
            validate_document(candidate, "candidate")

    def test_large_source_drop_requires_explicit_override(self):
        current = make_document(sq_count=4, scoot_count=4)
        candidate = make_document(sq_count=1, scoot_count=4)
        with self.assertRaisesRegex(ValueError, "offer count fell"):
            compare_documents(current, candidate, False)
        self.assertTrue(compare_documents(current, candidate, True)["large_drop_override"])


if __name__ == "__main__":
    unittest.main()
