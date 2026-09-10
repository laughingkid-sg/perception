import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowRightLeft,
  BadgeDollarSign,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  Landmark,
  Plus,
  ReceiptText,
  ShieldCheck,
  Trash2,
  WalletCards,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  type AgeBand,
  type Benefit,
  type BenefitMode,
  type CpfStatus,
  type Expense,
  type RegionResult,
  calculateSingapore,
  calculateUnitedStates,
} from '@/lib/calculations';

type Period = 'annual' | 'monthly';
type DisplayCurrency = 'SGD' | 'USD';
type MobileScenario = 'sg' | 'us';

type SavedPlannerState = {
  period: Period;
  displayCurrency: DisplayCurrency;
  usdToSgd: number;
  mobileScenario: MobileScenario;
  sgBase: number;
  sgBonus: number;
  sgEquity: number;
  sgBenefits: Benefit[];
  sgExpenses: Expense[];
  cpfStatus: CpfStatus;
  ageBand: AgeBand;
  sgTaxResident: boolean;
  sgOtherReliefs: number;
  usBase: number;
  usBonus: number;
  usEquity: number;
  usBenefits: Benefit[];
  usExpenses: Expense[];
  retirement401k: number;
  otherPretax: number;
  federalMode: 'automatic' | 'manual';
  manualFederalTax: number;
  stateMode: 'rate' | 'annual';
  stateValue: number;
  usLocation: string;
};

const sgBenefitsInitial: Benefit[] = [
  { id: 'sg-flexi', name: 'Flexi wallet', amount: 1_800, mode: 'package-nontaxable' },
  { id: 'sg-food', name: 'Meal allowance', amount: 2_400, mode: 'cash-taxable' },
  { id: 'sg-insurance', name: 'Group insurance', amount: 1_600, mode: 'package-nontaxable' },
];

const usBenefitsInitial: Benefit[] = [
  { id: 'us-health', name: 'Employer health plan', amount: 7_900, mode: 'package-nontaxable' },
  { id: 'us-dental', name: 'Dental, vision & disability', amount: 1_200, mode: 'package-nontaxable' },
  { id: 'us-match', name: '401(k) employer match', amount: 0, mode: 'package-nontaxable' },
  { id: 'us-food', name: 'Meals & wellness', amount: 3_600, mode: 'package-nontaxable' },
  { id: 'us-visa', name: 'Visa / legal support', amount: 3_000, mode: 'package-nontaxable' },
  { id: 'us-options', name: 'Private options · risk-adjusted', amount: 10_000, mode: 'package-nontaxable' },
];

const sgExpensesInitial: Expense[] = [
  { id: 'sg-rent', name: 'Housing rent', monthly: 1_500 },
  { id: 'sg-food-expense', name: 'Food & groceries', monthly: 700 },
  { id: 'sg-transport', name: 'Transport', monthly: 180 },
  { id: 'sg-other', name: 'Utilities & other', monthly: 500 },
];

const usExpensesInitial: Expense[] = [
  { id: 'us-rent', name: 'Shared housing rent', monthly: 1_700 },
  { id: 'us-food-expense', name: 'Food & groceries', monthly: 800 },
  { id: 'us-transport', name: 'Transport', monthly: 300 },
  { id: 'us-health-expense', name: 'Healthcare out-of-pocket', monthly: 300 },
  { id: 'us-other', name: 'Utilities & other', monthly: 800 },
  { id: 'us-travel', name: 'Trips to Singapore', monthly: 200 },
];

const STORAGE_KEY = 'sg-us-package-planner:v2';

const ageLabels: Record<AgeBand, string> = {
  '55-and-below': '55 and below',
  '55-60': 'Above 55–60',
  '60-65': 'Above 60–65',
  '65-70': 'Above 65–70',
  'above-70': 'Above 70',
};

const benefitModeLabels: Record<BenefitMode, string> = {
  'cash-taxable': 'Cash · taxable',
  'cash-nontaxable': 'Cash · non-taxable',
  'package-taxable': 'Package only · taxable',
  'package-nontaxable': 'Package only · non-taxable',
};

const clampNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

const isRecordValue = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const savedNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback;

const isBenefitMode = (value: unknown): value is BenefitMode =>
  value === 'cash-taxable' ||
  value === 'cash-nontaxable' ||
  value === 'package-taxable' ||
  value === 'package-nontaxable';

