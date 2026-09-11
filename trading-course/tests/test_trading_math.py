import json
import subprocess
import sys
import unittest
from decimal import Decimal
from pathlib import Path

from tools.trading_math import analyze_trades, bootstrap_mean_r, calculate_position_size


COURSE_ROOT = Path(__file__).resolve().parents[1]
SAMPLE_PATH = COURSE_ROOT / "resources" / "sample-trades.json"


def sample_records():
    return json.loads(SAMPLE_PATH.read_text(encoding="utf-8"))


class PositionSizingTests(unittest.TestCase):
    def base_size(self, **overrides):
        values = {
            "equity": 10_000,
            "entry": 100,
            "stop": 96,
            "risk_fraction": "0.005",
            "name_cap_fraction": "0.10",
            "cash": 10_000,
        }
        values.update(overrides)
        return calculate_position_size(**values)

    def test_lesson_example_is_ten_shares_with_name_cap_binding(self):
        result = self.base_size()
        self.assertEqual(result["shares"], 10)
        self.assertEqual(result["binding_caps"], ["name_cap"])
        self.assertEqual(result["initial_price_risk_usd"], Decimal("40"))
        self.assertEqual(result["notional_usd"], Decimal("1000.00"))

    def test_risk_cap_can_bind(self):
        result = self.base_size(entry=50, stop=40, name_cap_fraction="1")
        self.assertEqual(result["shares"], 5)
        self.assertEqual(result["binding_caps"], ["risk"])

    def test_cash_cap_can_bind(self):
        result = self.base_size(cash=350, name_cap_fraction="1")
        self.assertEqual(result["shares"], 3)
        self.assertEqual(result["binding_caps"], ["cash"])

    def test_tied_caps_are_all_reported(self):
        result = self.base_size(cash=1000)
        self.assertEqual(result["binding_caps"], ["name_cap", "cash"])

    def test_costs_reduce_risk_limited_share_count(self):
        result = self.base_size(
            entry=50,
            stop=46,
            name_cap_fraction="1",
            fixed_round_trip_cost=2,
            per_share_round_trip_friction="0.10",
        )
        self.assertEqual(result["shares"], 11)
        self.assertLessEqual(result["modeled_total_loss_usd"], result["risk_budget_usd"])

    def test_entry_cost_is_included_in_cash_cap(self):
        result = self.base_size(
            cash=1000,
            name_cap_fraction="1",
            entry_fixed_cost=5,
            entry_per_share_cost=1,
        )
        self.assertEqual(result["shares"], 9)
        self.assertEqual(result["cash_required_usd"], Decimal("914"))

    def test_cash_too_small_returns_zero_shares_without_cost(self):
        result = self.base_size(cash=99)
        self.assertEqual(result["shares"], 0)
        self.assertEqual(result["cash_required_usd"], Decimal(0))
        self.assertEqual(result["modeled_total_loss_usd"], Decimal(0))

    def test_stop_equal_to_entry_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "stop must be below entry"):
            self.base_size(stop=100)

    def test_stop_above_entry_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "stop must be below entry"):
            self.base_size(stop=101)

    def test_negative_fee_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "cannot be negative"):
            self.base_size(fixed_round_trip_cost=-1)

    def test_nonpositive_price_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "greater than zero"):
            self.base_size(entry=0)

    def test_fraction_above_one_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "cannot exceed 1"):
            self.base_size(risk_fraction="1.01")

    def test_nonfinite_input_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "finite number"):
            self.base_size(equity="NaN")


