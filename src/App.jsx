import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Home,
  RotateCcw,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';

const PROPERTY_ROWS = [
  { id: 'bto-standard', group: 'BTO', label: 'Standard HDB 4R', price: 400000, financing: 'hdb', eligibility: 'bto', mop: '5 years', rental: 'Whole-flat after MOP' },
  { id: 'bto-plus', group: 'BTO', label: 'Plus HDB 4R', price: 600000, financing: 'hdb', eligibility: 'bto', mop: '10 years', rental: 'No whole-flat rental' },
  { id: 'bto-prime', group: 'BTO', label: 'Prime HDB 4R', price: 650000, financing: 'hdb', eligibility: 'bto', mop: '10 years', rental: 'No whole-flat rental' },
  { id: 'resale-3r', group: 'Resale HDB', label: 'Resale HDB 3R', price: 450000, financing: 'resale-hdb', eligibility: 'resale-hdb', mop: '5 years*', rental: 'Whole-flat after MOP' },
  { id: 'resale-4r', group: 'Resale HDB', label: 'Resale HDB 4R', price: 650000, financing: 'resale-hdb', eligibility: 'resale-hdb', mop: '5 years*', rental: 'Whole-flat after MOP' },
  { id: 'resale-5r', group: 'Resale HDB', label: 'Resale HDB 5R', price: 800000, financing: 'resale-hdb', eligibility: 'resale-hdb', mop: '5 years*', rental: 'Whole-flat after MOP' },
  { id: 'ec-3br', group: 'New EC', label: 'New EC 3BR', price: 1400000, financing: 'ec', eligibility: 'ec', mop: '10 years†', rental: 'Restricted during MOP' },
  { id: 'ec-4br', group: 'New EC', label: 'New EC 4BR', price: 1700000, financing: 'ec', eligibility: 'ec', mop: '10 years†', rental: 'Restricted during MOP' },
  { id: 'ec-5br', group: 'New EC', label: 'New EC 5BR', price: 2200000, financing: 'ec', eligibility: 'ec', mop: '10 years†', rental: 'Restricted during MOP' },
  { id: 'resale-ec', group: 'Resale EC', label: 'Resale EC', price: 1500000, financing: 'private', eligibility: 'private', mop: 'None‡', rental: 'Private-property rules' },
  { id: 'condo-1br', group: 'Condo', label: 'Condo 1BR', price: 1300000, financing: 'private', eligibility: 'private', mop: 'None', rental: 'Generally rentable' },
  { id: 'condo-2br', group: 'Condo', label: 'Condo 2BR', price: 1600000, financing: 'private', eligibility: 'private', mop: 'None', rental: 'Generally rentable' },
  { id: 'condo-3br', group: 'Condo', label: 'Condo 3BR', price: 2000000, financing: 'private', eligibility: 'private', mop: 'None', rental: 'Generally rentable' },
  { id: 'condo-4br', group: 'Condo', label: 'Condo 4BR', price: 3000000, financing: 'private', eligibility: 'private', mop: 'None', rental: 'Generally rentable' },
];

const DEFAULTS = {
  cash: 80000,
  cpf: 70000,
  income: 18000,
  debt: 0,
  monthlySavings: 6000,
  bankRate: 1.65,
  hdbRate: 2.6,
  bankStressRate: 4,
  hdbStressRate: 3,
  bankYears: 30,
  hdbYears: 25,
  citizenship: 'SC',
  propertyCount: 0,
};

const fmt = new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 });
const compact = (v) => v >= 1000000 ? `$${(v / 1000000).toFixed(v >= 10000000 ? 0 : 2)}m` : `$${Math.round(v / 1000)}k`;

function monthlyPayment(principal, annualRate, years) {
  if (principal <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return principal * r / (1 - Math.pow(1 + r, -n));
}

function loanFromPayment(payment, annualRate, years) {
  if (payment <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return payment * n;
  return payment * (1 - Math.pow(1 + r, -n)) / r;
}

function bsd(price) {
  const bands = [
    [180000, 0.01],
    [180000, 0.02],
    [640000, 0.03],
    [500000, 0.04],
    [1500000, 0.05],
    [Infinity, 0.06],
  ];
  let remaining = price;
  let total = 0;
  for (const [amount, rate] of bands) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, amount);
    total += slice * rate;
    remaining -= slice;
  }
  return Math.floor(total);
}

function absdRate(citizenship, propertyCount) {
  if (citizenship === 'SC') return propertyCount === 0 ? 0 : propertyCount === 1 ? 0.20 : 0.30;
  if (citizenship === 'PR') return propertyCount === 0 ? 0.05 : propertyCount === 1 ? 0.30 : 0.35;
  return 0.60;
}

