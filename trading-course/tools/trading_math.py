#!/usr/bin/env python3
"""Small, offline calculations used by Lesson 27.

This module does not fetch market data, connect to a broker, or place orders.
Inputs are explicit so that each result can be reproduced by hand.
"""

from __future__ import annotations

import argparse
import json
import random
from decimal import Decimal, InvalidOperation, ROUND_FLOOR
from pathlib import Path
from typing import Any, Iterable, Sequence


def _decimal(value: Any, name: str) -> Decimal:
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError) as error:
        raise ValueError(f"{name} must be a finite number") from error
    if not number.is_finite():
        raise ValueError(f"{name} must be a finite number")
    return number


def _positive(value: Any, name: str) -> Decimal:
    number = _decimal(value, name)
    if number <= 0:
        raise ValueError(f"{name} must be greater than zero")
    return number


def _nonnegative(value: Any, name: str) -> Decimal:
    number = _decimal(value, name)
    if number < 0:
        raise ValueError(f"{name} cannot be negative")
    return number


def _fraction(value: Any, name: str) -> Decimal:
    number = _positive(value, name)
    if number > 1:
        raise ValueError(f"{name} cannot exceed 1")
    return number


def _whole_shares(value: Decimal) -> int:
    if value <= 0:
        return 0
    return int(value.to_integral_value(rounding=ROUND_FLOOR))


def calculate_position_size(
    *,
    equity: Any,
    entry: Any,
    stop: Any,
    risk_fraction: Any,
    name_cap_fraction: Any,
    cash: Any,
    fixed_round_trip_cost: Any = 0,
    per_share_round_trip_friction: Any = 0,
    entry_fixed_cost: Any = 0,
    entry_per_share_cost: Any = 0,
) -> dict[str, Any]:
    """Calculate whole shares under risk, name-notional and cash caps."""

    equity_d = _positive(equity, "equity")
    entry_d = _positive(entry, "entry")
    stop_d = _positive(stop, "stop")
    if stop_d >= entry_d:
        raise ValueError("stop must be below entry for a long position")
    risk_fraction_d = _fraction(risk_fraction, "risk_fraction")
    name_cap_fraction_d = _fraction(name_cap_fraction, "name_cap_fraction")
    cash_d = _nonnegative(cash, "cash")
    fixed_round_trip_cost_d = _nonnegative(
        fixed_round_trip_cost, "fixed_round_trip_cost"
    )
    per_share_round_trip_friction_d = _nonnegative(
        per_share_round_trip_friction, "per_share_round_trip_friction"
    )
    entry_fixed_cost_d = _nonnegative(entry_fixed_cost, "entry_fixed_cost")
    entry_per_share_cost_d = _nonnegative(
        entry_per_share_cost, "entry_per_share_cost"
    )

    risk_budget = equity_d * risk_fraction_d
    price_risk_per_share = entry_d - stop_d
    modeled_loss_per_share = price_risk_per_share + per_share_round_trip_friction_d
    risk_shares = _whole_shares(
        (risk_budget - fixed_round_trip_cost_d) / modeled_loss_per_share
    )

    name_cap = equity_d * name_cap_fraction_d
    name_cap_shares = _whole_shares(name_cap / entry_d)

    entry_cash_per_share = entry_d + entry_per_share_cost_d
    cash_shares = _whole_shares(
        (cash_d - entry_fixed_cost_d) / entry_cash_per_share
    )

    candidates = {
        "risk": risk_shares,
        "name_cap": name_cap_shares,
        "cash": cash_shares,
    }
    shares = min(candidates.values())
    binding_caps = [name for name, value in candidates.items() if value == shares]
    initial_price_risk = price_risk_per_share * shares
    modeled_total_loss = (
        modeled_loss_per_share * shares + fixed_round_trip_cost_d
        if shares
        else Decimal(0)
    )
    cash_required = (
        entry_cash_per_share * shares + entry_fixed_cost_d
        if shares
        else Decimal(0)
    )

    return {
        "shares": shares,
        "binding_caps": binding_caps,
        "risk_budget_usd": risk_budget,
        "risk_per_share_usd": price_risk_per_share,
        "modeled_loss_per_share_usd": modeled_loss_per_share,
        "initial_price_risk_usd": initial_price_risk,
        "modeled_total_loss_usd": modeled_total_loss,
        "name_cap_usd": name_cap,
        "notional_usd": entry_d * shares,
        "cash_required_usd": cash_required,
        "unused_risk_budget_usd": risk_budget - modeled_total_loss,
        "share_caps": candidates,
    }


def _r_values(records: Sequence[dict[str, Any]]) -> list[Decimal]:
    if not isinstance(records, list) or not records:
        raise ValueError("records must be a non-empty JSON array")
    values: list[Decimal] = []
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            raise ValueError(f"record {index} must be an object")
        try:
            risk = _positive(record["initial_price_risk_usd"], "initial_price_risk_usd")
            pnl = _decimal(record["net_pnl_usd"], "net_pnl_usd")
        except KeyError as error:
            raise ValueError(f"record {index} is missing {error.args[0]}") from error
        values.append(pnl / risk)
    return values


