import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Home,
  Info,
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

const CPF_AGE_BANDS = {
  '35-below': { label: '35 and below', totalRate: 0.37, employerRate: 0.17, oaRatio: 0.6217 },
  'above-35-45': { label: 'Above 35–45', totalRate: 0.37, employerRate: 0.17, oaRatio: 0.5677 },
  'above-45-50': { label: 'Above 45–50', totalRate: 0.37, employerRate: 0.17, oaRatio: 0.5136 },
  'above-50-55': { label: 'Above 50–55', totalRate: 0.37, employerRate: 0.17, oaRatio: 0.4055 },
  'above-55-60': { label: 'Above 55–60', totalRate: 0.34, employerRate: 0.16, oaRatio: 0.353 },
  'above-60-65': { label: 'Above 60–65', totalRate: 0.25, employerRate: 0.125, oaRatio: 0.14 },
  'above-65-70': { label: 'Above 65–70', totalRate: 0.165, employerRate: 0.09, oaRatio: 0.0607 },
  'above-70': { label: 'Above 70', totalRate: 0.125, employerRate: 0.075, oaRatio: 0.08 },
};

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
  cpfAgeBand: '35-below',
  cpfEarners: 1,
  timelineMonths: 0,
};

const STORAGE_KEY = 'sg-housing-feasibility-v1';
const DEFAULT_PRICES = Object.fromEntries(PROPERTY_ROWS.map((row) => [row.id, row.price]));

const fmt = new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 });
const compact = (v) => v >= 1000000 ? `$${(v / 1000000).toFixed(v >= 10000000 ? 0 : 2)}m` : `$${Math.round(v / 1000)}k`;

function formatInputValue(value, allowDecimal = false) {
  if (value === '' || value == null || !Number.isFinite(Number(value))) return '';
  return Number(value).toLocaleString('en-SG', {
    useGrouping: true,
    maximumFractionDigits: allowDecimal ? 4 : 0,
  });
}

function parseInputValue(rawValue, allowDecimal = false) {
  const cleaned = rawValue
    .replaceAll(',', '')
    .replace(allowDecimal ? /[^\d.]/g : /\D/g, '');

  if (cleaned === '') return { display: '', number: null };

  if (!allowDecimal) {
    const normalized = cleaned.replace(/^0+(?=\d)/, '');
    const number = Number(normalized);
    return { display: formatInputValue(number), number };
  }

  const dotIndex = cleaned.indexOf('.');
  const hasDecimal = dotIndex !== -1;
  const wholeRaw = hasDecimal ? cleaned.slice(0, dotIndex) : cleaned;
  const decimalRaw = hasDecimal ? cleaned.slice(dotIndex + 1).replaceAll('.', '') : '';
  const whole = (wholeRaw || '0').replace(/^0+(?=\d)/, '');
  const numericText = `${whole}${hasDecimal ? `.${decimalRaw}` : ''}`;
  const number = Number(numericText);

  return {
    display: `${formatInputValue(Number(whole))}${hasDecimal ? `.${decimalRaw}` : ''}`,
    number,
  };
}

function readSavedState() {
  const fallback = { settings: DEFAULTS, prices: DEFAULT_PRICES };
  if (typeof window === 'undefined') return fallback;

  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return fallback;

    const settings = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS)) {
      const value = saved.settings?.[key];
      if (key === 'citizenship') {
        if (['SC', 'PR', 'FR'].includes(value)) settings[key] = value;
      } else if (key === 'cpfAgeBand') {
        if (CPF_AGE_BANDS[value]) settings[key] = value;
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        settings[key] = value;
      }
    }

    const prices = { ...DEFAULT_PRICES };
    for (const key of Object.keys(DEFAULT_PRICES)) {
      const value = saved.prices?.[key];
      if (typeof value === 'number' && Number.isFinite(value)) prices[key] = value;
    }

    return { settings, prices };
  } catch {
    return fallback;
  }
}

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

