import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  Gift,
  Leaf,
  LockKeyhole,
  Zap,
} from "lucide-react";
import tariffData from "../data/sp-tariffs.json";
import {
  calculate,
  currentMonth,
  formatMonth,
  monthsBetween,
  parseAmount,
  tariffForMonth,
  type CalculatorState,
} from "./lib/calculations";
import { loadState, saveState } from "./lib/storage";
import { MonthSelect } from "./components/MonthSelect";

const money = (value: number) =>
  new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(value);
const number = (value: number) =>
  new Intl.NumberFormat("en-SG", { maximumFractionDigits: 2 }).format(value);
const cents = (value: number) => `${value.toFixed(2)}¢`;
const tariffs = tariffData.tariffs;

function initialState(): CalculatorState {
  try {
    const saved = loadState(window.localStorage);
    if (saved) return saved;
  } catch {
    /* The calculator still works when storage is blocked. */
  }
  return {
    retailer: "",
    rebate: "",
    startMonth: "2026-01",
    rate: "",
    rateIncludesGst: true,
    inputGstRate: 0.09,
    showGst: true,
    entries: {},
  };
}

export default function App() {
  const [state, setState] = useState(initialState);
  const [saved, setSaved] = useState(true);
  const today = currentMonth();
  const result = calculate(state, tariffs, today);
  const gstLabel = state.showGst ? "incl. GST" : "before GST";
  const validRate = parseAmount(state.rate) !== null;
  const invalidRate = state.rate.trim() !== "" && !validRate;
  const blocked =
    !validRate || result.invalidRebate || result.invalidMonths > 0 || result.unavailableMonths > 0;
  const currentTariff = tariffForMonth(tariffs, today);
  const visibleTariff = currentTariff ?? tariffs.at(-1)!;
  const hasActivity = result.recordedMonths > 0 || result.rebates > 0;
  const chartRows = result.rows.filter((row) => row.energySavings !== null);
  const chartMin = Math.min(0, ...chartRows.map((row) => row.cumulative));
  const chartMax = Math.max(1, ...chartRows.map((row) => row.cumulative));
  const x = (index: number) => 24 + (index / Math.max(1, chartRows.length - 1)) * 552;
  const y = (value: number) => 126 - ((value - chartMin) / (chartMax - chartMin)) * 108;
  const line = chartRows.map((row, index) => `${x(index)},${y(row.cumulative)}`).join(" ");
  const percent = result.spTotal > 0 ? (result.energySavings / result.spTotal) * 100 : null;

  useEffect(() => {
    try {
      setSaved(saveState(window.localStorage, state));
    } catch {
      setSaved(false);
    }
  }, [state]);

  const changeEntry = (month: string, value: string) => {
    setState((previous) => ({
      ...previous,
      entries: {
        ...previous.entries,
        [month]: { usage: value },
      },
    }));
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="../">
          <span className="brand-icon">
            <Zap size={19} fill="currentColor" />
          </span>
          <span>
            Perception <span className="brand-divider">/</span> <strong>Electricity</strong>
          </span>
        </a>
        <span className={`save-status ${saved ? "" : "unsaved"}`} role="status">
          <LockKeyhole size={13} />
          {saved ? "Saved on this device" : "Device storage unavailable"}
        </span>
      </header>

      <main>
        <section className="page-heading">
          <div>
            <p className="eyebrow">
              <span /> SINGAPORE HOUSEHOLD TOOLS
            </p>
            <h1>A brighter look at your savings.</h1>
            <p className="intro">See how much your electricity plan has saved you against SP.</p>
          </div>
          <div className="country-tag">
            <span className="country-dot">SG</span>
            <div>
              Singapore<span>All amounts in SGD</span>
            </div>
          </div>
        </section>

        <div className="workspace">
          <aside className="plan-column">
            <section className="panel plan-panel" aria-labelledby="plan-title">
              <div className="section-heading">
                <span className="section-icon">
                  <Zap size={18} />
                </span>
                <div>
                  <h2 id="plan-title">Your electricity plan</h2>
                  <p>Set it once. Keep tracking.</p>
                </div>
              </div>
              <label className="field">
                <span className="field-label">
                  Retailer <span className="optional">optional</span>
                </span>
                <input
                  value={state.retailer}
                  placeholder="e.g. Keppel Electric"
                  maxLength={100}
                  onChange={(event) => setState({ ...state, retailer: event.target.value })}
                />
              </label>
              <MonthSelect
                value={state.startMonth}
                months={monthsBetween("2026-01", today)}
                onChange={(startMonth) => setState({ ...state, startMonth })}
              />
              <div className="field rate-field">
                <label htmlFor="plan-rate" className="field-label">
                  Fixed electricity rate
                </label>
                <div className="input-with-unit">
                  <input
                    id="plan-rate"
                    inputMode="decimal"
                    value={state.rate}
                    placeholder="25.00"
                    aria-invalid={invalidRate}
                    aria-describedby="rate-hint"
                    onChange={(event) => setState({ ...state, rate: event.target.value })}
                  />
                  <span>¢ / kWh</span>
                </div>
                <div
                  className="segmented input-tax"
                  role="group"
                  aria-label="Entered rate GST basis"
                >
                  <button
                    type="button"
                    aria-pressed={state.rateIncludesGst}
                    onClick={() => setState({ ...state, rateIncludesGst: true })}
                  >
                    Includes 9% GST
                  </button>
                  <button
                    type="button"
                    aria-pressed={!state.rateIncludesGst}
                    onClick={() => setState({ ...state, rateIncludesGst: false })}
                  >
                    Before GST
                  </button>
                </div>
                <p id="rate-hint" className={invalidRate ? "error-text" : "field-hint"}>
                  {invalidRate
                    ? "Enter a valid rate of zero or more."
                    : result.beforeGstRate !== null
                      ? `${cents(result.beforeGstRate)} before GST · ${cents(result.beforeGstRate * 1.09)} incl. GST`
                      : "Use the rate from your retailer contract."}
                </p>
              </div>
              <div className="field plan-rebate-field">
                <label htmlFor="plan-rebate" className="field-label">
                  <Gift size={14} /> One-time rebate <span className="optional">optional</span>
                </label>
                <div className="input-with-unit">
                  <input
                    id="plan-rebate"
                    inputMode="decimal"
                    value={state.rebate}
                    placeholder="0.00"
                    aria-invalid={result.invalidRebate}
                    aria-describedby="rebate-hint"
                    onChange={(event) => setState({ ...state, rebate: event.target.value })}
                  />
                  <span>SGD</span>
                </div>
                <p id="rebate-hint" className={result.invalidRebate ? "error-text" : "field-hint"}>
                  {result.invalidRebate
                    ? "Enter a valid rebate of zero or more."
                    : "Voucher or cash value already received. Added once to your total savings."}
                </p>
              </div>
            </section>

            <section className="tariff-card" aria-labelledby="current-tariff-title">
              <div className="tariff-top">
                <span className="live-dot" />
                <h2 id="current-tariff-title">
                  {currentTariff ? "Current SP tariff" : "Latest published SP tariff"}
                </h2>
                <span>{visibleTariff.quarter.replace("-", " ")}</span>
              </div>
              <div className="tariff-number">
                {cents(
                  visibleTariff.centsPerKwhBeforeGst *
                    (state.showGst ? 1 + visibleTariff.gstRate : 1),
                )}
                <span>/ kWh</span>
              </div>
              <p>
                {gstLabel} · {formatMonth(visibleTariff.startMonth, true)} –{" "}
                {formatMonth(visibleTariff.endMonth, true)}
              </p>
              <a href={tariffData.sourceUrl} target="_blank" rel="noreferrer">
                Published by SP Group <ExternalLink size={12} />
              </a>
            </section>
            <p className="privacy-note">
              <LockKeyhole size={14} />
              Your plan and usage stay in this browser. No account needed.
            </p>
          </aside>

          <div className="results-column">
            <section className="summary" aria-labelledby="savings-title">
              <div className="summary-top">
                <p id="savings-title">YOUR TOTAL SAVINGS</p>
                <div className="segmented result-tax" role="group" aria-label="Results GST basis">
                  <button
                    type="button"
                    aria-pressed={state.showGst}
                    onClick={() => setState({ ...state, showGst: true })}
                  >
                    With GST
                  </button>
                  <button
                    type="button"
                    aria-pressed={!state.showGst}
                    onClick={() => setState({ ...state, showGst: false })}
                  >
                    Without GST
                  </button>
                </div>
              </div>
              <div className="hero-amount" aria-live="polite">
                {blocked || !hasActivity ? (
                  <span className="empty-amount">$—</span>
                ) : (
                  money(result.totalSavings)
                )}
                <span className="hero-spark">
                  <Zap size={25} />
                </span>
              </div>
              <p className="summary-caption">
                {!validRate
                  ? "Add your fixed rate, then enter usage below."
                  : result.invalidRebate || result.invalidMonths > 0
                    ? "Correct the highlighted amounts to see your total."
                    : result.unavailableMonths > 0
                      ? "SP tariff data is missing for an entered month. Total unavailable."
                      : !hasActivity
                        ? "Your savings start with your first monthly entry."
                        : `${result.recordedMonths} recorded ${result.recordedMonths === 1 ? "month" : "months"} since ${formatMonth(state.startMonth, true)} · ${gstLabel}`}
              </p>
              <div className="summary-divider" />
              <div className="summary-breakdown">
                <div>
                  <span>Electricity savings</span>
                  <strong>
                    {validRate && result.recordedMonths > 0 ? money(result.energySavings) : "—"}
                  </strong>
                </div>
                <span className="breakdown-plus">+</span>
                <div>
                  <span>One-time rebate</span>
                  <strong>{result.invalidRebate ? "—" : money(result.rebates)}</strong>
                </div>
                <span className="hero-caption">
                  <Leaf size={15} />
                  {percent === null
                    ? "A little less on your bills."
                    : `${number(Math.abs(percent))}% ${percent >= 0 ? "less" : "more"} on electricity`}
                </span>
              </div>
            </section>

            <div className="stats">
              <div className="stat">
                <span>What SP would charge</span>
                <strong>
                  {validRate && result.recordedMonths > 0 ? money(result.spTotal) : "—"}
                </strong>
                <small>For the same recorded usage</small>
              </div>
              <div className="stat">
                <span>Your retailer bill</span>
                <strong>
                  {validRate && result.recordedMonths > 0 ? money(result.retailerTotal) : "—"}
                </strong>
                <small>{state.retailer || "Your fixed-rate plan"} · before rebates</small>
              </div>
              <div className="stat">
                <span>Electricity tracked</span>
                <strong>
                  {number(result.totalUsage)} <em>kWh</em>
                </strong>
                <small>
                  {result.recordedMonths} {result.recordedMonths === 1 ? "month" : "months"} with a
                  comparison
                </small>
              </div>
            </div>

            <section className="panel trend-panel" aria-labelledby="trend-title">
              <div className="panel-heading">
                <div>
                  <h2 id="trend-title">Electricity savings over time</h2>
                  <p>Cumulative bill savings, before the one-time rebate</p>
                </div>
                <span className="legend">
                  <i />
                  Bill savings
                </span>
              </div>
              {chartRows.length > 0 && !blocked ? (
                <div className="trend">
                  <span className="chart-top-label">{money(chartMax)}</span>
                  <svg
                    viewBox="0 0 600 150"
                    role="img"
                    aria-label={`Cumulative savings from ${formatMonth(chartRows[0].month)} to ${formatMonth(chartRows.at(-1)!.month)}: ${money(result.energySavings)} before the one-time rebate. See monthly breakdown for individual values.`}
                  >
                    <defs>
                      <linearGradient id="savings-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8471b3" stopOpacity=".24" />
                        <stop offset="100%" stopColor="#8471b3" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[18, 72, 126].map((yy) => (
                      <line
                        key={yy}
                        x1="24"
                        y1={yy}
                        x2="576"
                        y2={yy}
                        stroke="#eeecef"
                        strokeDasharray="4 5"
                      />
                    ))}
                    <line x1="24" y1={y(0)} x2="576" y2={y(0)} stroke="#dad6e2" />
                    <polygon
                      points={`${x(0)},${y(0)} ${line} ${x(chartRows.length - 1)},${y(0)}`}
                      fill="url(#savings-fill)"
                    />
                    <polyline
                      points={line}
                      stroke="#78609e"
                      strokeWidth="3"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    {chartRows.map((row, index) => (
                      <circle
                        key={row.month}
                        cx={x(index)}
                        cy={y(row.cumulative)}
                        r="4"
                        fill="#78609e"
                      >
                        <title>
                          {formatMonth(row.month, true)}: {money(row.cumulative)}
                        </title>
                      </circle>
                    ))}
                  </svg>
                  <div className="chart-months">
                    <span>{formatMonth(chartRows[0].month, true)}</span>
                    {chartRows.length > 1 && (
                      <span>{formatMonth(chartRows.at(-1)!.month, true)}</span>
                    )}
                  </div>
                  <p className="chart-note">
                    Only entered usage is included. Missing bills are not estimated.
                  </p>
                </div>
              ) : (
                <div className="chart-empty">
                  <span className="empty-chart-bars">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <p>Your progress, month by month.</p>
                  <span>Enter your rate and a monthly bill to see the trend.</span>
                </div>
              )}
            </section>

            <section className="panel ledger-panel" aria-labelledby="ledger-title">
              <div className="panel-heading">
                <div>
                  <h2 id="ledger-title">Monthly breakdown</h2>
                  <p>Enter usage from your electricity bills.</p>
                </div>
                <span className="month-count">
                  {result.recordedMonths} / {result.rows.length} recorded
                </span>
              </div>
              <div className="ledger-tip">
                <CircleHelp size={14} />
                <span>Blank months stay uncounted. Enter 0 for a month with no usage.</span>
              </div>
              {result.unavailableMonths > 0 && (
                <p className="ledger-warning" role="alert">
                  A published SP tariff is unavailable for {result.unavailableMonths} entered{" "}
                  {result.unavailableMonths === 1 ? "month" : "months"}. Those comparisons cannot be
                  calculated.
                </p>
              )}
              {state.startMonth > today && (
                <p className="ledger-warning">
                  This saved plan starts in the future. Choose a start month up to{" "}
                  {formatMonth(today)}.
                </p>
              )}
              <div className="table-scroll">
                <table>
                  <caption className="sr-only">
                    Monthly electricity costs and savings in Singapore dollars, {gstLabel}, before
                    the one-time rebate.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Month</th>
                      <th scope="col">
                        Usage <span>kWh</span>
                      </th>
                      <th scope="col">
                        SP bill <span>{gstLabel}</span>
                      </th>
                      <th scope="col">
                        Retailer <span>{gstLabel}</span>
                      </th>
                      <th scope="col">
                        Savings <span>{gstLabel}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => {
                      const usageInvalid = row.entry.usage.trim() !== "" && row.usage === null;
                      return (
                        <tr key={row.month}>
                          <th scope="row">
                            {formatMonth(row.month, true)}
                            {row.month === today && <span className="current-label">current</span>}
                            <small>
                              {row.tariff?.quarter.replace("-", " ") ?? "Tariff unavailable"}
                            </small>
                          </th>
                          <td>
                            <input
                              className="table-input"
                              inputMode="decimal"
                              aria-label={`Usage for ${formatMonth(row.month)}`}
                              aria-invalid={usageInvalid}
                              placeholder="—"
                              value={row.entry.usage}
                              onChange={(event) => changeEntry(row.month, event.target.value)}
                            />
                            {usageInvalid && <span className="cell-error">Invalid usage</span>}
                          </td>
                          <td>{row.spBill === null ? "—" : money(row.spBill)}</td>
                          <td>{row.retailerBill === null ? "—" : money(row.retailerBill)}</td>
                          <td
                            className={
                              row.savings === null ? "" : row.savings >= 0 ? "positive" : "negative"
                            }
                          >
                            {row.savings === null ? (
                              "—"
                            ) : (
                              <span className="row-savings">
                                {row.savings >= 0 ? (
                                  <ArrowDownRight size={12} />
                                ) : (
                                  <ArrowUpRight size={12} />
                                )}
                                {money(row.savings)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">Total electricity</th>
                      <td>{number(result.totalUsage)}</td>
                      <td>
                        {validRate && result.recordedMonths > 0 ? money(result.spTotal) : "—"}
                      </td>
                      <td>
                        {validRate && result.recordedMonths > 0 ? money(result.retailerTotal) : "—"}
                      </td>
                      <td className={result.energySavings >= 0 ? "positive" : "negative"}>
                        {validRate &&
                        result.invalidMonths === 0 &&
                        result.unavailableMonths === 0 &&
                        result.recordedMonths > 0
                          ? money(result.energySavings)
                          : "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="ledger-footer">
                <Check size={13} />
                Changes save automatically.
                {result.missingMonths > 0 && (
                  <span>
                    {result.missingMonths}{" "}
                    {result.missingMonths === 1 ? "month has" : "months have"} no usage entered.
                  </span>
                )}
              </p>
            </section>
          </div>
        </div>

        <details className="methodology">
          <summary>
            <span>
              <CircleHelp size={16} />
              How we calculate your savings
            </span>
            <ChevronDown size={16} />
          </summary>
          <div className="method-content">
            <div>
              <h3>The calculation</h3>
              <p>
                Total savings = monthly electricity savings + your one-time received rebate. For
                each month, electricity savings = SP cost − retailer cost. Both costs use your
                actual entered kWh. Monthly costs round to the nearest cent before totals are added.
              </p>
              <p>
                SP rates match each month’s quarter. Your fixed rate is converted to a before-GST
                rate, then the month’s GST is applied when you choose “With GST”. Vouchers and cash
                rebates keep their entered value in both views.
              </p>
              <p>
                Enter the one-time rebate only after it has been received. It is added once to the
                summary and excluded from the monthly bill breakdown and trend. A voucher’s face
                value is a benefit, not a reduction in your electricity bill. This comparison covers
                electricity usage charges; other fees, deposits, termination charges and U-Save
                credits are excluded. If your plan starts partway through a month, enter only usage
                under the retailer plan.
              </p>
            </div>
            <div>
              <h3>SP tariff history</h3>
              <table className="tariff-history">
                <thead>
                  <tr>
                    <th>Quarter</th>
                    <th>Before GST</th>
                    <th>With GST</th>
                  </tr>
                </thead>
                <tbody>
                  {tariffs.map((tariff) => (
                    <tr key={tariff.quarter}>
                      <td>{tariff.quarter.replace("-", " ")}</td>
                      <td>{cents(tariff.centsPerKwhBeforeGst)}</td>
                      <td>{cents(tariff.centsPerKwhBeforeGst * (1 + tariff.gstRate))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="field-hint">
                Rates in cents/kWh. Tariffs last updated {tariffData.updatedOn}.{" "}
                <a href={tariffs[0].sourceUrl} target="_blank" rel="noreferrer">
                  SP historical tariffs <ExternalLink size={11} />
                </a>
              </p>
            </div>
          </div>
        </details>
      </main>
      <footer className="page-footer">
        <span>
          <Zap size={13} />
          Perception · Small tools for everyday decisions.
        </span>
        <span>Made for Singapore.</span>
      </footer>
    </div>
  );
}