def _maximum_drawdown(values: Iterable[Decimal]) -> Decimal:
    cumulative = Decimal(0)
    peak = Decimal(0)
    maximum = Decimal(0)
    for value in values:
        cumulative += value
        peak = max(peak, cumulative)
        maximum = max(maximum, peak - cumulative)
    return maximum


def analyze_trades(records: Sequence[dict[str, Any]]) -> dict[str, Any]:
    """Summarize closed trades using the fixed initial-risk denominator."""

    values = _r_values(records)
    wins = [value for value in values if value > 0]
    losses = [value for value in values if value < 0]
    flats = [value for value in values if value == 0]
    total = sum(values, Decimal(0))
    gross_wins = sum(wins, Decimal(0))
    gross_losses = abs(sum(losses, Decimal(0)))
    average_win = gross_wins / len(wins) if wins else None
    average_loss = sum(losses, Decimal(0)) / len(losses) if losses else None
    payoff_ratio = (
        average_win / abs(average_loss)
        if average_win is not None and average_loss not in (None, Decimal(0))
        else None
    )
    profit_factor = gross_wins / gross_losses if gross_losses else None
    net_dollars = sum(
        (_decimal(record["net_pnl_usd"], "net_pnl_usd") for record in records),
        Decimal(0),
    )

    return {
        "trade_count": len(values),
        "win_count": len(wins),
        "loss_count": len(losses),
        "flat_count": len(flats),
        "mean_net_r": total / len(values),
        "win_rate": Decimal(len(wins)) / len(values),
        "average_win_r": average_win,
        "average_loss_r": average_loss,
        "payoff_ratio": payoff_ratio,
        "r_profit_factor": profit_factor,
        "total_net_r": total,
        "total_net_pnl_usd": net_dollars,
        "maximum_cumulative_r_drawdown": _maximum_drawdown(values),
        "largest_win_r": max(wins) if wins else None,
        "largest_loss_r": min(losses) if losses else None,
        "r_values": values,
    }


def _percentile(values: Sequence[Decimal], probability: Decimal) -> Decimal:
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = probability * (len(ordered) - 1)
    lower = int(position.to_integral_value(rounding=ROUND_FLOOR))
    upper = min(lower + 1, len(ordered) - 1)
    weight = position - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * weight


def bootstrap_mean_r(
    records: Sequence[dict[str, Any]], *, draws: int = 2000, seed: int = 7
) -> dict[str, Any]:
    """IID-resample the observed R values and summarize their sample means."""

    if isinstance(draws, bool) or not isinstance(draws, int) or draws <= 0:
        raise ValueError("draws must be a positive integer")
    values = _r_values(records)
    randomizer = random.Random(seed)
    means = []
    for _ in range(draws):
        resample = randomizer.choices(values, k=len(values))
        means.append(sum(resample, Decimal(0)) / len(resample))
    return {
        "draws": draws,
        "seed": seed,
        "observed_mean_r": sum(values, Decimal(0)) / len(values),
        "bootstrap_mean_r_p2_5": _percentile(means, Decimal("0.025")),
        "bootstrap_mean_r_median": _percentile(means, Decimal("0.5")),
        "bootstrap_mean_r_p97_5": _percentile(means, Decimal("0.975")),
        "assumption": "IID resampling from the supplied empirical trade distribution",
    }


def _load_records(path: str) -> list[dict[str, Any]]:
    with Path(path).open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError("journal must contain a JSON array")
    return data


def _json_ready(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {key: _json_ready(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_ready(item) for item in value]
    return value


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    size = commands.add_parser("size", help="calculate a capped long position size")
    size.add_argument("--equity", required=True)
    size.add_argument("--entry", required=True)
    size.add_argument("--stop", required=True)
    size.add_argument("--risk-fraction", required=True)
    size.add_argument("--name-cap-fraction", required=True)
    size.add_argument("--cash", required=True)
    size.add_argument("--fixed-round-trip-cost", default=0)
    size.add_argument("--per-share-round-trip-friction", default=0)
    size.add_argument("--entry-fixed-cost", default=0)
    size.add_argument("--entry-per-share-cost", default=0)

    analyze = commands.add_parser("analyze", help="summarize a closed-trade journal")
    analyze.add_argument("path")

    bootstrap = commands.add_parser("bootstrap", help="illustrate sample-mean uncertainty")
    bootstrap.add_argument("path")
    bootstrap.add_argument("--draws", type=int, default=2000)
    bootstrap.add_argument("--seed", type=int, default=7)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "size":
            result = calculate_position_size(
                equity=args.equity,
                entry=args.entry,
                stop=args.stop,
                risk_fraction=args.risk_fraction,
                name_cap_fraction=args.name_cap_fraction,
                cash=args.cash,
                fixed_round_trip_cost=args.fixed_round_trip_cost,
                per_share_round_trip_friction=args.per_share_round_trip_friction,
                entry_fixed_cost=args.entry_fixed_cost,
                entry_per_share_cost=args.entry_per_share_cost,
            )
        elif args.command == "analyze":
            result = analyze_trades(_load_records(args.path))
        else:
            result = bootstrap_mean_r(
                _load_records(args.path), draws=args.draws, seed=args.seed
            )
    except (OSError, json.JSONDecodeError, ValueError) as error:
        _parser().error(str(error))
    print(json.dumps(_json_ready(result), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