const savedBenefits = (value: unknown, fallback: Benefit[]) => {
  if (!Array.isArray(value)) return fallback;
  const benefits: Benefit[] = [];
  for (const item of value) {
    if (
      !isRecordValue(item) ||
      typeof item.id !== 'string' ||
      typeof item.name !== 'string' ||
      !isBenefitMode(item.mode) ||
      typeof item.amount !== 'number' ||
      !Number.isFinite(item.amount) ||
      item.amount < 0
    ) return fallback;
    benefits.push({ id: item.id, name: item.name, amount: item.amount, mode: item.mode });
  }
  return benefits;
};

const savedExpenses = (value: unknown, fallback: Expense[]) => {
  if (!Array.isArray(value)) return fallback;
  const expenses: Expense[] = [];
  for (const item of value) {
    if (
      !isRecordValue(item) ||
      typeof item.id !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.monthly !== 'number' ||
      !Number.isFinite(item.monthly) ||
      item.monthly < 0
    ) return fallback;
    expenses.push({ id: item.id, name: item.name, monthly: item.monthly });
  }
  return expenses;
};

function formatMoney(value: number, currency: DisplayCurrency) {
  const prefix = currency === 'SGD' ? 'S$' : 'US$';
  const amount = new Intl.NumberFormat('en-SG', {
    maximumFractionDigits: 0,
  }).format(Math.abs(value));

  return `${value < 0 ? '−' : ''}${prefix}${amount}`;
}