class TradeAnalysisTests(unittest.TestCase):
    def test_sample_summary_matches_hand_calculation(self):
        result = analyze_trades(sample_records())
        self.assertEqual(result["trade_count"], 6)
        self.assertEqual(result["win_count"], 3)
        self.assertEqual(result["loss_count"], 3)
        self.assertEqual(result["mean_net_r"], Decimal("0.5"))
        self.assertEqual(result["win_rate"], Decimal("0.5"))
        self.assertEqual(result["average_win_r"], Decimal("2"))
        self.assertEqual(result["average_loss_r"], Decimal("-1"))
        self.assertEqual(result["payoff_ratio"], Decimal("2"))
        self.assertEqual(result["r_profit_factor"], Decimal("2"))
        self.assertEqual(result["total_net_pnl_usd"], Decimal("120"))
        self.assertEqual(result["maximum_cumulative_r_drawdown"], Decimal("2"))

    def test_fixed_initial_risk_handles_different_dollar_risks(self):
        records = [
            {"initial_price_risk_usd": 20, "net_pnl_usd": 20},
            {"initial_price_risk_usd": 50, "net_pnl_usd": -25},
        ]
        result = analyze_trades(records)
        self.assertEqual(result["r_values"], [Decimal("1"), Decimal("-0.5")])
        self.assertEqual(result["mean_net_r"], Decimal("0.25"))

    def test_zero_loss_sample_has_undefined_profit_factor(self):
        records = [{"initial_price_risk_usd": 10, "net_pnl_usd": 10}]
        result = analyze_trades(records)
        self.assertIsNone(result["average_loss_r"])
        self.assertIsNone(result["r_profit_factor"])

    def test_all_flat_sample_has_explicit_flat_count(self):
        records = [{"initial_price_risk_usd": 10, "net_pnl_usd": 0}]
        result = analyze_trades(records)
        self.assertEqual(result["flat_count"], 1)
        self.assertEqual(result["mean_net_r"], Decimal(0))
        self.assertIsNone(result["payoff_ratio"])

    def test_drawdown_starts_from_zero(self):
        records = [
            {"initial_price_risk_usd": 10, "net_pnl_usd": -10},
            {"initial_price_risk_usd": 10, "net_pnl_usd": 5},
        ]
        result = analyze_trades(records)
        self.assertEqual(result["maximum_cumulative_r_drawdown"], Decimal("1"))

    def test_empty_journal_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "non-empty JSON array"):
            analyze_trades([])

    def test_missing_risk_field_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "missing initial_price_risk_usd"):
            analyze_trades([{"net_pnl_usd": 10}])

    def test_non_object_record_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "record 0 must be an object"):
            analyze_trades(["not-a-record"])

    def test_zero_initial_risk_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "greater than zero"):
            analyze_trades([{"initial_price_risk_usd": 0, "net_pnl_usd": 10}])


class BootstrapAndCommandLineTests(unittest.TestCase):
    def test_bootstrap_is_deterministic_for_a_seed(self):
        first = bootstrap_mean_r(sample_records(), draws=100, seed=42)
        second = bootstrap_mean_r(sample_records(), draws=100, seed=42)
        self.assertEqual(first, second)
        self.assertLessEqual(
            first["bootstrap_mean_r_p2_5"], first["bootstrap_mean_r_p97_5"]
        )

    def test_bootstrap_rejects_nonpositive_draw_count(self):
        with self.assertRaisesRegex(ValueError, "positive integer"):
            bootstrap_mean_r(sample_records(), draws=0)

    def test_single_trade_bootstrap_has_equal_bounds(self):
        records = [{"initial_price_risk_usd": 10, "net_pnl_usd": 5}]
        result = bootstrap_mean_r(records, draws=10, seed=1)
        self.assertEqual(result["bootstrap_mean_r_p2_5"], Decimal("0.5"))
        self.assertEqual(result["bootstrap_mean_r_median"], Decimal("0.5"))
        self.assertEqual(result["bootstrap_mean_r_p97_5"], Decimal("0.5"))

    def test_analyze_command_emits_json(self):
        command = [
            sys.executable,
            str(COURSE_ROOT / "tools" / "trading_math.py"),
            "analyze",
            str(SAMPLE_PATH),
        ]
        result = subprocess.run(command, check=True, capture_output=True, text=True)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["trade_count"], 6)
        self.assertEqual(payload["maximum_cumulative_r_drawdown"], 2.0)

    def test_size_command_emits_json(self):
        command = [
            sys.executable,
            str(COURSE_ROOT / "tools" / "trading_math.py"),
            "size",
            "--equity",
            "10000",
            "--entry",
            "100",
            "--stop",
            "96",
            "--risk-fraction",
            "0.005",
            "--name-cap-fraction",
            "0.10",
            "--cash",
            "10000",
        ]
        result = subprocess.run(command, check=True, capture_output=True, text=True)
        self.assertEqual(json.loads(result.stdout)["shares"], 10)


if __name__ == "__main__":
    unittest.main()
