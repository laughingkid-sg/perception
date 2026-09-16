import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "scraper"))

from scrape import expand_blackout_dates, parse_scoot_markdown, parse_sia_html  # noqa: E402


class ScraperTests(unittest.TestCase):
    def test_sia_parser_expands_each_available_cabin(self):
        html = """
        <h3>South East Asia</h3>
        <table>
          <thead><tr>
            <th>FROM</th><th>MILES REQUIRED FOR ECONOMY CLASS</th>
            <th>FLIGHT NO.</th><th>BLACKOUT PERIOD</th>
            <th>MILES REQUIRED FOR BUSINESS CLASS</th>
            <th>FLIGHT NO.</th><th>BLACKOUT PERIOD</th>
          </tr></thead>
          <tbody><tr>
            <td>Singapore to Denpasar</td><td>5,600</td><td>SQ948</td>
            <td>1 – 3 October, 9 October 2026</td>
            <td>15,400</td><td>SQ934, SQ948</td><td>-</td>
          </tr></tbody>
        </table>
        """
        offers = parse_sia_html(html)
        self.assertEqual(2, len(offers))
        economy = next(offer for offer in offers if offer["cabin_class"] == "Economy")
        self.assertEqual(5600, economy["miles_required"])
        self.assertEqual(["SQ948"], economy["flight_numbers"])
        self.assertNotIn("ticket_type", economy)
        self.assertNotIn("trip_pricing_basis", economy)
        self.assertNotIn("source_url", economy)
        self.assertEqual(
            ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-09"],
            economy["blackout_dates"],
        )

    def test_scoot_reader_parser_handles_wrapped_routes_and_flights(self):
        markdown = """
        ## Travel Destinations
        ### Indonesia
        From Miles Required for
        Scoot Economy Flight No.Blackout Period
        Singapore to Denpasar (Bali)
        **SIN - DPS**3,825 TR280, TR282,
        TR346 1 - 3 Oct 26
        Belitung (Tanjung Pandan)
        to Singapore
        **TJQ - SIN**2,125 All-
        ## How to Redeem
        """
        offers = parse_scoot_markdown(markdown)
        self.assertEqual(2, len(offers))
        denpasar = next(offer for offer in offers if offer["destination_code"] == "DPS")
        self.assertEqual(["TR280", "TR282", "TR346"], denpasar["flight_numbers"])
        self.assertEqual(["2026-10-01", "2026-10-02", "2026-10-03"], denpasar["blackout_dates"])
        belitung = next(offer for offer in offers if offer["origin_code"] == "TJQ")
        self.assertEqual("Belitung (Tanjung Pandan)", belitung["origin"])
        self.assertEqual(["All"], belitung["flight_numbers"])
        self.assertIsNone(belitung["blackout_period"])

    def test_blackout_date_parser_supports_long_and_short_months(self):
        self.assertEqual(
            ["2026-10-23", "2026-10-24", "2026-10-25"],
            expand_blackout_dates("23 – 25 October 2026"),
        )
        self.assertEqual(
            ["2026-10-30", "2026-10-31"],
            expand_blackout_dates("30 - 31 OCt 26"),
        )


if __name__ == "__main__":
    unittest.main()