function estimateMonthlyCpfOA(income, earners, ageBand, citizenship) {
  if (citizenship === 'FR' || income <= 0) return 0;
  const profile = CPF_AGE_BANDS[ageBand] ?? CPF_AGE_BANDS['35-below'];
  const contributorCount = Math.max(1, Math.round(earners));
  const wagePerContributor = Math.min(income / contributorCount, 8000);
  let cpfPerContributor = wagePerContributor * profile.totalRate;
  if (wagePerContributor <= 50) cpfPerContributor = 0;
  else if (wagePerContributor <= 500) cpfPerContributor = wagePerContributor * profile.employerRate;
  else if (wagePerContributor <= 750) {
    cpfPerContributor = wagePerContributor * profile.employerRate
      + 3 * (profile.totalRate - profile.employerRate) * (wagePerContributor - 500);
  }
  return Math.round(cpfPerContributor * profile.oaRatio * contributorCount);
}

function FormattedNumberInput({ value, onChange, allowDecimal = false, ...props }) {
  const [draft, setDraft] = useState(() => formatInputValue(value, allowDecimal));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(formatInputValue(value, allowDecimal));
  }, [value, allowDecimal]);

  function handleChange(event) {
    const parsed = parseInputValue(event.target.value, allowDecimal);
    setDraft(parsed.display);
    if (parsed.number != null) onChange(parsed.number);
  }

  return (
    <input
      {...props}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={draft}
      onFocus={() => { focused.current = true; }}
      onBlur={() => {
        focused.current = false;
        setDraft(formatInputValue(value, allowDecimal));
      }}
      onChange={handleChange}
    />
  );
}

function InfoTip({ label, children }) {
  return (
    <span className="info-tip" tabIndex="0" aria-label={`${label}: ${children}`}>
      <Info size={14} aria-hidden="true" />
      <span className="tooltip" role="tooltip">{children}</span>
    </span>
  );
}

const BINDING_HELP = {
  LTV: 'Loan-to-value cap: the loan cannot exceed the permitted share of the property price or valuation.',
  MSR: 'Mortgage Servicing Ratio: the assessed monthly instalment is capped at 30% of gross monthly household income for HDB flats and new ECs.',
  TDSR: 'Total Debt Servicing Ratio: all assessed monthly debt obligations are capped at 55% of gross monthly income.',
};

