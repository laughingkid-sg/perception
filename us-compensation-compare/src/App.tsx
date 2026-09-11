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
  type UsStateMode,
  US_401K_LIMIT_2026,
  US_HSA_FAMILY_LIMIT_2026,
  US_HSA_SELF_LIMIT_2026,
  calculateSingapore,
  calculateUnitedStates,
} from '@/lib/calculations';

type Period = 'annual' | 'monthly';
type DisplayCurrency = 'SGD' | 'USD';
type MobileScenario = 'sg' | 'us';
type OutcomeMode = 'cash' | 'wealth';
type HsaCoverage = 'self' | 'family';

type SavedPlannerState = {
  period: Period;
  displayCurrency: DisplayCurrency;
  usdToSgd: number;
  mobileScenario: MobileScenario;
  outcomeMode: OutcomeMode;
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
  traditional401k: number;
  roth401k: number;
  healthPremiumMonthly: number;
  hsaContribution: number;
  hsaEligible: boolean;
  hsaCoverage: HsaCoverage;
  otherSection125: number;
  employer401kMatch: number;
  federalMode: 'automatic' | 'manual';
  manualFederalTax: number;
  stateMode: UsStateMode;
  stateValue: number;
};

const sgBenefitsInitial: Benefit[] = [
  {
    id: 'sg-flexi',
    name: 'Flexi wallet',
    amount: 1_800,
    mode: 'package-nontaxable',
  },
  {
    id: 'sg-food',
    name: 'Meal allowance',
    amount: 2_400,
    mode: 'cash-taxable',
  },
  {
    id: 'sg-insurance',
    name: 'Group insurance',
    amount: 1_600,
    mode: 'package-nontaxable',
  },
];

const usBenefitsInitial: Benefit[] = [
  {
    id: 'us-health',
    name: 'Employer health plan',
    amount: 7_900,
    mode: 'package-nontaxable',
  },
  {
    id: 'us-dental',
    name: 'Dental, vision & disability',
    amount: 1_200,
    mode: 'package-nontaxable',
  },
  {
    id: 'us-food',
    name: 'Meals & wellness',
    amount: 3_600,
    mode: 'package-nontaxable',
  },
  {
    id: 'us-visa',
    name: 'Visa / legal support',
    amount: 3_000,
    mode: 'package-nontaxable',
  },
  {
    id: 'us-options',
    name: 'Private options · risk-adjusted',
    amount: 10_000,
    mode: 'package-nontaxable',
  },
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

const selectZeroValue = (event: React.FocusEvent<HTMLInputElement>) => {
  if (clampNumber(event.currentTarget.value) === 0) {
    event.currentTarget.select();
  }
};

const normalizeNumberValue = (
  event: React.FocusEvent<HTMLInputElement>,
  value: number,
) => {
  event.currentTarget.value = String(value);
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

const isUsStateMode = (value: unknown): value is UsStateMode =>
  value === 'california' ||
  value === 'washington' ||
  value === 'new-york-city' ||
  value === 'texas' ||
  value === 'rate' ||
  value === 'annual';

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
    )
      return fallback;
    benefits.push({
      id: item.id,
      name: item.name,
      amount: item.amount,
      mode: item.mode,
    });
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
    )
      return fallback;
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

function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
  step = 100,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label className="number-field">
      <span className="field-label">{label}</span>
      <span className="number-control">
        {prefix ? <span className="number-prefix">{prefix}</span> : null}
        <Input
          aria-label={label}
          inputMode="decimal"
          min="0"
          step={step}
          type="number"
          value={value}
          disabled={disabled}
          onBlur={(event) => normalizeNumberValue(event, value)}
          onChange={(event) => onChange(clampNumber(event.target.value))}
          onFocus={selectZeroValue}
        />
        {suffix ? <span className="number-suffix">{suffix}</span> : null}
      </span>
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function SectionHeading({
  icon,
  title,
  copy,
}: {
  icon: React.ReactNode;
  title: string;
  copy?: string;
}) {
  return (
    <div className="section-heading">
      <span className="section-icon">{icon}</span>
      <div>
        <h3>{title}</h3>
        {copy ? <p>{copy}</p> : null}
      </div>
    </div>
  );
}