function NumberInput({ label, value, onChange, prefix = '$', suffix = '', step = 1000, min = 0 }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-shell">
        {prefix && <b>{prefix}</b>}
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value || 0))}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function App() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [prices, setPrices] = useState(() => Object.fromEntries(PROPERTY_ROWS.map((r) => [r.id, r.price])));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hideIneligible, setHideIneligible] = useState(false);

  const assets = settings.cash + settings.cpf;

  const rows = useMemo(() => PROPERTY_ROWS.map((row) => {
    const price = prices[row.id];
    const isBto = row.eligibility === 'bto';
    const isEc = row.eligibility === 'ec';
    const isResaleHdb = row.eligibility === 'resale-hdb';

    let eligible = true;
    let eligibilityReason = '';

    if (isBto && settings.income > 16000) {
      eligible = false;
      eligibilityReason = 'Household income exceeds $16k new-HDB ceiling';
    }
    if (isEc && settings.income > 18000) {
      eligible = false;
      eligibilityReason = 'Household income exceeds $18k new-EC ceiling';
    }
    if ((isBto || isEc) && settings.citizenship !== 'SC') {
      eligible = false;
      eligibilityReason = 'This simplified model assumes an SC applicant for new HDB/EC';
    }

    let financing = row.financing;
    if (isResaleHdb) financing = settings.income <= 16000 ? 'hdb' : 'hdb-bank';

    let maxLoan = 0;
    let binding = 'LTV';
    let maxPayment = 0;
    let actualRate = settings.bankRate;
    let tenure = settings.bankYears;
    let minCash = price * 0.05;

    if (financing === 'hdb') {
      actualRate = settings.hdbRate;
      tenure = settings.hdbYears;
      maxPayment = settings.income * 0.30;
      const incomeLoan = loanFromPayment(maxPayment, settings.hdbStressRate, tenure);
      const ltvLoan = price * 0.75;
      maxLoan = Math.min(ltvLoan, incomeLoan);
      binding = incomeLoan < ltvLoan ? 'MSR' : 'LTV';
      minCash = isBto ? 2000 : 5000;
    } else if (financing === 'ec' || financing === 'hdb-bank') {
      maxPayment = Math.max(0, Math.min(settings.income * 0.30, settings.income * 0.55 - settings.debt));
      const incomeLoan = loanFromPayment(maxPayment, settings.bankStressRate, tenure);
      const ltvLoan = price * 0.75;
      maxLoan = Math.min(ltvLoan, incomeLoan);
      binding = incomeLoan < ltvLoan ? (settings.income * 0.30 <= settings.income * 0.55 - settings.debt ? 'MSR' : 'TDSR') : 'LTV';
    } else {
      maxPayment = Math.max(0, settings.income * 0.55 - settings.debt);
      const incomeLoan = loanFromPayment(maxPayment, settings.bankStressRate, tenure);
      const ltvLoan = price * 0.75;
      maxLoan = Math.min(ltvLoan, incomeLoan);
      binding = incomeLoan < ltvLoan ? 'TDSR' : 'LTV';
    }

    maxLoan = Math.max(0, maxLoan);
    const stamp = bsd(price);
    const absd = price * absdRate(settings.citizenship, settings.propertyCount);
    const equity = Math.max(0, price - maxLoan);
    const totalUpfront = equity + stamp + absd;
    minCash = Math.min(totalUpfront, minCash);
    const cpfNeeded = Math.max(0, totalUpfront - minCash);
    const totalGap = Math.max(0, totalUpfront - assets);
    const cashGap = Math.max(0, minCash - settings.cash);
    const fundingGap = Math.max(totalGap, cashGap);
    const monthly = monthlyPayment(maxLoan, actualRate, tenure);
    const monthsToTarget = fundingGap === 0 ? 0 : settings.monthlySavings > 0 ? Math.ceil(fundingGap / settings.monthlySavings) : null;

    let status = 'Affordable now';
    if (!eligible) status = 'Not eligible';
    else if (cashGap > 0) status = 'Cash shortfall';
    else if (totalGap > 0) status = binding === 'LTV' ? 'Capital shortfall' : `${binding} constrained`;
    else if (binding !== 'LTV') status = `${binding} constrained`;

    return {
      ...row,
      price,
      eligible,
      eligibilityReason,
      financing,
      maxLoan,
      binding,
      stamp,
      absd,
      minCash,
      cpfNeeded,
      totalUpfront,
      totalGap,
      cashGap,
      fundingGap,
      monthly,
      monthsToTarget,
      status,
    };
  }), [prices, settings, assets]);

  const visibleRows = hideIneligible ? rows.filter((r) => r.eligible) : rows;
  const affordableCount = rows.filter((r) => r.eligible && r.fundingGap === 0).length;
  const nearest = rows.filter((r) => r.eligible).sort((a, b) => a.fundingGap - b.fundingGap)[0];

  function reset() {
    setSettings(DEFAULTS);
    setPrices(Object.fromEntries(PROPERTY_ROWS.map((r) => [r.id, r.price])));
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <div className="eyebrow"><Home size={15} /> Singapore housing planner</div>
          <h1>See every property option at once.</h1>
          <p>Change your cash, CPF, income or any unit price. The table recalculates loan limits, upfront capital, funding gaps and monthly repayments instantly.</p>
        </div>
        <button className="reset" onClick={reset}><RotateCcw size={16} /> Reset</button>
      </header>

      <section className="summary-grid">
        <div className="summary-card">
          <span><WalletCards size={17} /> Available capital</span>
          <strong>{fmt.format(assets)}</strong>
          <small>{fmt.format(settings.cash)} cash · {fmt.format(settings.cpf)} CPF</small>
        </div>
        <div className="summary-card">
          <span><CircleDollarSign size={17} /> Household income</span>
          <strong>{fmt.format(settings.income)}<i>/mo</i></strong>
          <small>{fmt.format(settings.debt)} existing monthly debt</small>
        </div>
        <div className="summary-card">
          <span><ShieldCheck size={17} /> Affordable now</span>
          <strong>{affordableCount}</strong>
          <small>of {rows.filter((r) => r.eligible).length} income-eligible options</small>
        </div>
        <div className="summary-card accent">
          <span><Building2 size={17} /> Closest target</span>
          <strong>{nearest?.label ?? '—'}</strong>
          <small>{nearest?.fundingGap ? `${fmt.format(nearest.fundingGap)} to go` : 'Funded on current assumptions'}</small>
        </div>
      </section>

      <section className="controls-panel">
        <div className="controls-grid">
          <NumberInput label="Cash available" value={settings.cash} onChange={(v) => setSettings({ ...settings, cash: v })} />
          <NumberInput label="CPF OA available" value={settings.cpf} onChange={(v) => setSettings({ ...settings, cpf: v })} />
          <NumberInput label="Household income" value={settings.income} onChange={(v) => setSettings({ ...settings, income: v })} suffix="/mo" />
          <NumberInput label="Monthly savings" value={settings.monthlySavings} onChange={(v) => setSettings({ ...settings, monthlySavings: v })} suffix="/mo" />
          <NumberInput label="Existing monthly debt" value={settings.debt} onChange={(v) => setSettings({ ...settings, debt: v })} suffix="/mo" />
        </div>

        <div className="control-footer">
          <button className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
            Advanced assumptions {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <label className="switch-label">
            <input type="checkbox" checked={hideIneligible} onChange={(e) => setHideIneligible(e.target.checked)} />
            Hide ineligible rows
          </label>
        </div>

        {showAdvanced && (
          <div className="advanced-grid">
            <NumberInput label="Bank mortgage rate" value={settings.bankRate} onChange={(v) => setSettings({ ...settings, bankRate: v })} prefix="" suffix="%" step={0.05} />
            <NumberInput label="Bank stress rate" value={settings.bankStressRate} onChange={(v) => setSettings({ ...settings, bankStressRate: v })} prefix="" suffix="%" step={0.1} />
            <NumberInput label="HDB loan rate" value={settings.hdbRate} onChange={(v) => setSettings({ ...settings, hdbRate: v })} prefix="" suffix="%" step={0.05} />
            <NumberInput label="HDB stress rate" value={settings.hdbStressRate} onChange={(v) => setSettings({ ...settings, hdbStressRate: v })} prefix="" suffix="%" step={0.1} />
            <NumberInput label="Bank loan tenure" value={settings.bankYears} onChange={(v) => setSettings({ ...settings, bankYears: v })} prefix="" suffix="years" step={1} />
            <NumberInput label="HDB loan tenure" value={settings.hdbYears} onChange={(v) => setSettings({ ...settings, hdbYears: v })} prefix="" suffix="years" step={1} />
            <label className="field">
              <span>Buyer status</span>
              <select value={settings.citizenship} onChange={(e) => setSettings({ ...settings, citizenship: e.target.value })}>
                <option value="SC">Singapore Citizen</option>
                <option value="PR">Singapore PR</option>
                <option value="FR">Foreigner</option>
              </select>
            </label>
            <label className="field">
              <span>Properties owned before purchase</span>
              <select value={settings.propertyCount} onChange={(e) => setSettings({ ...settings, propertyCount: Number(e.target.value) })}>
                <option value={0}>0</option>
                <option value={1}>1</option>
                <option value={2}>2+</option>
              </select>
            </label>
          </div>
        )}
      </section>

      <section className="table-card">
        <div className="table-heading">
          <div>
            <h2>All options</h2>
            <p>Prices are editable directly in the table. “CPF needed” assumes you use the minimum mandatory cash and maximise CPF for the remaining upfront amount.</p>
          </div>
          <div className="legend">
            <span><i className="dot good" /> funded</span>
            <span><i className="dot warn" /> shortfall</span>
            <span><i className="dot bad" /> ineligible</span>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Option</th>
                <th>Unit price ✎</th>
                <th>Max loan</th>
                <th>Binding rule</th>
                <th>Min cash</th>
                <th>CPF needed</th>
                <th>Total upfront</th>
                <th>Gap vs assets</th>
                <th>Mortgage / mo</th>
                <th>Months to target</th>
                <th>MOP</th>
                <th>Rental</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, idx) => {
                const showGroup = idx === 0 || visibleRows[idx - 1]?.group !== row.group;
                return (
                  <React.Fragment key={row.id}>
                    {showGroup && <tr className="group-row"><td colSpan="12">{row.group}</td></tr>}
                    <tr className={!row.eligible ? 'disabled-row' : ''}>
                      <td className="option-cell">
                        <strong>{row.label}</strong>
                        <span className={`status ${row.status.toLowerCase().replaceAll(' ', '-')}`}>{row.status}</span>
                        {!row.eligible && <small>{row.eligibilityReason}</small>}
                        {row.financing === 'hdb-bank' && <small>Bank loan used: income above HDB-loan ceiling</small>}
                      </td>
                      <td>
                        <div className="price-input">
                          <span>$</span>
                          <input type="number" step="10000" value={row.price} onChange={(e) => setPrices({ ...prices, [row.id]: Number(e.target.value || 0) })} />
                        </div>
                      </td>
                      <td><b>{compact(row.maxLoan)}</b></td>
                      <td><span className={`rule-pill ${row.binding.toLowerCase()}`}>{row.binding}</span></td>
                      <td>{compact(row.minCash)}{row.cashGap > 0 && <small className="inline-alert"> +{compact(row.cashGap)} cash gap</small>}</td>
                      <td>{compact(row.cpfNeeded)}</td>
                      <td><b>{compact(row.totalUpfront)}</b><small>incl. {compact(row.stamp)} BSD{row.absd > 0 ? ` + ${compact(row.absd)} ABSD` : ''}</small></td>
                      <td className={row.fundingGap === 0 ? 'gap-good' : 'gap-bad'}>{row.fundingGap === 0 ? 'Funded' : compact(row.fundingGap)}</td>
                      <td>{fmt.format(row.monthly)}</td>
                      <td>{row.monthsToTarget === 0 ? 'Now' : row.monthsToTarget == null ? '—' : `${row.monthsToTarget} mo`}</td>
                      <td>{row.mop}</td>
                      <td className="rental-cell">{row.rental}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="notes">
        <AlertTriangle size={18} />
        <div>
          <strong>Planning model, not an approval calculator.</strong>
          <p>Assumes purchase price = valuation, no cash-over-valuation, no grants/resale levy/legal/renovation costs, and no special ABSD remission. Eligibility badges model the headline income ceiling only; actual HDB/EC eligibility also depends on family nucleus, ownership history, citizenship and other HDB rules. Resale HDB rows model unclassified/Standard flats; resale Plus/Prime flats have tighter eligibility. *Resale MOP can vary with classification. †10-year new-EC MOP applies to the new regime discussed for 2026 sites. ‡Resale EC treatment depends on whether its EC MOP has already expired.</p>
        </div>
      </section>

      <footer>
        <span>Rules snapshot: September 2026</span>
        <a href="https://www.hdb.gov.sg/buying-a-flat/flat-grant-and-loan-eligibility/housing-loan/housing-loan-from-hdb" target="_blank">HDB loans</a>
        <a href="https://www.hdb.gov.sg/buying-a-flat/executive-condominiums/eligibility" target="_blank">EC eligibility</a>
        <a href="https://www.cpf.gov.sg/member/home-ownership/home-buying-guide-for-members-below-55" target="_blank">CPF / MSR / TDSR</a>
        <a href="https://www.iras.gov.sg/taxes/stamp-duty/for-property/buying-or-acquiring-property/buyer%27s-stamp-duty-%28bsd%29" target="_blank">BSD</a>
      </footer>
    </div>
  );
}

export default App;