function NumberInput({ label, help, value, onChange, prefix = '$', suffix = '', step = 1000 }) {
  const allowDecimal = step < 1;
  return (
    <label className="field">
      <span className="label-copy">
        {label}
        {help && <InfoTip label={label}>{help}</InfoTip>}
      </span>
      <div className="input-shell">
        {prefix && <b>{prefix}</b>}
        <FormattedNumberInput
          value={value}
          onChange={onChange}
          allowDecimal={allowDecimal}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function FieldLabel({ label, help }) {
  return (
    <span className="label-copy">
      {label}
      <InfoTip label={label}>{help}</InfoTip>
    </span>
  );
}

function TableHeading({ label, help }) {
  return (
    <th>
      <span className="th-label">
        {label}
        <InfoTip label={label}>{help}</InfoTip>
      </span>
    </th>
  );
}

function App() {
  const [savedState] = useState(readSavedState);
  const [settings, setSettings] = useState(savedState.settings);
  const [prices, setPrices] = useState(savedState.prices);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hideIneligible, setHideIneligible] = useState(false);

  const monthlyCpfOA = estimateMonthlyCpfOA(
    settings.income,
    settings.cpfEarners,
    settings.cpfAgeBand,
    settings.citizenship,
  );
  const projectedCash = settings.cash + settings.monthlySavings * settings.timelineMonths;
  const projectedCpf = settings.cpf + monthlyCpfOA * settings.timelineMonths;
  const assets = projectedCash + projectedCpf;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, prices }));
    } catch {
      // Keep the calculator usable when browser storage is unavailable.
    }
  }, [settings, prices]);

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
    const cashGap = Math.max(0, minCash - projectedCash);
    const fundingGap = Math.max(totalGap, cashGap);
    const monthly = monthlyPayment(maxLoan, actualRate, tenure);
    const monthlyCapitalGrowth = settings.monthlySavings + monthlyCpfOA;
    const capitalMonths = totalUpfront <= settings.cash + settings.cpf
      ? 0
      : monthlyCapitalGrowth > 0
        ? Math.ceil((totalUpfront - settings.cash - settings.cpf) / monthlyCapitalGrowth)
        : null;
    const cashMonths = minCash <= settings.cash
      ? 0
      : settings.monthlySavings > 0
        ? Math.ceil((minCash - settings.cash) / settings.monthlySavings)
        : null;
    const monthsToTarget = capitalMonths == null || cashMonths == null
      ? null
      : Math.max(capitalMonths, cashMonths);

    let status = settings.timelineMonths === 0 ? 'Affordable now' : `Affordable at ${settings.timelineMonths} mo`;
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
  }), [prices, settings, assets, projectedCash, monthlyCpfOA]);

  const visibleRows = hideIneligible ? rows.filter((r) => r.eligible) : rows;
  const affordableCount = rows.filter((r) => r.eligible && r.fundingGap === 0).length;
  const nearest = rows.filter((r) => r.eligible).sort((a, b) => a.fundingGap - b.fundingGap)[0];

  function reset() {
    setSettings(DEFAULTS);
    setPrices(DEFAULT_PRICES);
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
          <span><WalletCards size={17} /> {settings.timelineMonths === 0 ? 'Available capital' : `Capital at month ${settings.timelineMonths}`}</span>
          <strong>{fmt.format(assets)}</strong>
          <small>{fmt.format(projectedCash)} cash · {fmt.format(projectedCpf)} CPF</small>
        </div>
        <div className="summary-card">
          <span><CircleDollarSign size={17} /> Household income</span>
          <strong>{fmt.format(settings.income)}<i>/mo</i></strong>
          <small>{fmt.format(settings.debt)} existing monthly debt</small>
        </div>
        <div className="summary-card">
          <span><ShieldCheck size={17} /> {settings.timelineMonths === 0 ? 'Affordable now' : `Affordable at month ${settings.timelineMonths}`}</span>
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
          <NumberInput label="Cash available" help="Cash you can use toward the purchase today, before future monthly savings." value={settings.cash} onChange={(v) => setSettings({ ...settings, cash: v })} />
          <NumberInput label="CPF OA available" help="Current CPF Ordinary Account balance available for housing, before future CPF contributions." value={settings.cpf} onChange={(v) => setSettings({ ...settings, cpf: v })} />
          <NumberInput label="Household income" help="Combined gross monthly income used for income ceilings, loan servicing limits and estimated CPF OA contributions." value={settings.income} onChange={(v) => setSettings({ ...settings, income: v })} suffix="/mo" />
          <NumberInput label="Monthly cash savings" help="Cash you expect to save each month. CPF contributions are estimated separately and added automatically." value={settings.monthlySavings} onChange={(v) => setSettings({ ...settings, monthlySavings: v })} suffix="/mo" />
          <NumberInput label="Existing monthly debt" help="Monthly repayments for existing loans and credit obligations counted under TDSR." value={settings.debt} onChange={(v) => setSettings({ ...settings, debt: v })} suffix="/mo" />
          <label className="field">
            <FieldLabel label="CPF contributor age" help="Age band used for the 2026 CPF contribution and OA allocation rates. One band is applied to all contributors in this simplified model." />
            <select value={settings.cpfAgeBand} onChange={(e) => setSettings({ ...settings, cpfAgeBand: e.target.value })}>
              {Object.entries(CPF_AGE_BANDS).map(([value, profile]) => <option key={value} value={value}>{profile.label}</option>)}
            </select>
          </label>
          <NumberInput label="CPF-earning members" help="Number of household members earning the stated income. Income is split equally to apply the S$8,000 monthly CPF wage ceiling per person." value={settings.cpfEarners} onChange={(v) => setSettings({ ...settings, cpfEarners: Math.max(1, Math.round(v)) })} prefix="" step={1} />
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
            <NumberInput label="Bank mortgage rate" help="The interest rate used to estimate your actual monthly bank-loan repayment." value={settings.bankRate} onChange={(v) => setSettings({ ...settings, bankRate: v })} prefix="" suffix="%" step={0.05} />
            <NumberInput label="Bank stress rate" help="The higher assessment rate used to calculate borrowing capacity. It is not necessarily the rate charged on your loan." value={settings.bankStressRate} onChange={(v) => setSettings({ ...settings, bankStressRate: v })} prefix="" suffix="%" step={0.1} />
            <NumberInput label="HDB loan rate" help="The interest rate used to estimate your actual monthly HDB-loan repayment." value={settings.hdbRate} onChange={(v) => setSettings({ ...settings, hdbRate: v })} prefix="" suffix="%" step={0.05} />
            <NumberInput label="HDB stress rate" help="The assessment rate used to test HDB-loan affordability under MSR. It is separate from the repayment rate." value={settings.hdbStressRate} onChange={(v) => setSettings({ ...settings, hdbStressRate: v })} prefix="" suffix="%" step={0.1} />
            <NumberInput label="Bank loan tenure" help="Number of years used for the bank-loan affordability and monthly repayment calculations." value={settings.bankYears} onChange={(v) => setSettings({ ...settings, bankYears: v })} prefix="" suffix="years" step={1} />
            <NumberInput label="HDB loan tenure" help="Number of years used for the HDB-loan affordability and monthly repayment calculations." value={settings.hdbYears} onChange={(v) => setSettings({ ...settings, hdbYears: v })} prefix="" suffix="years" step={1} />
            <label className="field">
              <FieldLabel label="Buyer status" help="Used for simplified property eligibility, ABSD and CPF eligibility assumptions. PR CPF is modelled at full rates; graduated PR rates are not included." />
              <select value={settings.citizenship} onChange={(e) => setSettings({ ...settings, citizenship: e.target.value })}>
                <option value="SC">Singapore Citizen</option>
                <option value="PR">Singapore PR</option>
                <option value="FR">Foreigner</option>
              </select>
            </label>
            <label className="field">
              <FieldLabel label="Properties owned before purchase" help="Number of residential properties owned before this purchase, used to estimate the headline ABSD rate." />
              <select value={settings.propertyCount} onChange={(e) => setSettings({ ...settings, propertyCount: Number(e.target.value) })}>
                <option value={0}>0</option>
                <option value={1}>1</option>
                <option value={2}>2+</option>
              </select>
            </label>
          </div>
        )}
      </section>

      <section className="timeline-panel">
        <div className="timeline-heading">
          <div>
            <h2>Timeline preview</h2>
            <p>Drag forward to see your projected cash, CPF OA and funding gaps.</p>
          </div>
          <strong>{settings.timelineMonths === 0 ? 'Today' : `${settings.timelineMonths} months ahead`}</strong>
        </div>
        <label className="timeline-control">
          <FieldLabel label="Months ahead" help="Projects balances using monthly cash savings and estimated CPF OA contributions. It excludes interest, bonuses, grants and investment returns." />
          <input
            type="range"
            min="0"
            max="120"
            step="1"
            value={settings.timelineMonths}
            onChange={(e) => setSettings({ ...settings, timelineMonths: Number(e.target.value) })}
          />
          <span className="timeline-scale"><i>Now</i><i>2 years</i><i>5 years</i><i>10 years</i></span>
        </label>
        <div className="timeline-values">
          <div><span>Cash</span><strong>{fmt.format(projectedCash)}</strong><small>+{fmt.format(settings.monthlySavings)}/mo</small></div>
          <div><span>CPF OA</span><strong>{fmt.format(projectedCpf)}</strong><small>+{fmt.format(monthlyCpfOA)}/mo estimated</small></div>
          <div><span>Total capital</span><strong>{fmt.format(assets)}</strong><small>at selected month</small></div>
        </div>
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
                <TableHeading label="Option" help="Housing type and representative unit size used for this comparison row." />
                <TableHeading label="Unit price ✎" help="Editable purchase price for this option. Change it to match a listing or target project." />
                <TableHeading label="Max loan" help="Estimated maximum loan after applying the LTV cap and the relevant income-servicing rule." />
                <TableHeading label="Binding rule" help="The tightest rule currently limiting the maximum loan: LTV, MSR or TDSR." />
                <TableHeading label="Min cash" help="Minimum cash portion assumed by this model. CPF cannot be used to cover this amount." />
                <TableHeading label="CPF needed" help="CPF required after using the minimum cash amount toward the total upfront capital." />
                <TableHeading label="Total upfront" help="Property price not covered by the loan, plus estimated BSD and ABSD." />
                <TableHeading label="Gap vs assets" help="Remaining shortfall against projected cash and CPF at the selected timeline month, while respecting minimum cash." />
                <TableHeading label="Mortgage / mo" help="Estimated monthly repayment using the actual mortgage-rate input, not the stress-test rate." />
                <TableHeading label="Target month" help="Earliest estimated month when both total capital and the minimum cash requirement can be met." />
                <TableHeading label="MOP" help="Minimum Occupation Period before the property can generally be sold or used differently, subject to applicable rules." />
                <TableHeading label="Rental" help="Simplified whole-property rental treatment after considering the stated MOP or property type." />
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
                          <FormattedNumberInput
                            aria-label={`${row.label} unit price`}
                            value={row.price}
                            onChange={(value) => setPrices({ ...prices, [row.id]: value })}
                          />
                        </div>
                      </td>
                      <td><b>{compact(row.maxLoan)}</b></td>
                      <td>
                        <span className="rule-with-help">
                          <span className={`rule-pill ${row.binding.toLowerCase()}`}>{row.binding}</span>
                          <InfoTip label={row.binding}>{BINDING_HELP[row.binding]}</InfoTip>
                        </span>
                      </td>
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
          <p>Assumes purchase price = valuation, no cash-over-valuation, no grants/resale levy/legal/renovation costs, and no special ABSD remission. Timeline balances exclude interest, bonuses, salary changes and investment returns. CPF OA growth uses 2026 full CPF rates, the S$8,000 Ordinary Wage ceiling per contributor and equal income per contributor; PR graduated rates and age changes during the timeline are not modelled. For members above 55, actual OA allocation can depend on whether the Full Retirement Sum has been set aside. Eligibility badges model headline income ceilings only. *Resale MOP can vary with classification. †10-year new-EC MOP applies to the new regime discussed for 2026 sites. ‡Resale EC treatment depends on whether its EC MOP has already expired.</p>
        </div>
      </section>

      <footer>
        <span>Rules snapshot: September 2026</span>
        <a href="https://www.hdb.gov.sg/buying-a-flat/flat-grant-and-loan-eligibility/housing-loan/housing-loan-from-hdb" target="_blank">HDB loans</a>
        <a href="https://www.hdb.gov.sg/buying-a-flat/executive-condominiums/eligibility" target="_blank">EC eligibility</a>
        <a href="https://www.cpf.gov.sg/member/home-ownership/home-buying-guide-for-members-below-55" target="_blank">CPF / MSR / TDSR</a>
        <a href="https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFAllocationRatesfromJanuary2026.pdf" target="_blank">CPF OA allocation</a>
        <a href="https://www.cpf.gov.sg/service/article/what-is-the-ordinary-wage-ow-ceiling" target="_blank">CPF wage ceiling</a>
        <a href="https://www.iras.gov.sg/taxes/stamp-duty/for-property/buying-or-acquiring-property/buyer%27s-stamp-duty-%28bsd%29" target="_blank">BSD</a>
      </footer>
    </div>
  );
}

export default App;