function BenefitEditor({
  currency,
  benefits,
  setBenefits,
}: {
  currency: DisplayCurrency;
  benefits: Benefit[];
  setBenefits: React.Dispatch<React.SetStateAction<Benefit[]>>;
}) {
  const update = (id: string, patch: Partial<Benefit>) =>
    setBenefits((current) =>
      current.map((benefit) =>
        benefit.id === id ? { ...benefit, ...patch } : benefit,
      ),
    );

  return (
    <div className="editor-section">
      <SectionHeading
        icon={<ShieldCheck />}
        title="Benefits & package cost"
        copy="Mark whether value reaches you as cash and whether it is taxable."
      />
      <div className="repeat-list">
        {benefits.map((benefit) => (
          <div className="benefit-row" key={benefit.id}>
            <Input
              aria-label="Benefit name"
              className="name-input"
              value={benefit.name}
              onChange={(event) =>
                update(benefit.id, { name: event.target.value })
              }
            />
            <span className="compact-money">
              <span>{currency === 'SGD' ? 'S$' : 'US$'}</span>
              <Input
                aria-label={`${benefit.name || 'Benefit'} annual value`}
                inputMode="decimal"
                min="0"
                step="100"
                type="number"
                value={benefit.amount}
                onBlur={(event) => normalizeNumberValue(event, benefit.amount)}
                onChange={(event) =>
                  update(benefit.id, {
                    amount: clampNumber(event.target.value),
                  })
                }
                onFocus={selectZeroValue}
              />
            </span>
            <NativeSelect
              aria-label={`${benefit.name || 'Benefit'} treatment`}
              className="mode-select"
              value={benefit.mode}
              onChange={(event) =>
                update(benefit.id, { mode: event.target.value as BenefitMode })
              }
            >
              {Object.entries(benefitModeLabels).map(([value, label]) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button
              aria-label={`Remove ${benefit.name || 'benefit'}`}
              className="remove-button"
              size="icon"
              type="button"
              variant="ghost"
              onClick={() =>
                setBenefits((current) =>
                  current.filter((item) => item.id !== benefit.id),
                )
              }
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <Button
        className="add-row-button"
        type="button"
        variant="ghost"
        onClick={() =>
          setBenefits((current) => [
            ...current,
            {
              id: uid(),
              name: 'New benefit',
              amount: 0,
              mode: 'package-nontaxable',
            },
          ])
        }
      >
        <Plus /> Add benefit
      </Button>
    </div>
  );
}

function ExpenseEditor({
  currency,
  expenses,
  setExpenses,
}: {
  currency: DisplayCurrency;
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
}) {
  const update = (id: string, patch: Partial<Expense>) =>
    setExpenses((current) =>
      current.map((expense) =>
        expense.id === id ? { ...expense, ...patch } : expense,
      ),
    );

  return (
    <div className="editor-section">
      <SectionHeading
        icon={<ReceiptText />}
        title="Monthly living costs"
        copy="Personal spending is deducted after tax—it is not a tax relief."
      />
      <div className="repeat-list">
        {expenses.map((expense) => (
          <div className="expense-row" key={expense.id}>
            <Input
              aria-label="Expense name"
              className="name-input"
              value={expense.name}
              onChange={(event) =>
                update(expense.id, { name: event.target.value })
              }
            />
            <span className="compact-money">
              <span>{currency === 'SGD' ? 'S$' : 'US$'}</span>
              <Input
                aria-label={`${expense.name || 'Expense'} monthly amount`}
                inputMode="decimal"
                min="0"
                step="50"
                type="number"
                value={expense.monthly}
                onBlur={(event) => normalizeNumberValue(event, expense.monthly)}
                onChange={(event) =>
                  update(expense.id, {
                    monthly: clampNumber(event.target.value),
                  })
                }
                onFocus={selectZeroValue}
              />
            </span>
            <Button
              aria-label={`Remove ${expense.name || 'expense'}`}
              className="remove-button"
              size="icon"
              type="button"
              variant="ghost"
              onClick={() =>
                setExpenses((current) =>
                  current.filter((item) => item.id !== expense.id),
                )
              }
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <Button
        className="add-row-button"
        type="button"
        variant="ghost"
        onClick={() =>
          setExpenses((current) => [
            ...current,
            { id: uid(), name: 'New expense', monthly: 0 },
          ])
        }
      >
        <Plus /> Add expense
      </Button>
    </div>
  );
}

function ResultFlow({
  result,
  region,
  format,
}: {
  result: RegionResult;
  region: 'sg' | 'us';
  format: (value: number, region: 'sg' | 'us') => string;
}) {
  const values = {
    tax: Math.max(0, result.incomeTax),
    statutory: Math.max(0, result.employeeStatutory),
    savings: Math.max(0, result.employeeVoluntary),
    benefits: Math.max(0, result.employeeBenefits),
    living: Math.max(0, result.livingExpenses),
    left: Math.max(0, result.disposableIncome),
  };
  const total = Math.max(
    1,
    values.tax +
      values.statutory +
      values.savings +
      values.benefits +
      values.living +
      values.left,
  );
  return (
    <div className={`flow-card ${region}`}>
      <div className="flow-heading">
        <div>
          <span className="region-dot" />
          <strong>{region === 'sg' ? 'Singapore' : 'United States'}</strong>
        </div>
        <span>{format(result.grossCash, region)} gross cash</span>
      </div>
      <div className="flow-bar" aria-label="Cash allocation">
        <span
          className="flow-tax"
          style={{ width: `${(values.tax / total) * 100}%` }}
        />
        <span
          className="flow-statutory"
          style={{ width: `${(values.statutory / total) * 100}%` }}
        />
        <span
          className="flow-savings"
          style={{ width: `${(values.savings / total) * 100}%` }}
        />
        <span
          className="flow-benefits"
          style={{ width: `${(values.benefits / total) * 100}%` }}
        />
        <span
          className="flow-living"
          style={{ width: `${(values.living / total) * 100}%` }}
        />
        <span
          className="flow-left"
          style={{ width: `${(values.left / total) * 100}%` }}
        />
      </div>
      <div className="flow-legend">
        <span>
          <i className="tax" />
          Tax {format(result.incomeTax, region)}
        </span>
        <span>
          <i className="statutory" />
          Mandatory payroll {format(result.employeeStatutory, region)}
        </span>
        {result.employeeVoluntary > 0 ? (
          <span>
            <i className="savings" />
            Optional savings {format(result.employeeVoluntary, region)}
          </span>
        ) : null}
        {result.employeeBenefits > 0 ? (
          <span>
            <i className="benefits" />
            Payroll benefits {format(result.employeeBenefits, region)}
          </span>
        ) : null}
        <span>
          <i className="living" />
          Life {format(result.livingExpenses, region)}
        </span>
        <span>
          <i className="left" />
          Cash surplus {format(result.disposableIncome, region)}
        </span>
      </div>
      {result.disposableIncome < 0 ? (
        <p className="deficit-note">
          Living costs exceed modeled net pay by{' '}
          {format(Math.abs(result.disposableIncome), region)}.
        </p>
      ) : null}
    </div>
  );
}

export default function App() {
  const [storageReady, setStorageReady] = useState(false);
  const [period, setPeriod] = useState<Period>('annual');
  const [displayCurrency, setDisplayCurrency] =
    useState<DisplayCurrency>('SGD');
  const [usdToSgd, setUsdToSgd] = useState(1.26);
  const [mobileScenario, setMobileScenario] = useState<MobileScenario>('sg');
  const [outcomeMode, setOutcomeMode] = useState<OutcomeMode>('cash');

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
  const [traditional401k, setTraditional401k] = useState(0);
  const [roth401k, setRoth401k] = useState(0);
  const [healthPremiumMonthly, setHealthPremiumMonthly] = useState(0);
  const [hsaContribution, setHsaContribution] = useState(0);
  const [hsaEligible, setHsaEligible] = useState(false);
  const [hsaCoverage, setHsaCoverage] = useState<HsaCoverage>('self');
  const [otherSection125, setOtherSection125] = useState(0);
  const [employer401kMatch, setEmployer401kMatch] = useState(0);
  const [federalMode, setFederalMode] = useState<'automatic' | 'manual'>(
    'automatic',
  );
  const [manualFederalTax, setManualFederalTax] = useState(0);
  const [stateMode, setStateMode] = useState<UsStateMode>('california');
  const [stateValue, setStateValue] = useState(7.5);

  /* oxlint-disable react/react-compiler -- Hydrate controlled inputs from browser storage once after mount. */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as unknown;
      if (!isRecordValue(saved)) return;

      if (saved.period === 'annual' || saved.period === 'monthly')
        setPeriod(saved.period);
      if (saved.displayCurrency === 'SGD' || saved.displayCurrency === 'USD')
        setDisplayCurrency(saved.displayCurrency);
      setUsdToSgd(savedNumber(saved.usdToSgd, 1.26));
      if (saved.mobileScenario === 'sg' || saved.mobileScenario === 'us')
        setMobileScenario(saved.mobileScenario);
      if (saved.outcomeMode === 'cash' || saved.outcomeMode === 'wealth')
        setOutcomeMode(saved.outcomeMode);

      setSgBase(savedNumber(saved.sgBase, 54_000));
      setSgBonus(savedNumber(saved.sgBonus, 4_500));
      setSgEquity(savedNumber(saved.sgEquity, 0));
      setSgBenefits(savedBenefits(saved.sgBenefits, sgBenefitsInitial));
      setSgExpenses(savedExpenses(saved.sgExpenses, sgExpensesInitial));
      if (
        saved.cpfStatus === 'full' ||
        saved.cpfStatus === 'pr-year-1' ||
        saved.cpfStatus === 'pr-year-2' ||
        saved.cpfStatus === 'none'
      )
        setCpfStatus(saved.cpfStatus);
      if (
        saved.ageBand === '55-and-below' ||
        saved.ageBand === '55-60' ||
        saved.ageBand === '60-65' ||
        saved.ageBand === '65-70' ||
        saved.ageBand === 'above-70'
      )
        setAgeBand(saved.ageBand);
      if (typeof saved.sgTaxResident === 'boolean')
        setSgTaxResident(saved.sgTaxResident);
      setSgOtherReliefs(savedNumber(saved.sgOtherReliefs, 0));

      setUsBase(savedNumber(saved.usBase, 145_000));
      setUsBonus(savedNumber(saved.usBonus, 0));
      setUsEquity(savedNumber(saved.usEquity, 0));
      const migratedUsBenefits = savedBenefits(
        saved.usBenefits,
        usBenefitsInitial,
      );
      const legacyEmployerMatch = migratedUsBenefits.find(
        (benefit) => benefit.id === 'us-match',
      );
      setUsBenefits(
        migratedUsBenefits.filter((benefit) => benefit.id !== 'us-match'),
      );
      setUsExpenses(savedExpenses(saved.usExpenses, usExpensesInitial));
      setTraditional401k(
        savedNumber(
          saved.traditional401k,
          savedNumber(saved.retirement401k, 0),
        ),
      );
      setRoth401k(savedNumber(saved.roth401k, 0));
      setHealthPremiumMonthly(savedNumber(saved.healthPremiumMonthly, 0));
      const savedHsaEligible = saved.hsaEligible === true;
      setHsaEligible(savedHsaEligible);
      setHsaContribution(
        savedHsaEligible ? savedNumber(saved.hsaContribution, 0) : 0,
      );
      if (saved.hsaCoverage === 'self' || saved.hsaCoverage === 'family')
        setHsaCoverage(saved.hsaCoverage);
      setOtherSection125(
        savedNumber(saved.otherSection125, savedNumber(saved.otherPretax, 0)),
      );
      setEmployer401kMatch(
        savedNumber(saved.employer401kMatch, legacyEmployerMatch?.amount ?? 0),
      );
      if (saved.federalMode === 'automatic' || saved.federalMode === 'manual')
        setFederalMode(saved.federalMode);
      setManualFederalTax(savedNumber(saved.manualFederalTax, 0));
      if (isUsStateMode(saved.stateMode)) {
        const wasCaliforniaScenario =
          (saved.stateMode === 'rate' || saved.stateMode === 'annual') &&
          typeof saved.usLocation === 'string' &&
          saved.usLocation.toLowerCase().includes('california');
        setStateMode(wasCaliforniaScenario ? 'california' : saved.stateMode);
      }
      setStateValue(savedNumber(saved.stateValue, 7.5));
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
      period,
      displayCurrency,
      usdToSgd,
      mobileScenario,
      outcomeMode,
      sgBase,
      sgBonus,
      sgEquity,
      sgBenefits,
      sgExpenses,
      cpfStatus,
      ageBand,
      sgTaxResident,
      sgOtherReliefs,
      usBase,
      usBonus,
      usEquity,
      usBenefits,
      usExpenses,
      traditional401k,
      roth401k,
      healthPremiumMonthly,
      hsaContribution,
      hsaEligible,
      hsaCoverage,
      otherSection125,
      employer401kMatch,
      federalMode,
      manualFederalTax,
      stateMode,
      stateValue,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // The calculator still works when a browser blocks local storage.
    }
  }, [
    storageReady,
    period,
    displayCurrency,
    usdToSgd,
    mobileScenario,
    outcomeMode,
    sgBase,
    sgBonus,
    sgEquity,
    sgBenefits,
    sgExpenses,
    cpfStatus,
    ageBand,
    sgTaxResident,
    sgOtherReliefs,
    usBase,
    usBonus,
    usEquity,
    usBenefits,
    usExpenses,
    traditional401k,
    roth401k,
    healthPremiumMonthly,
    hsaContribution,
    hsaEligible,
    hsaCoverage,
    otherSection125,
    employer401kMatch,
    federalMode,
    manualFederalTax,
    stateMode,
    stateValue,
  ]);

  const sg = useMemo(
    () =>
      calculateSingapore({
        base: sgBase,
        bonus: sgBonus,
        equity: sgEquity,
        benefits: sgBenefits,
        expenses: sgExpenses,
        cpfStatus,
        ageBand,
        taxResident: sgTaxResident,
        otherReliefs: sgOtherReliefs,
      }),
    [
      sgBase,
      sgBonus,
      sgEquity,
      sgBenefits,
      sgExpenses,
      cpfStatus,
      ageBand,
      sgTaxResident,
      sgOtherReliefs,
    ],
  );
  const us = useMemo(
    () =>
      calculateUnitedStates({
        base: usBase,
        bonus: usBonus,
        equity: usEquity,
        benefits: usBenefits,
        expenses: usExpenses,
        traditional401k,
        roth401k,
        healthPremiumMonthly,
        hsaContribution,
        hsaEligible,
        hsaCoverage,
        otherSection125,
        employer401kMatch,
        federalMode,
        manualFederalTax,
        stateMode,
        stateValue,
      }),
    [
      usBase,
      usBonus,
      usEquity,
      usBenefits,
      usExpenses,
      traditional401k,
      roth401k,
      healthPremiumMonthly,
      hsaContribution,
      hsaEligible,
      hsaCoverage,
      otherSection125,
      employer401kMatch,
      federalMode,
      manualFederalTax,
      stateMode,
      stateValue,
    ],
  );

  const convert = (value: number, region: 'sg' | 'us') =>
    displayCurrency === 'SGD'
      ? region === 'sg'
        ? value
        : value * usdToSgd
      : region === 'us'
        ? value
        : value / usdToSgd;
  const display = (value: number, region: 'sg' | 'us') =>
    formatMoney(
      convert(value, region) / (period === 'monthly' ? 12 : 1),
      displayCurrency,
    );
  const sgOutcome = convert(
    outcomeMode === 'cash' ? sg.disposableIncome : sg.wealthAccumulation,
    'sg',
  );
  const usOutcome = convert(
    outcomeMode === 'cash' ? us.disposableIncome : us.wealthAccumulation,
    'us',
  );
  const winner = sgOutcome >= usOutcome ? 'Singapore' : 'U.S.';
  const delta = Math.abs(sgOutcome - usOutcome);
  const periodLabel = period === 'annual' ? 'a year' : 'a month';
  const hsaLimit =
    hsaCoverage === 'family'
      ? US_HSA_FAMILY_LIMIT_2026
      : US_HSA_SELF_LIMIT_2026;
  const stateTaxLabel =
    stateMode === 'california'
      ? 'California tax'
      : stateMode === 'washington'
        ? 'Washington tax'
        : stateMode === 'new-york-city'
          ? 'NY + NYC tax'
          : stateMode === 'texas'
            ? 'Texas tax'
            : 'State tax scenario';
  const statePayrollLabel =
    stateMode === 'california'
      ? 'California SDI'
      : stateMode === 'washington'
        ? 'WA Paid Leave + Cares'
        : stateMode === 'new-york-city'
          ? 'New York PFL'
          : 'State payroll';
  const stateModeNote =
    stateMode === 'california' ? (
      <>
        California mode uses the 2026 estimated-tax method and adds{' '}
        <strong>1.3% SDI</strong>. HSA contributions reduce the federal estimate
        but not California taxable income.
      </>
    ) : stateMode === 'washington' ? (
      <>
        Seattle mode has no 2026 individual state income tax. It includes the
        employee share of <strong>WA Paid Leave</strong> and the{' '}
        <strong>0.58% WA Cares</strong> premium; an employer may cover some or
        all of these employee premiums.
      </>
    ) : stateMode === 'new-york-city' ? (
      <>
        New York City mode combines 2026 New York State and NYC resident tax
        schedules for a single filer, plus the{' '}
        <strong>NY Paid Family Leave</strong> premium capped at US$411.91.
        Credits and high-income benefit recapture are not modeled.
      </>
    ) : stateMode === 'texas' ? (
      <>
        Texas mode applies no individual state income tax or state employee
        payroll deduction in this estimate.
      </>
    ) : null;
  const total401k = traditional401k + roth401k;

  const comparisonRows = [
    ['Total employer package', sg.employerPackage, us.employerPackage],
    ['Gross cash compensation', sg.grossCash, us.grossCash],
    ['Income tax estimate', sg.incomeTax, us.incomeTax],
    ['Mandatory employee payroll', sg.employeeStatutory, us.employeeStatutory],
    [
      'Optional retirement / HSA savings',
      sg.employeeVoluntary,
      us.employeeVoluntary,
    ],
    ['Employee payroll benefits', sg.employeeBenefits, us.employeeBenefits],
    ['Living costs', sg.livingExpenses, us.livingExpenses],
    [
      'Cash surplus after living costs',
      sg.disposableIncome,
      us.disposableIncome,
    ],
    ['Total wealth added', sg.wealthAccumulation, us.wealthAccumulation],
  ] as const;

  return (
    <main>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="Package Planner home">
            <span className="brand-mark">
              <ArrowRightLeft />
            </span>
            <span>Package Planner</span>
          </a>
          <div className="model-pill">
            <span />
            2026 model
          </div>
        </div>
      </header>

      <div className="app-shell" id="top">
        <section className="intro-grid">
          <div className="intro-copy">
            <p className="eyebrow">SG ↔ US H-1B1 COMPARISON</p>
            <h1>Package, not just paycheck.</h1>
            <p>
              Compare employer cost, what reaches you, and what remains after
              tax and life.
            </p>
          </div>
          <div className="global-controls" aria-label="Comparison settings">
            <div className="control-group">
              <span>Results</span>
              <span className="segmented-control">
                <button
                  className={period === 'annual' ? 'active' : ''}
                  type="button"
                  onClick={() => setPeriod('annual')}
                >
                  Annual
                </button>
                <button
                  className={period === 'monthly' ? 'active' : ''}
                  type="button"
                  onClick={() => setPeriod('monthly')}
                >
                  Monthly
                </button>
              </span>
            </div>
            <div className="control-group">
              <span>Display in</span>
              <span className="segmented-control">
                <button
                  className={displayCurrency === 'SGD' ? 'active' : ''}
                  type="button"
                  onClick={() => setDisplayCurrency('SGD')}
                >
                  SGD
                </button>
                <button
                  className={displayCurrency === 'USD' ? 'active' : ''}
                  type="button"
                  onClick={() => setDisplayCurrency('USD')}
                >
                  USD
                </button>
              </span>
            </div>
            <NumberField
              label="Exchange rate"
              value={usdToSgd}
              onChange={(value) => setUsdToSgd(Math.max(0.01, value))}
              prefix="US$1 = S$"
              hint="Manual scenario rate"
              step={0.01}
            />
          </div>
        </section>

        <section className="workspace-section" id="inputs">
          <div className="block-title">
            <div>
              <p className="eyebrow">YOUR SCENARIOS</p>
              <h2>Build each offer</h2>
            </div>
            <p>
              All compensation and benefit inputs are annual. Living costs are
              monthly. Changes save automatically on this browser.
            </p>
          </div>
          <div
            className="mobile-scenario-toggle"
            aria-label="Choose scenario to edit"
          >
            <button
              className={mobileScenario === 'sg' ? 'active' : ''}
              type="button"
              onClick={() => setMobileScenario('sg')}
            >
              Singapore
            </button>
            <button
              className={mobileScenario === 'us' ? 'active' : ''}
              type="button"
              onClick={() => setMobileScenario('us')}
            >
              U.S. H-1B1
            </button>
          </div>
          <div className="scenario-grid">
            <article
              className={`scenario-card sg ${mobileScenario !== 'sg' ? 'mobile-hidden' : ''}`}
            >
              <div className="scenario-head">
                <div>
                  <span className="flag-mark">SG</span>
                  <div>
                    <p>SINGAPORE</p>
                    <h2>Singapore offer</h2>
                  </div>
                </div>
                <span>SGD</span>
              </div>
              <div className="editor-section">
                <SectionHeading
                  icon={<BadgeDollarSign />}
                  title="Compensation"
                  copy="Annual employee compensation before tax."
                />
                <div className="field-grid three">
                  <NumberField
                    label="Base salary"
                    prefix="S$"
                    value={sgBase}
                    onChange={setSgBase}
                  />
                  <NumberField
                    label="Expected bonus"
                    prefix="S$"
                    value={sgBonus}
                    onChange={setSgBonus}
                  />
                  <NumberField
                    label="Annualized equity"
                    prefix="S$"
                    value={sgEquity}
                    onChange={setSgEquity}
                  />
                </div>
                <div className="compensation-total">
                  <span>
                    <strong>Total comp</strong>
                    <small>Base + bonus + equity</small>
                  </span>
                  <b>{formatMoney(sgBase + sgBonus + sgEquity, 'SGD')}</b>
                </div>
              </div>
              <BenefitEditor
                currency="SGD"
                benefits={sgBenefits}
                setBenefits={setSgBenefits}
              />
              <div className="editor-section">
                <SectionHeading
                  icon={<Landmark />}
                  title="CPF & tax profile"
                  copy="2026 CPF rules and resident tax rates from YA 2024 onward."
                />
                <div className="select-grid">
                  <label htmlFor="cpf-status">
                    <span className="field-label">CPF status</span>
                    <NativeSelect
                      id="cpf-status"
                      value={cpfStatus}
                      onChange={(event) =>
                        setCpfStatus(event.target.value as CpfStatus)
                      }
                    >
                      <NativeSelectOption value="full">
                        Citizen / PR year 3+
                      </NativeSelectOption>
                      <NativeSelectOption value="pr-year-1">
                        PR year 1
                      </NativeSelectOption>
                      <NativeSelectOption value="pr-year-2">
                        PR year 2
                      </NativeSelectOption>
                      <NativeSelectOption value="none">
                        Not CPF-eligible
                      </NativeSelectOption>
                    </NativeSelect>
                  </label>
                  <label htmlFor="age-band">
                    <span className="field-label">Age band</span>
                    <NativeSelect
                      id="age-band"
                      value={ageBand}
                      onChange={(event) =>
                        setAgeBand(event.target.value as AgeBand)
                      }
                    >
                      {Object.entries(ageLabels).map(([value, label]) => (
                        <NativeSelectOption key={value} value={value}>
                          {label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </label>
                  <label htmlFor="sg-tax-residency">
                    <span className="field-label">Tax residency</span>
                    <NativeSelect
                      id="sg-tax-residency"
                      value={sgTaxResident ? 'resident' : 'nonresident'}
                      onChange={(event) =>
                        setSgTaxResident(event.target.value === 'resident')
                      }
                    >
                      <NativeSelectOption value="resident">
                        Singapore tax resident
                      </NativeSelectOption>
                      <NativeSelectOption value="nonresident">
                        Non-resident (61–182 days)
                      </NativeSelectOption>
                    </NativeSelect>
                  </label>
                  <NumberField
                    label="Other personal reliefs"
                    prefix="S$"
                    value={sgOtherReliefs}
                    onChange={setSgOtherReliefs}
                  />
                </div>
                <div className="tax-result-strip">
                  <span>
                    <small>Estimated income tax</small>
                    <strong>{formatMoney(sg.incomeTax, 'SGD')}</strong>
                  </span>
                  <span>
                    <small>Chargeable income</small>
                    <strong>{formatMoney(sg.chargeableIncome, 'SGD')}</strong>
                  </span>
                  <span>
                    <small>Modeled reliefs</small>
                    <strong>{formatMoney(sg.reliefs, 'SGD')}</strong>
                  </span>
                </div>
                <div className="calculation-note">
                  <CircleHelp />
                  <p>
                    <strong>
                      {formatMoney(sg.employerCpf, 'SGD')} employer CPF
                    </strong>{' '}
                    is included in package cost, not take-home. Employee CPF is
                    estimated at {formatMoney(sg.employeeCpf, 'SGD')} on{' '}
                    {formatMoney(sg.cpfWages, 'SGD')} of CPF wages.
                  </p>
                </div>
              </div>
              <ExpenseEditor
                currency="SGD"
                expenses={sgExpenses}
                setExpenses={setSgExpenses}
              />
            </article>

            <article
              className={`scenario-card us ${mobileScenario !== 'us' ? 'mobile-hidden' : ''}`}
            >
              <div className="scenario-head">
                <div>
                  <span className="flag-mark">US</span>
                  <div>
                    <p>UNITED STATES</p>
                    <h2>United States offer</h2>
                  </div>
                </div>
                <span>USD</span>
              </div>
              <div className="editor-section">
                <SectionHeading
                  icon={<BadgeDollarSign />}
                  title="Compensation"
                  copy="Annual employee compensation before tax."
                />
                <div className="field-grid three">
                  <NumberField
                    label="Base salary"
                    prefix="US$"
                    value={usBase}
                    onChange={setUsBase}
                  />
                  <NumberField
                    label="Expected bonus"
                    prefix="US$"
                    value={usBonus}
                    onChange={setUsBonus}
                  />
                  <NumberField
                    label="Annualized equity"
                    prefix="US$"
                    value={usEquity}
                    onChange={setUsEquity}
                    hint="Keep private options at US$0; model them below as package-only."
                  />
                </div>
                <div className="compensation-total">
                  <span>
                    <strong>Total comp</strong>
                    <small>Base + bonus + equity</small>
                  </span>
                  <b>{formatMoney(usBase + usBonus + usEquity, 'USD')}</b>
                </div>
              </div>
              <BenefitEditor
                currency="USD"
                benefits={usBenefits}
                setBenefits={setUsBenefits}
              />
              <div className="editor-section">
                <SectionHeading
                  icon={<Landmark />}
                  title="Mandatory tax & payroll"
                  copy="2026 federal single-filer rules with automatic state and local presets."
                />
                <div className="select-grid">
                  <label htmlFor="federal-treatment">
                    <span className="field-label">Federal treatment</span>
                    <NativeSelect
                      id="federal-treatment"
                      value={federalMode}
                      onChange={(event) =>
                        setFederalMode(
                          event.target.value as 'automatic' | 'manual',
                        )
                      }
                    >
                      <NativeSelectOption value="automatic">
                        Full-year resident · auto
                      </NativeSelectOption>
                      <NativeSelectOption value="manual">
                        NRA / dual-status · manual
                      </NativeSelectOption>
                    </NativeSelect>
                  </label>
                  {federalMode === 'manual' ? (
                    <NumberField
                      label="Federal tax estimate"
                      prefix="US$"
                      value={manualFederalTax}
                      onChange={setManualFederalTax}
                    />
                  ) : (
                    <div className="read-only-field">
                      <span>Standard deduction</span>
                      <strong>US$16,100</strong>
                    </div>
                  )}
                  <label htmlFor="state-local-method">
                    <span className="field-label">State tax method</span>
                    <NativeSelect
                      id="state-local-method"
                      value={stateMode}
                      onChange={(event) =>
                        setStateMode(event.target.value as UsStateMode)
                      }
                    >
                      <NativeSelectOption value="california">
                        California · automatic
                      </NativeSelectOption>
                      <NativeSelectOption value="washington">
                        Seattle, Washington · automatic
                      </NativeSelectOption>
                      <NativeSelectOption value="new-york-city">
                        New York City · automatic
                      </NativeSelectOption>
                      <NativeSelectOption value="texas">
                        Texas · automatic
                      </NativeSelectOption>
                      <NativeSelectOption value="rate">
                        Custom · effective rate
                      </NativeSelectOption>
                      <NativeSelectOption value="annual">
                        Custom · annual estimate
                      </NativeSelectOption>
                    </NativeSelect>
                  </label>
                  {stateMode === 'california' ||
                  stateMode === 'new-york-city' ||
                  stateMode === 'washington' ||
                  stateMode === 'texas' ? (
                    <div className="read-only-field">
                      <span>
                        {stateMode === 'california'
                          ? 'California deduction'
                          : stateMode === 'new-york-city'
                            ? 'New York deduction'
                            : 'State income tax'}
                      </span>
                      <strong>
                        {stateMode === 'california'
                          ? 'US$5,706'
                          : stateMode === 'new-york-city'
                            ? 'US$8,000'
                            : 'None'}
                      </strong>
                    </div>
                  ) : (
                    <NumberField
                      label={
                        stateMode === 'rate'
                          ? 'State effective rate'
                          : 'State annual tax'
                      }
                      prefix={stateMode === 'annual' ? 'US$' : undefined}
                      suffix={stateMode === 'rate' ? '%' : undefined}
                      value={stateValue}
                      onChange={setStateValue}
                      step={stateMode === 'rate' ? 0.1 : 100}
                    />
                  )}
                </div>
                <div className="tax-result-strip four">
                  <span>
                    <small>Federal tax</small>
                    <strong>{formatMoney(us.federalIncomeTax, 'USD')}</strong>
                  </span>
                  <span>
                    <small>{stateTaxLabel}</small>
                    <strong>{formatMoney(us.stateLocalTax, 'USD')}</strong>
                  </span>
                  <span>
                    <small>Employee FICA</small>
                    <strong>{formatMoney(us.employeeFica, 'USD')}</strong>
                  </span>
                  <span>
                    <small>{statePayrollLabel}</small>
                    <strong>{formatMoney(us.statePayrollTax, 'USD')}</strong>
                  </span>
                </div>
                {federalMode === 'manual' ? (
                  <div className="warning-note">
                    <CircleHelp />
                    <p>
                      H-1B1 status alone does not determine income-tax
                      residency. Enter a manual federal estimate for
                      non-resident or dual-status years.
                    </p>
                  </div>
                ) : null}
                {stateModeNote ? (
                  <div className="calculation-note">
                    <CircleHelp />
                    <p>{stateModeNote}</p>
                  </div>
                ) : null}
              </div>
              <div className="editor-section">
                <SectionHeading
                  icon={<WalletCards />}
                  title="Optional payroll choices"
                  copy="Savings build wealth; premiums buy coverage. Neither is a mandatory tax."
                />
                <div className="select-grid">
                  <NumberField
                    label="Traditional 401(k) · annual"
                    prefix="US$"
                    value={traditional401k}
                    onChange={setTraditional401k}
                    hint="Reduces federal and modeled state income tax, but not FICA"
                  />
                  <NumberField
                    label="Roth 401(k) · annual"
                    prefix="US$"
                    value={roth401k}
                    onChange={setRoth401k}
                    hint="After-tax savings; no current income-tax deduction"
                  />
                  <NumberField
                    label="Vested employer match · annual"
                    prefix="US$"
                    value={employer401kMatch}
                    onChange={setEmployer401kMatch}
                    hint="Counts toward wealth, not take-home cash"
                  />
                  <NumberField
                    label="Employee health premium · monthly"
                    prefix="US$"
                    value={healthPremiumMonthly}
                    onChange={setHealthPremiumMonthly}
                    hint="Assumes an employer Section 125 payroll plan"
                  />
                  <label htmlFor="hsa-eligibility">
                    <span className="field-label">HSA eligibility</span>
                    <NativeSelect
                      id="hsa-eligibility"
                      value={hsaEligible ? 'eligible' : 'not-eligible'}
                      onChange={(event) => {
                        const eligible = event.target.value === 'eligible';
                        setHsaEligible(eligible);
                        if (!eligible) setHsaContribution(0);
                      }}
                    >
                      <NativeSelectOption value="not-eligible">
                        Not eligible / no HDHP
                      </NativeSelectOption>
                      <NativeSelectOption value="eligible">
                        Eligible HDHP
                      </NativeSelectOption>
                    </NativeSelect>
                  </label>
                  <label htmlFor="hsa-coverage">
                    <span className="field-label">HSA coverage</span>
                    <NativeSelect
                      disabled={!hsaEligible}
                      id="hsa-coverage"
                      value={hsaCoverage}
                      onChange={(event) =>
                        setHsaCoverage(event.target.value as HsaCoverage)
                      }
                    >
                      <NativeSelectOption value="self">
                        Self-only · US$4,400 max
                      </NativeSelectOption>
                      <NativeSelectOption value="family">
                        Family · US$8,750 max
                      </NativeSelectOption>
                    </NativeSelect>
                  </label>
                  <NumberField
                    disabled={!hsaEligible}
                    label="HSA contribution · annual"
                    prefix="US$"
                    value={hsaContribution}
                    onChange={setHsaContribution}
                    hint={
                      hsaEligible
                        ? `Calculation capped at US$${hsaLimit.toLocaleString('en-US')}`
                        : 'Select an eligible HDHP to contribute'
                    }
                  />
                  <NumberField
                    label="Other Section 125 · annual"
                    prefix="US$"
                    value={otherSection125}
                    onChange={setOtherSection125}
                    hint="Other eligible pre-tax payroll benefits"
                  />
                </div>
                {total401k > US_401K_LIMIT_2026 ? (
                  <div className="warning-note">
                    <CircleHelp />
                    <p>
                      Combined 401(k) contributions exceed the 2026 US$24,500
                      employee limit. Results are capped at the limit, applying
                      Traditional before Roth.
                    </p>
                  </div>
                ) : null}
                {hsaContribution > hsaLimit && hsaEligible ? (
                  <div className="warning-note">
                    <CircleHelp />
                    <p>
                      The HSA contribution exceeds the selected 2026 limit.
                      Results use {formatMoney(hsaLimit, 'USD')}.
                    </p>
                  </div>
                ) : null}
              </div>
              <ExpenseEditor
                currency="USD"
                expenses={usExpenses}
                setExpenses={setUsExpenses}
              />
            </article>
          </div>
        </section>

        <section className="outcome-card" aria-live="polite">
          <div className="outcome-copy">
            <div className="outcome-mode">
              <span>Compare</span>
              <span className="segmented-control">
                <button
                  className={outcomeMode === 'cash' ? 'active' : ''}
                  type="button"
                  onClick={() => setOutcomeMode('cash')}
                >
                  Cash surplus
                </button>
                <button
                  className={outcomeMode === 'wealth' ? 'active' : ''}
                  type="button"
                  onClick={() => setOutcomeMode('wealth')}
                >
                  Wealth added
                </button>
              </span>
            </div>
            <p className="eyebrow light">
              {outcomeMode === 'cash'
                ? 'CASH AFTER LIVING COSTS'
                : 'CASH + OWNED SAVINGS'}
            </p>
            <h2>
              <span>{winner}</span>{' '}
              {outcomeMode === 'cash' ? 'leaves' : 'builds'}{' '}
              {formatMoney(
                delta / (period === 'monthly' ? 12 : 1),
                displayCurrency,
              )}{' '}
              more {periodLabel}
            </h2>
            <p>
              {outcomeMode === 'cash'
                ? 'After estimated taxes, payroll choices, and living costs.'
                : 'Cash surplus plus CPF or retirement/HSA savings and vested employer contributions.'}
            </p>
          </div>
          <div className="score-grid">
            <article className="score sg">
              <span>Singapore</span>
              <strong>
                {display(
                  outcomeMode === 'cash'
                    ? sg.disposableIncome
                    : sg.wealthAccumulation,
                  'sg',
                )}
              </strong>
              <small>
                {outcomeMode === 'cash'
                  ? `${formatPercent(sg.effectiveAllInRate)} tax + statutory`
                  : `Includes ${display(sg.employeeSavings + sg.employerSavings, 'sg')} CPF`}
              </small>
            </article>
            <div className="versus">VS</div>
            <article className="score us">
              <span>U.S. H-1B1</span>
              <strong>
                {display(
                  outcomeMode === 'cash'
                    ? us.disposableIncome
                    : us.wealthAccumulation,
                  'us',
                )}
              </strong>
              <small>
                {outcomeMode === 'cash'
                  ? `${formatPercent(us.effectiveAllInRate)} tax + mandatory payroll`
                  : `Includes ${display(us.employeeSavings + us.employerSavings, 'us')} retirement / HSA`}
              </small>
            </article>
          </div>
        </section>

        <section className="metric-strip">
          <article>
            <span className="metric-icon">
              <Building2 />
            </span>
            <div>
              <span>Employer package</span>
              <strong>
                {display(sg.employerPackage, 'sg')} <i>SG</i>
              </strong>
              <strong>
                {display(us.employerPackage, 'us')} <i>US</i>
              </strong>
            </div>
          </article>
          <article>
            <span className="metric-icon">
              <Landmark />
            </span>
            <div>
              <span>Cash after mandatory deductions</span>
              <strong>
                {display(sg.cashAfterMandatory, 'sg')} <i>SG</i>
              </strong>
              <strong>
                {display(us.cashAfterMandatory, 'us')} <i>US</i>
              </strong>
            </div>
          </article>
          <article>
            <span className="metric-icon">
              <WalletCards />
            </span>
            <div>
              <span>Total wealth added</span>
              <strong>
                {display(sg.wealthAccumulation, 'sg')} <i>SG</i>
              </strong>
              <strong>
                {display(us.wealthAccumulation, 'us')} <i>US</i>
              </strong>
            </div>
          </article>
        </section>

        <section className="money-flow-section">
          <div className="block-title">
            <div>
              <p className="eyebrow">CASH JOURNEY</p>
              <h2>Where the gross cash goes</h2>
            </div>
            <p>
              Mandatory deductions, optional savings, payroll benefits, and
              living costs stay visibly separate.
            </p>
          </div>
          <div className="flow-grid">
            <ResultFlow result={sg} region="sg" format={display} />
            <ResultFlow result={us} region="us" format={display} />
          </div>
        </section>

        <section className="comparison-section">
          <div className="block-title">
            <div>
              <p className="eyebrow">SIDE BY SIDE</p>
              <h2>One definition for every number</h2>
            </div>
            <p>
              Values below use {displayCurrency} at US$1 = S$
              {usdToSgd.toFixed(2)}.
            </p>
          </div>
          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Measure</th>
                  <th>
                    <span className="table-dot sg" />
                    Singapore
                  </th>
                  <th>
                    <span className="table-dot us" />
                    U.S. H-1B1
                  </th>
                  <th>Difference</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(([label, sgValue, usValue]) => {
                  const sgConverted =
                    convert(sgValue, 'sg') / (period === 'monthly' ? 12 : 1);
                  const usConverted =
                    convert(usValue, 'us') / (period === 'monthly' ? 12 : 1);
                  const difference = usConverted - sgConverted;
                  return (
                    <tr
                      className={
                        label ===
                        (outcomeMode === 'cash'
                          ? 'Cash surplus after living costs'
                          : 'Total wealth added')
                          ? 'highlight-row'
                          : ''
                      }
                      key={label}
                    >
                      <th>{label}</th>
                      <td>{formatMoney(sgConverted, displayCurrency)}</td>
                      <td>{formatMoney(usConverted, displayCurrency)}</td>
                      <td className={difference >= 0 ? 'positive' : 'negative'}>
                        {difference >= 0 ? '+' : '−'}
                        {formatMoney(Math.abs(difference), displayCurrency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="questions-section">
          <div className="questions-copy">
            <p className="eyebrow">BEYOND THE MATH</p>
            <h2>The offer is more than its score.</h2>
            <p>
              Use the financial result as one input. Ask both employers the same
              questions before you decide.
            </p>
          </div>
          <div className="question-list">
            {[
              'Visa transfer & job mobility',
              'Healthcare exposure',
              'Leave & working hours',
              'Family and dependant plans',
              'Retirement portability',
              'Relocation and travel',
            ].map((question) => (
              <div key={question}>
                <span>
                  <Check />
                </span>
                {question}
                <ArrowRight />
              </div>
            ))}
          </div>
        </section>

        <section className="assumptions-section">
          <details>
            <summary>
              <span>
                <CircleHelp /> Calculation notes & official sources
              </span>
              <ChevronDown />
            </summary>
            <div className="assumption-content">
              <div>
                <h3>Singapore</h3>
                <p>
                  Projected 2026 compensation uses the resident rates published
                  for YA 2024 onward. CPF uses the 2026 S$8,000 monthly Ordinary
                  Wage ceiling and S$102,000 annual salary ceiling. The estimate
                  annualizes CPF and can differ from payroll by a few dollars
                  because CPF is rounded monthly. Equity is taxable but excluded
                  from CPF wages in this simplified model.
                </p>
                <p>
                  <a
                    href="https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay"
                    target="_blank"
                    rel="noreferrer"
                  >
                    CPF contribution rates
                  </a>
                  <a
                    href="https://www.cpf.gov.sg/employer/employer-obligations/what-payments-attract-cpf-contributions"
                    target="_blank"
                    rel="noreferrer"
                  >
                    CPF wage ceilings
                  </a>
                  <a
                    href="https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates"
                    target="_blank"
                    rel="noreferrer"
                  >
                    IRAS tax rates
                  </a>
                </p>
              </div>
              <div>
                <h3>United States</h3>
                <p>
                  Automatic federal mode assumes a full-year U.S. resident
                  alien, single filer, one W-2 job, the 2026 standard deduction,
                  and no credits, itemizing, AMT, other income, or treaty
                  effects. California mode follows the FTB 2026 estimated-tax
                  instruction to use the 2025 single-filer schedule and adds
                  2026 SDI. Seattle mode includes Washington Paid Leave and WA
                  Cares employee premiums. New York City mode combines 2026
                  state and city resident rates with Paid Family Leave. Texas
                  has no individual state income tax. Health and HSA payroll
                  inputs assume an eligible Section 125 arrangement; California
                  does not recognize the federal HSA deduction.
                </p>
                <p>
                  <a
                    href="https://www.irs.gov/irb/2025-45_IRB"
                    target="_blank"
                    rel="noreferrer"
                  >
                    IRS 2026 brackets
                  </a>
                  <a
                    href="https://www.irs.gov/publications/p15"
                    target="_blank"
                    rel="noreferrer"
                  >
                    IRS payroll tax guide
                  </a>
                  <a
                    href="https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500"
                    target="_blank"
                    rel="noreferrer"
                  >
                    IRS 401(k) limit
                  </a>
                  <a
                    href="https://www.irs.gov/irb/2025-21_IRB"
                    target="_blank"
                    rel="noreferrer"
                  >
                    IRS HSA limits
                  </a>
                  <a
                    href="https://www.ftb.ca.gov/forms/2026/2026-540-es-instructions.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    California estimate method
                  </a>
                  <a
                    href="https://www.ftb.ca.gov/about-ftb/data-reports-plans/summary-of-federal-income-tax-changes/index.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    California HSA treatment
                  </a>
                  <a
                    href="https://edd.ca.gov/en/Payroll_Taxes/Rates_and_Withholding"
                    target="_blank"
                    rel="noreferrer"
                  >
                    California SDI
                  </a>
                  <a
                    href="https://paidleave.wa.gov/estimate-your-paid-leave-payments/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Washington payroll premiums
                  </a>
                  <a
                    href="https://dor.wa.gov/taxes-rates/income-tax/frequently-asked-questions-about-income-tax"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Washington income tax
                  </a>
                  <a
                    href="https://www.tax.ny.gov/pubs_and_bulls/publications/withholding/wt_pubs_and_bulls_by_number.htm"
                    target="_blank"
                    rel="noreferrer"
                  >
                    New York 2026 tax methods
                  </a>
                  <a
                    href="https://paidfamilyleave.ny.gov/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    New York Paid Family Leave
                  </a>
                  <a
                    href="https://comptroller.texas.gov/economy/in-depth/special-reports/small-business/small-business-report.pdf"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Texas tax overview
                  </a>
                  <a
                    href="https://www.irs.gov/individuals/taxation-of-alien-individuals-by-immigration-status-h-1b"
                    target="_blank"
                    rel="noreferrer"
                  >
                    H-1B1 tax residency
                  </a>
                </p>
              </div>
            </div>
          </details>
          <p className="disclaimer">
            Planning estimate only—not tax, legal, or immigration advice. Actual
            liability depends on your full facts, benefit treatment, and filing
            position.
          </p>
        </section>
      </div>
    </main>
  );
}