function formatPercent(value: number) {
  return new Intl.NumberFormat('en-SG', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}

function NumberField({ label, value, onChange, prefix, suffix, hint, step = 100 }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
  step?: number;
}) {
  return (
    <label className="number-field">
      <span className="field-label">{label}</span>
      <span className="number-control">
        {prefix ? <span className="number-prefix">{prefix}</span> : null}
        <Input aria-label={label} inputMode="decimal" min="0" step={step} type="number" value={value} onChange={(event) => onChange(clampNumber(event.target.value))} />
        {suffix ? <span className="number-suffix">{suffix}</span> : null}
      </span>
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function SectionHeading({ icon, title, copy }: { icon: React.ReactNode; title: string; copy?: string }) {
  return (
    <div className="section-heading">
      <span className="section-icon">{icon}</span>
      <div><h3>{title}</h3>{copy ? <p>{copy}</p> : null}</div>
    </div>
  );
}

function BenefitEditor({ currency, benefits, setBenefits }: {
  currency: DisplayCurrency;
  benefits: Benefit[];
  setBenefits: React.Dispatch<React.SetStateAction<Benefit[]>>;
}) {
  const update = (id: string, patch: Partial<Benefit>) =>
    setBenefits((current) => current.map((benefit) => benefit.id === id ? { ...benefit, ...patch } : benefit));

  return (
    <div className="editor-section">
      <SectionHeading icon={<ShieldCheck />} title="Benefits & package cost" copy="Mark whether value reaches you as cash and whether it is taxable." />
      <div className="repeat-list">
        {benefits.map((benefit) => (
          <div className="benefit-row" key={benefit.id}>
            <Input aria-label="Benefit name" className="name-input" value={benefit.name} onChange={(event) => update(benefit.id, { name: event.target.value })} />
            <span className="compact-money">
              <span>{currency === 'SGD' ? 'S$' : 'US$'}</span>
              <Input aria-label={`${benefit.name || 'Benefit'} annual value`} inputMode="decimal" min="0" step="100" type="number" value={benefit.amount} onChange={(event) => update(benefit.id, { amount: clampNumber(event.target.value) })} />
            </span>
            <NativeSelect aria-label={`${benefit.name || 'Benefit'} treatment`} className="mode-select" value={benefit.mode} onChange={(event) => update(benefit.id, { mode: event.target.value as BenefitMode })}>
              {Object.entries(benefitModeLabels).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
            </NativeSelect>
            <Button aria-label={`Remove ${benefit.name || 'benefit'}`} className="remove-button" size="icon" type="button" variant="ghost" onClick={() => setBenefits((current) => current.filter((item) => item.id !== benefit.id))}><Trash2 /></Button>
          </div>
        ))}
      </div>
      <Button className="add-row-button" type="button" variant="ghost" onClick={() => setBenefits((current) => [...current, { id: uid(), name: 'New benefit', amount: 0, mode: 'package-nontaxable' }])}><Plus /> Add benefit</Button>
    </div>
  );
}

function ExpenseEditor({ currency, expenses, setExpenses }: {
  currency: DisplayCurrency;
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
}) {
  const update = (id: string, patch: Partial<Expense>) =>
    setExpenses((current) => current.map((expense) => expense.id === id ? { ...expense, ...patch } : expense));

  return (
    <div className="editor-section">
      <SectionHeading icon={<ReceiptText />} title="Monthly living costs" copy="Personal spending is deducted after tax—it is not a tax relief." />
      <div className="repeat-list">
        {expenses.map((expense) => (
          <div className="expense-row" key={expense.id}>
            <Input aria-label="Expense name" className="name-input" value={expense.name} onChange={(event) => update(expense.id, { name: event.target.value })} />
            <span className="compact-money"><span>{currency === 'SGD' ? 'S$' : 'US$'}</span><Input aria-label={`${expense.name || 'Expense'} monthly amount`} inputMode="decimal" min="0" step="50" type="number" value={expense.monthly} onChange={(event) => update(expense.id, { monthly: clampNumber(event.target.value) })} /></span>
            <Button aria-label={`Remove ${expense.name || 'expense'}`} className="remove-button" size="icon" type="button" variant="ghost" onClick={() => setExpenses((current) => current.filter((item) => item.id !== expense.id))}><Trash2 /></Button>
          </div>
        ))}
      </div>
      <Button className="add-row-button" type="button" variant="ghost" onClick={() => setExpenses((current) => [...current, { id: uid(), name: 'New expense', monthly: 0 }])}><Plus /> Add expense</Button>
    </div>
  );
}

function ResultFlow({ result, region, format }: {
  result: RegionResult;
  region: 'sg' | 'us';
  format: (value: number, region: 'sg' | 'us') => string;
}) {
  const values = [Math.max(0, result.incomeTax), Math.max(0, result.employeeStatutory + result.employeeVoluntary), Math.max(0, result.livingExpenses), Math.max(0, result.disposableIncome)];
  const total = Math.max(1, values[0] + values[1] + values[2] + values[3]);
  return (
    <div className={`flow-card ${region}`}>
      <div className="flow-heading"><div><span className="region-dot" /><strong>{region === 'sg' ? 'Singapore' : 'United States'}</strong></div><span>{format(result.grossCash, region)} gross cash</span></div>
      <div className="flow-bar" aria-label="Cash allocation">
        <span className="flow-tax" style={{ width: `${(values[0] / total) * 100}%` }} />
        <span className="flow-payroll" style={{ width: `${(values[1] / total) * 100}%` }} />
        <span className="flow-living" style={{ width: `${(values[2] / total) * 100}%` }} />
        <span className="flow-left" style={{ width: `${(values[3] / total) * 100}%` }} />
      </div>
      <div className="flow-legend">
        <span><i className="tax" />Tax {format(result.incomeTax, region)}</span>
        <span><i className="payroll" />Payroll {format(result.employeeStatutory + result.employeeVoluntary, region)}</span>
        <span><i className="living" />Life {format(result.livingExpenses, region)}</span>
        <span><i className="left" />Left {format(result.disposableIncome, region)}</span>
      </div>
      {result.disposableIncome < 0 ? <p className="deficit-note">Living costs exceed modeled net pay by {format(Math.abs(result.disposableIncome), region)}.</p> : null}
    </div>
  );
}

export default function App() {
  const [storageReady, setStorageReady] = useState(false);
  const [period, setPeriod] = useState<Period>('annual');
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('SGD');
  const [usdToSgd, setUsdToSgd] = useState(1.26);
  const [mobileScenario, setMobileScenario] = useState<MobileScenario>('sg');

  const [sgBase, setSgBase] = useState(54_000);
  const [sgBonus, setSgBonus] = useState(4_500);
  const [sgEquity, setSgEquity] = useState(0);
  const [sgBenefits, setSgBenefits] = useState<Benefit[]>(sgBenefitsInitial);
  const [sgExpenses, setSgExpenses] = useState<Expense[]>(sgExpensesInitial);
  const [cpfStatus, setCpfStatus] = useState<CpfStatus>('full');
  const [ageBand, setAgeBand] = useState<AgeBand>('55-and-below');
  const [sgTaxResident, setSgTaxResident] = useState(true);
  const [sgOtherReliefs, setSgOtherReliefs] = useState(0);

  const [usBase, setUsBase] = useState(145_000);
  const [usBonus, setUsBonus] = useState(0);
  const [usEquity, setUsEquity] = useState(0);
  const [usBenefits, setUsBenefits] = useState<Benefit[]>(usBenefitsInitial);
  const [usExpenses, setUsExpenses] = useState<Expense[]>(usExpensesInitial);
  const [retirement401k, setRetirement401k] = useState(14_500);
  const [otherPretax, setOtherPretax] = useState(1_500);
  const [federalMode, setFederalMode] = useState<'automatic' | 'manual'>('automatic');
  const [manualFederalTax, setManualFederalTax] = useState(0);
  const [stateMode, setStateMode] = useState<'rate' | 'annual'>('rate');
  const [stateValue, setStateValue] = useState(7.5);
  const [usLocation, setUsLocation] = useState('San Francisco, California');

  /* oxlint-disable react/react-compiler -- Hydrate controlled inputs from browser storage once after mount. */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as unknown;
      if (!isRecordValue(saved)) return;

      if (saved.period === 'annual' || saved.period === 'monthly') setPeriod(saved.period);
      if (saved.displayCurrency === 'SGD' || saved.displayCurrency === 'USD') setDisplayCurrency(saved.displayCurrency);
      setUsdToSgd(savedNumber(saved.usdToSgd, 1.26));
      if (saved.mobileScenario === 'sg' || saved.mobileScenario === 'us') setMobileScenario(saved.mobileScenario);

      setSgBase(savedNumber(saved.sgBase, 54_000));
      setSgBonus(savedNumber(saved.sgBonus, 4_500));
      setSgEquity(savedNumber(saved.sgEquity, 0));
      setSgBenefits(savedBenefits(saved.sgBenefits, sgBenefitsInitial));
      setSgExpenses(savedExpenses(saved.sgExpenses, sgExpensesInitial));
      if (saved.cpfStatus === 'full' || saved.cpfStatus === 'pr-year-1' || saved.cpfStatus === 'pr-year-2' || saved.cpfStatus === 'none') setCpfStatus(saved.cpfStatus);
      if (saved.ageBand === '55-and-below' || saved.ageBand === '55-60' || saved.ageBand === '60-65' || saved.ageBand === '65-70' || saved.ageBand === 'above-70') setAgeBand(saved.ageBand);
      if (typeof saved.sgTaxResident === 'boolean') setSgTaxResident(saved.sgTaxResident);
      setSgOtherReliefs(savedNumber(saved.sgOtherReliefs, 0));

      setUsBase(savedNumber(saved.usBase, 145_000));
      setUsBonus(savedNumber(saved.usBonus, 0));
      setUsEquity(savedNumber(saved.usEquity, 0));
      setUsBenefits(savedBenefits(saved.usBenefits, usBenefitsInitial));
      setUsExpenses(savedExpenses(saved.usExpenses, usExpensesInitial));
      setRetirement401k(savedNumber(saved.retirement401k, 14_500));
      setOtherPretax(savedNumber(saved.otherPretax, 1_500));
      if (saved.federalMode === 'automatic' || saved.federalMode === 'manual') setFederalMode(saved.federalMode);
      setManualFederalTax(savedNumber(saved.manualFederalTax, 0));
      if (saved.stateMode === 'rate' || saved.stateMode === 'annual') setStateMode(saved.stateMode);
      setStateValue(savedNumber(saved.stateValue, 7.5));
      if (typeof saved.usLocation === 'string') setUsLocation(saved.usLocation);
    } catch {
      // Ignore unavailable or malformed browser storage and keep safe defaults.
    } finally {
      setStorageReady(true);
    }
  }, []);
  /* oxlint-enable react/react-compiler */

  useEffect(() => {
    if (!storageReady) return;
    const saved: SavedPlannerState = {
      period, displayCurrency, usdToSgd, mobileScenario,
      sgBase, sgBonus, sgEquity, sgBenefits, sgExpenses, cpfStatus, ageBand,
      sgTaxResident, sgOtherReliefs,
      usBase, usBonus, usEquity, usBenefits, usExpenses, retirement401k,
      otherPretax, federalMode, manualFederalTax, stateMode, stateValue,
      usLocation,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // The calculator still works when a browser blocks local storage.
    }
  }, [storageReady, period, displayCurrency, usdToSgd, mobileScenario, sgBase, sgBonus, sgEquity, sgBenefits, sgExpenses, cpfStatus, ageBand, sgTaxResident, sgOtherReliefs, usBase, usBonus, usEquity, usBenefits, usExpenses, retirement401k, otherPretax, federalMode, manualFederalTax, stateMode, stateValue, usLocation]);

  const sg = useMemo(() => calculateSingapore({ base: sgBase, bonus: sgBonus, equity: sgEquity, benefits: sgBenefits, expenses: sgExpenses, cpfStatus, ageBand, taxResident: sgTaxResident, otherReliefs: sgOtherReliefs }), [sgBase, sgBonus, sgEquity, sgBenefits, sgExpenses, cpfStatus, ageBand, sgTaxResident, sgOtherReliefs]);
  const us = useMemo(() => calculateUnitedStates({ base: usBase, bonus: usBonus, equity: usEquity, benefits: usBenefits, expenses: usExpenses, retirement401k, otherPretax, federalMode, manualFederalTax, stateMode, stateValue }), [usBase, usBonus, usEquity, usBenefits, usExpenses, retirement401k, otherPretax, federalMode, manualFederalTax, stateMode, stateValue]);

  const convert = (value: number, region: 'sg' | 'us') => displayCurrency === 'SGD' ? (region === 'sg' ? value : value * usdToSgd) : (region === 'us' ? value : value / usdToSgd);
  const display = (value: number, region: 'sg' | 'us') => formatMoney(convert(value, region) / (period === 'monthly' ? 12 : 1), displayCurrency);
  const sgDisposable = convert(sg.disposableIncome, 'sg');
  const usDisposable = convert(us.disposableIncome, 'us');
  const winner = sgDisposable >= usDisposable ? 'Singapore' : 'U.S.';
  const delta = Math.abs(sgDisposable - usDisposable);
  const periodLabel = period === 'annual' ? 'a year' : 'a month';

  const comparisonRows = [
    ['Total employer package', sg.employerPackage, us.employerPackage],
    ['Gross spendable compensation', sg.grossCash, us.grossCash],
    ['Income tax estimate', sg.incomeTax, us.incomeTax],
    ['Employee statutory payroll', sg.employeeStatutory, us.employeeStatutory],
    ['Employee pre-tax savings', sg.employeeVoluntary, us.employeeVoluntary],
    ['Living costs', sg.livingExpenses, us.livingExpenses],
    ['Disposable after costs', sg.disposableIncome, us.disposableIncome],
  ] as const;

  return (
    <main>
      <header className="site-header">
        <div className="header-inner"><a className="brand" href="#top" aria-label="Package Planner home"><span className="brand-mark"><ArrowRightLeft /></span><span>Package Planner</span></a><div className="model-pill"><span />2026 model</div></div>
      </header>

      <div className="app-shell" id="top">
        <section className="intro-grid">
          <div className="intro-copy"><p className="eyebrow">SG ↔ US H-1B1 COMPARISON</p><h1>Package, not just paycheck.</h1><p>Compare employer cost, what reaches you, and what remains after tax and life.</p></div>
          <div className="global-controls" aria-label="Comparison settings">
            <div className="control-group"><span>Results</span><span className="segmented-control"><button className={period === 'annual' ? 'active' : ''} type="button" onClick={() => setPeriod('annual')}>Annual</button><button className={period === 'monthly' ? 'active' : ''} type="button" onClick={() => setPeriod('monthly')}>Monthly</button></span></div>
            <div className="control-group"><span>Display in</span><span className="segmented-control"><button className={displayCurrency === 'SGD' ? 'active' : ''} type="button" onClick={() => setDisplayCurrency('SGD')}>SGD</button><button className={displayCurrency === 'USD' ? 'active' : ''} type="button" onClick={() => setDisplayCurrency('USD')}>USD</button></span></div>
            <NumberField label="Exchange rate" value={usdToSgd} onChange={(value) => setUsdToSgd(Math.max(0.01, value))} prefix="US$1 = S$" hint="Manual scenario rate" step={0.01} />
          </div>
        </section>

        <section className="workspace-section" id="inputs">
          <div className="block-title"><div><p className="eyebrow">YOUR SCENARIOS</p><h2>Build each offer</h2></div><p>All compensation and benefit inputs are annual. Living costs are monthly. Changes save automatically on this browser.</p></div>
          <div className="mobile-scenario-toggle" aria-label="Choose scenario to edit"><button className={mobileScenario === 'sg' ? 'active' : ''} type="button" onClick={() => setMobileScenario('sg')}>Singapore</button><button className={mobileScenario === 'us' ? 'active' : ''} type="button" onClick={() => setMobileScenario('us')}>U.S. H-1B1</button></div>
          <div className="scenario-grid">
            <article className={`scenario-card sg ${mobileScenario !== 'sg' ? 'mobile-hidden' : ''}`}>
              <div className="scenario-head"><div><span className="flag-mark">SG</span><div><p>SINGAPORE</p><h2>2 YOE QA role</h2></div></div><span>SGD</span></div>
              <div className="editor-section"><SectionHeading icon={<BadgeDollarSign />} title="Compensation" copy="Annual employee compensation before tax." /><div className="field-grid three"><NumberField label="Base salary" prefix="S$" value={sgBase} onChange={setSgBase} /><NumberField label="Expected bonus" prefix="S$" value={sgBonus} onChange={setSgBonus} /><NumberField label="Annualized equity" prefix="S$" value={sgEquity} onChange={setSgEquity} /></div></div>
              <BenefitEditor currency="SGD" benefits={sgBenefits} setBenefits={setSgBenefits} />
              <div className="editor-section">
                <SectionHeading icon={<Landmark />} title="CPF & tax profile" copy="2026 CPF rules and resident tax rates from YA 2024 onward." />
                <div className="select-grid">
                  <label htmlFor="cpf-status"><span className="field-label">CPF status</span><NativeSelect id="cpf-status" value={cpfStatus} onChange={(event) => setCpfStatus(event.target.value as CpfStatus)}><NativeSelectOption value="full">Citizen / PR year 3+</NativeSelectOption><NativeSelectOption value="pr-year-1">PR year 1</NativeSelectOption><NativeSelectOption value="pr-year-2">PR year 2</NativeSelectOption><NativeSelectOption value="none">Not CPF-eligible</NativeSelectOption></NativeSelect></label>
                  <label htmlFor="age-band"><span className="field-label">Age band</span><NativeSelect id="age-band" value={ageBand} onChange={(event) => setAgeBand(event.target.value as AgeBand)}>{Object.entries(ageLabels).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}</NativeSelect></label>
                  <label htmlFor="sg-tax-residency"><span className="field-label">Tax residency</span><NativeSelect id="sg-tax-residency" value={sgTaxResident ? 'resident' : 'nonresident'} onChange={(event) => setSgTaxResident(event.target.value === 'resident')}><NativeSelectOption value="resident">Singapore tax resident</NativeSelectOption><NativeSelectOption value="nonresident">Non-resident (61–182 days)</NativeSelectOption></NativeSelect></label>
                  <NumberField label="Other personal reliefs" prefix="S$" value={sgOtherReliefs} onChange={setSgOtherReliefs} />
                </div>
                <div className="tax-result-strip">
                  <span><small>Estimated income tax</small><strong>{formatMoney(sg.incomeTax, 'SGD')}</strong></span>
                  <span><small>Chargeable income</small><strong>{formatMoney(sg.chargeableIncome, 'SGD')}</strong></span>
                  <span><small>Modeled reliefs</small><strong>{formatMoney(sg.reliefs, 'SGD')}</strong></span>
                </div>
                <div className="calculation-note"><CircleHelp /><p><strong>{formatMoney(sg.employerCpf, 'SGD')} employer CPF</strong> is included in package cost, not take-home. Employee CPF is estimated at {formatMoney(sg.employeeCpf, 'SGD')} on {formatMoney(sg.cpfWages, 'SGD')} of CPF wages.</p></div>
              </div>
              <ExpenseEditor currency="SGD" expenses={sgExpenses} setExpenses={setSgExpenses} />
            </article>

            <article className={`scenario-card us ${mobileScenario !== 'us' ? 'mobile-hidden' : ''}`}>
              <div className="scenario-head"><div><span className="flag-mark">US</span><div><p>UNITED STATES</p><h2>SWE / FDE transition</h2></div></div><span>USD</span></div>
              <div className="editor-section"><SectionHeading icon={<BadgeDollarSign />} title="Compensation" copy="Annual employee compensation before tax." /><div className="field-grid three"><NumberField label="Base salary" prefix="US$" value={usBase} onChange={setUsBase} /><NumberField label="Expected bonus" prefix="US$" value={usBonus} onChange={setUsBonus} /><NumberField label="Annualized equity" prefix="US$" value={usEquity} onChange={setUsEquity} hint="Keep private options at US$0; model them below as package-only." /></div></div>
              <BenefitEditor currency="USD" benefits={usBenefits} setBenefits={setUsBenefits} />
              <div className="editor-section">
                <SectionHeading icon={<Landmark />} title="Tax & payroll profile" copy="2026 federal single-filer rates; state and local tax stays editable." />
                <div className="select-grid">
                  <label htmlFor="federal-treatment"><span className="field-label">Federal treatment</span><NativeSelect id="federal-treatment" value={federalMode} onChange={(event) => setFederalMode(event.target.value as 'automatic' | 'manual')}><NativeSelectOption value="automatic">Full-year resident · auto</NativeSelectOption><NativeSelectOption value="manual">NRA / dual-status · manual</NativeSelectOption></NativeSelect></label>
                  {federalMode === 'manual' ? <NumberField label="Federal tax estimate" prefix="US$" value={manualFederalTax} onChange={setManualFederalTax} /> : <div className="read-only-field"><span>Standard deduction</span><strong>US$16,100</strong></div>}
                  <label htmlFor="us-location"><span className="field-label">Work state / city</span><Input id="us-location" value={usLocation} onChange={(event) => setUsLocation(event.target.value)} /></label>
                  <label htmlFor="state-local-method"><span className="field-label">State/local method</span><NativeSelect id="state-local-method" value={stateMode} onChange={(event) => setStateMode(event.target.value as 'rate' | 'annual')}><NativeSelectOption value="rate">Effective-rate scenario</NativeSelectOption><NativeSelectOption value="annual">Annual manual estimate</NativeSelectOption></NativeSelect></label>
                  <NumberField label={stateMode === 'rate' ? 'State/local effective rate' : 'State/local annual tax'} prefix={stateMode === 'annual' ? 'US$' : undefined} suffix={stateMode === 'rate' ? '%' : undefined} value={stateValue} onChange={setStateValue} step={stateMode === 'rate' ? 0.1 : 100} />
                  <NumberField label="Employee 401(k)" prefix="US$" value={retirement401k} onChange={setRetirement401k} hint="Reduces federal taxable income" />
                  <NumberField label="Pre-tax health / HSA" prefix="US$" value={otherPretax} onChange={setOtherPretax} hint="Modeled as reducing FIT and FICA wages" />
                </div>
                <div className="tax-result-strip">
                  <span><small>Federal tax</small><strong>{formatMoney(us.federalIncomeTax, 'USD')}</strong></span>
                  <span><small>State/local scenario</small><strong>{formatMoney(us.stateLocalTax, 'USD')}</strong></span>
                  <span><small>Employee FICA</small><strong>{formatMoney(us.employeeFica, 'USD')}</strong></span>
                </div>
                {federalMode === 'manual' ? <div className="warning-note"><CircleHelp /><p>H-1B1 status alone does not determine income-tax residency. Enter a manual federal estimate for non-resident or dual-status years.</p></div> : null}
                <div className="calculation-note"><CircleHelp /><p><strong>{formatMoney(us.employerFica, 'USD')} employer FICA</strong> is included as employer package cost, not employee wealth. Employee FICA is {formatMoney(us.employeeFica, 'USD')}.</p></div>
              </div>
              <ExpenseEditor currency="USD" expenses={usExpenses} setExpenses={setUsExpenses} />
            </article>
          </div>
        </section>

        <section className="outcome-card" aria-live="polite">
          <div className="outcome-copy"><p className="eyebrow light">DISPOSABLE INCOME</p><h2><span>{winner}</span> leaves {formatMoney(delta / (period === 'monthly' ? 12 : 1), displayCurrency)} more {periodLabel}</h2><p>After estimated tax, payroll deductions, and the living costs above.</p></div>
          <div className="score-grid"><article className="score sg"><span>Singapore</span><strong>{display(sg.disposableIncome, 'sg')}</strong><small>{formatPercent(sg.effectiveAllInRate)} tax + statutory</small></article><div className="versus">VS</div><article className="score us"><span>U.S. H-1B1</span><strong>{display(us.disposableIncome, 'us')}</strong><small>{formatPercent(us.effectiveAllInRate)} tax + FICA</small></article></div>
        </section>

        <section className="metric-strip">
          <article><span className="metric-icon"><Building2 /></span><div><span>Employer package</span><strong>{display(sg.employerPackage, 'sg')} <i>SG</i></strong><strong>{display(us.employerPackage, 'us')} <i>US</i></strong></div></article>
          <article><span className="metric-icon"><WalletCards /></span><div><span>Net pay</span><strong>{display(sg.netPay, 'sg')} <i>SG</i></strong><strong>{display(us.netPay, 'us')} <i>US</i></strong></div></article>
          <article><span className="metric-icon"><Landmark /></span><div><span>Employer statutory cost</span><strong>{display(sg.employerStatutory, 'sg')} <i>SG CPF</i></strong><strong>{display(us.employerStatutory, 'us')} <i>US FICA</i></strong></div></article>
        </section>

        <section className="money-flow-section">
          <div className="block-title"><div><p className="eyebrow">CASH JOURNEY</p><h2>Where the gross cash goes</h2></div><p>Employer-paid benefits and contributions stay in package value, not this spendable-cash view.</p></div>
          <div className="flow-grid"><ResultFlow result={sg} region="sg" format={display} /><ResultFlow result={us} region="us" format={display} /></div>
        </section>

        <section className="comparison-section">
          <div className="block-title"><div><p className="eyebrow">SIDE BY SIDE</p><h2>One definition for every number</h2></div><p>Values below use {displayCurrency} at US$1 = S${usdToSgd.toFixed(2)}.</p></div>
          <div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Measure</th><th><span className="table-dot sg" />Singapore</th><th><span className="table-dot us" />U.S. H-1B1</th><th>Difference</th></tr></thead><tbody>
            {comparisonRows.map(([label, sgValue, usValue]) => {
              const sgConverted = convert(sgValue, 'sg') / (period === 'monthly' ? 12 : 1);
              const usConverted = convert(usValue, 'us') / (period === 'monthly' ? 12 : 1);
              const difference = usConverted - sgConverted;
              return <tr className={label === 'Disposable after costs' ? 'highlight-row' : ''} key={label}><th>{label}</th><td>{formatMoney(sgConverted, displayCurrency)}</td><td>{formatMoney(usConverted, displayCurrency)}</td><td className={difference >= 0 ? 'positive' : 'negative'}>{difference >= 0 ? '+' : '−'}{formatMoney(Math.abs(difference), displayCurrency)}</td></tr>;
            })}
          </tbody></table></div>
        </section>

        <section className="questions-section">
          <div className="questions-copy"><p className="eyebrow">BEYOND THE MATH</p><h2>The offer is more than its score.</h2><p>Use the financial result as one input. Ask both employers the same questions before you decide.</p></div>
          <div className="question-list">{['Visa transfer & job mobility', 'Healthcare exposure', 'Leave & working hours', 'Family and dependant plans', 'Retirement portability', 'Relocation and travel'].map((question) => <div key={question}><span><Check /></span>{question}<ArrowRight /></div>)}</div>
        </section>

        <section className="assumptions-section">
          <details>
            <summary><span><CircleHelp /> Calculation notes & official sources</span><ChevronDown /></summary>
            <div className="assumption-content">
              <div><h3>Singapore</h3><p>Projected 2026 compensation uses the resident rates published for YA 2024 onward. CPF uses the 2026 S$8,000 monthly Ordinary Wage ceiling and S$102,000 annual salary ceiling. The estimate annualizes CPF and can differ from payroll by a few dollars because CPF is rounded monthly. Equity is taxable but excluded from CPF wages in this simplified model.</p><p><a href="https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay" target="_blank" rel="noreferrer">CPF contribution rates</a><a href="https://www.cpf.gov.sg/employer/employer-obligations/what-payments-attract-cpf-contributions" target="_blank" rel="noreferrer">CPF wage ceilings</a><a href="https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates" target="_blank" rel="noreferrer">IRAS tax rates</a></p></div>
              <div><h3>United States</h3><p>Automatic mode assumes a full-year U.S. resident alien, single filer, one W-2 job, the 2026 standard deduction, and no credits, itemizing, AMT, other income, or treaty effects. FICA normally applies to H-1B1 employment. State/local tax is intentionally a manual scenario because jurisdiction rules vary.</p><p><a href="https://www.irs.gov/irb/2025-45_IRB" target="_blank" rel="noreferrer">IRS 2026 brackets</a><a href="https://www.irs.gov/publications/p15" target="_blank" rel="noreferrer">IRS payroll tax guide</a><a href="https://www.ssa.gov/OACT/COLA/cbb.html" target="_blank" rel="noreferrer">SSA wage base</a><a href="https://www.irs.gov/individuals/taxation-of-alien-individuals-by-immigration-status-h-1b" target="_blank" rel="noreferrer">H-1B1 tax residency</a></p></div>
            </div>
          </details>
          <p className="disclaimer">Planning estimate only—not tax, legal, or immigration advice. Actual liability depends on your full facts, benefit treatment, and filing position.</p>
        </section>
      </div>
    </main>
  );
}
