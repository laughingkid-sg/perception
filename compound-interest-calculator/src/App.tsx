import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Calculator,
  CalendarRange,
  ChartNoAxesCombined,
  Check,
  CircleDollarSign,
  Download,
  FolderOpen,
  Minus,
  Pencil,
  PieChart,
  Plus,
  RefreshCcw,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import { CurrencyInput } from '@/components/CurrencyInput';

import {
  type CompoundingFrequency,
  type ContributionTiming,
  type YearPlan,
  calculateProjection,
  calculateWeightedAverageReturn,
  createSchedule,
} from '@/lib/calculations';
import { loadLocalCache, saveLocalCache } from '@/lib/local-cache';
import {
  type SavedPlan,
  createSavedPlan,
  loadSavedPlans,
  serializeSavedPlans,
  storeSavedPlans,
} from '@/lib/saved-plans';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

type Settings = {
  initialInvestment: number;
  years: number;
  monthlyContribution: number;
  annualContribution: number;
  annualRate: number;
  compounding: CompoundingFrequency;
  contributionTiming: ContributionTiming;
};

type PlanSnapshot = {
  settings: Settings;
  schedule: YearPlan[];
  weightedInvestments: WeightedInvestment[];
};

type WeightedInvestment = {
  id: string;
  name: string;
  amount: number;
  annualReturn: number;
};

const DEFAULTS: Settings = {
  initialInvestment: 20_000,
  years: 7,
  monthlyContribution: 500,
  annualContribution: 5_000,
  annualRate: 5,
  compounding: 'monthly',
  contributionTiming: 'beginning',
};

const DEFAULT_WEIGHTED_INVESTMENTS: WeightedInvestment[] = [
  { id: 'weighted-1', name: 'Investment 1', amount: 0, annualReturn: 0 },
  { id: 'weighted-2', name: 'Investment 2', amount: 0, annualReturn: 0 },
  { id: 'weighted-3', name: 'Investment 3', amount: 0, annualReturn: 0 },
];

const STORAGE_KEY = 'compound-interest-planner:v1';
const SAVES_STORAGE_KEY = 'compound-interest-planner:saves:v1';

const money = new Intl.NumberFormat('en-SG', {
  style: 'currency',
  currency: 'SGD',
  maximumFractionDigits: 0,
});

const tableMoney = new Intl.NumberFormat('en-SG', {
  style: 'currency',
  currency: 'SGD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const savedDate = new Intl.DateTimeFormat('en-SG', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const isCompounding = (value: unknown): value is CompoundingFrequency =>
  value === 'daily' ||
  value === 'monthly' ||
  value === 'quarterly' ||
  value === 'semiannually' ||
  value === 'annually';

const isTiming = (value: unknown): value is ContributionTiming =>
  value === 'beginning' || value === 'end';

const safeNumber = (value: unknown, fallback: number, minimum = 0) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(minimum, value)
    : fallback;

const cloneSnapshot = (snapshot: PlanSnapshot): PlanSnapshot => ({
  settings: { ...snapshot.settings },
  schedule: snapshot.schedule.map((row) => ({
    ...row,
    monthlyContributions: [...row.monthlyContributions],
  })),
  weightedInvestments: (snapshot.weightedInvestments ?? DEFAULT_WEIGHTED_INVESTMENTS).map(
    (investment) => ({ ...investment }),
  ),
});

const createRecordId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function downloadJson(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const exportFilename = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'plan'}.json`;

function readSavedState(): PlanSnapshot {
  const fallback = {
    settings: DEFAULTS,
    schedule: createSchedule(
      DEFAULTS.years,
      DEFAULTS.monthlyContribution,
      DEFAULTS.annualContribution,
      DEFAULTS.annualRate,
    ),
    weightedInvestments: DEFAULT_WEIGHTED_INVESTMENTS,
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const saved = loadLocalCache<{
      settings?: Partial<Settings>;
      schedule?: YearPlan[];
      weightedInvestments?: WeightedInvestment[];
    }>(window.localStorage, STORAGE_KEY);
    if (!saved || typeof saved !== 'object') return fallback;

    const source = saved.settings ?? {};
    const years = Math.min(40, Math.round(safeNumber(source.years, DEFAULTS.years, 1)));
    const settings: Settings = {
      initialInvestment: safeNumber(
        source.initialInvestment,
        DEFAULTS.initialInvestment,
      ),
      years,
      monthlyContribution: safeNumber(
        source.monthlyContribution,
        DEFAULTS.monthlyContribution,
      ),
      annualContribution: safeNumber(
        source.annualContribution,
        DEFAULTS.annualContribution,
      ),
      annualRate: Math.min(100, safeNumber(source.annualRate, DEFAULTS.annualRate)),
      compounding: isCompounding(source.compounding)
        ? source.compounding
        : DEFAULTS.compounding,
      contributionTiming: isTiming(source.contributionTiming)
        ? source.contributionTiming
        : DEFAULTS.contributionTiming,
    };

    const savedSchedule = saved.schedule;
    if (!Array.isArray(savedSchedule)) return { ...fallback, settings };

    const schedule = Array.from({ length: years }, (_, index) => {
      const row = savedSchedule[index];
      const defaultRow = createSchedule(
        1,
        settings.monthlyContribution,
        settings.annualContribution,
        settings.annualRate,
      )[0];

      if (!row || typeof row !== 'object') {
        return { ...defaultRow, year: index + 1 };
      }

      const contributions = Array.isArray(row.monthlyContributions)
        ? Array.from({ length: 12 }, (_, month) =>
            safeNumber(
              row.monthlyContributions[month],
              settings.monthlyContribution,
            ),
          )
        : defaultRow.monthlyContributions;

      return {
        year: index + 1,
        monthlyContributions: contributions,
        annualContribution: safeNumber(
          row.annualContribution,
          settings.annualContribution,
        ),
        annualRate: Math.min(
          100,
          safeNumber(row.annualRate, settings.annualRate),
        ),
      };
    });

    const weightedInvestments = Array.isArray(saved.weightedInvestments)
      ? saved.weightedInvestments
          .filter((investment) => investment && typeof investment === 'object')
          .map((investment, index) => ({
            id:
              typeof investment.id === 'string'
                ? investment.id
                : `weighted-restored-${index + 1}`,
            name:
              typeof investment.name === 'string'
                ? investment.name
                : `Investment ${index + 1}`,
            amount: safeNumber(investment.amount, 0),
            annualReturn: Math.min(
              100,
              safeNumber(investment.annualReturn, 0),
            ),
          }))
      : DEFAULT_WEIGHTED_INVESTMENTS;

    return { settings, schedule, weightedInvestments };
  } catch {
    return fallback;
  }
}

function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  min = 0,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="input-shell">
        {prefix && <b>{prefix}</b>}
        {prefix ? (
          <CurrencyInput
            value={value}
            aria-label={label}
            onValueChange={(parsed) =>
              onChange(
                Math.min(
                  max ?? Number.POSITIVE_INFINITY,
                  Math.max(min, parsed),
                ),
              )
            }
          />
        ) : (
          <input
            type="number"
            inputMode={step < 1 ? 'decimal' : 'numeric'}
            min={min}
            max={max}
            step={step}
            value={value}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              if (Number.isFinite(parsed)) {
                onChange(
                  Math.min(
                    max ?? Number.POSITIVE_INFINITY,
                    Math.max(min, parsed),
                  ),
                );
              }
            }}
          />
        )}
        {suffix && <em>{suffix}</em>}
      </span>
    </label>
  );
}

function ReactCheckbox({
  checked,
  mixed = false,
  label,
  onChange,
}: {
  checked: boolean;
  mixed?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      className={`react-checkbox ${checked || mixed ? 'checked' : ''}`}
      type="button"
      role="checkbox"
      aria-checked={mixed ? 'mixed' : checked}
      aria-label={label}
      onClick={onChange}
    >
      {mixed ? <Minus size={12} aria-hidden="true" /> : checked ? <Check size={12} aria-hidden="true" /> : null}
    </button>
  );
}

function App() {
  const [saved] = useState(readSavedState);
  const [settings, setSettings] = useState(saved.settings);
  const [schedule, setSchedule] = useState(saved.schedule);
  const [weightedInvestments, setWeightedInvestments] = useState(
    saved.weightedInvestments,
  );
  const [activeTab, setActiveTab] = useState<'planner' | 'weighted'>('planner');
  const [selectedScheduleYears, setSelectedScheduleYears] = useState<Set<number>>(
    () => new Set(),
  );
  const [isSavedLocally, setIsSavedLocally] = useState(false);
  const [savedPlans, setSavedPlans] = useState(() =>
    loadSavedPlans<PlanSnapshot>(window.localStorage, SAVES_STORAGE_KEY),
  );
  const [savesOpen, setSavesOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [editingSaveId, setEditingSaveId] = useState<string | null>(null);
  const [editingSaveName, setEditingSaveName] = useState('');
  const [pendingRestore, setPendingRestore] = useState<SavedPlan<PlanSnapshot> | null>(null);

  const projection = useMemo(
    () =>
      calculateProjection({
        initialInvestment: settings.initialInvestment,
        schedule,
        compounding: settings.compounding,
        contributionTiming: settings.contributionTiming,
      }),
    [schedule, settings],
  );

  const totalWeightedInvestment = useMemo(
    () =>
      weightedInvestments.reduce(
        (total, investment) => total + Math.max(0, investment.amount),
        0,
      ),
    [weightedInvestments],
  );
  const weightedAverageReturn = useMemo(
    () => calculateWeightedAverageReturn(weightedInvestments),
    [weightedInvestments],
  );

  useEffect(() => {
    const savedAt = saveLocalCache(window.localStorage, STORAGE_KEY, {
      settings,
      schedule,
      weightedInvestments,
    });
    setIsSavedLocally(Boolean(savedAt));
  }, [settings, schedule, weightedInvestments]);

  useEffect(() => {
    storeSavedPlans(window.localStorage, SAVES_STORAGE_KEY, savedPlans);
  }, [savedPlans]);

  useEffect(() => {
    if (!savesOpen && !saveDialogOpen && !pendingRestore) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (pendingRestore) setPendingRestore(null);
      else if (saveDialogOpen) setSaveDialogOpen(false);
      else setSavesOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [pendingRestore, saveDialogOpen, savesOpen]);

  function openSaveDialog() {
    setSaveName(`Plan ${savedDate.format(new Date())}`);
    setSaveDialogOpen(true);
  }

  function saveCurrentPlan() {
    const name = saveName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const record = createSavedPlan<PlanSnapshot>({
      id: createRecordId(),
      name,
      savedAt: now,
      data: cloneSnapshot({ settings, schedule, weightedInvestments }),
    });
    setSavedPlans((current) => [record, ...current]);
    setSaveDialogOpen(false);
    setSavesOpen(true);
  }

  function confirmRestoreSavedPlan() {
    if (!pendingRestore) return;
    const restored = cloneSnapshot(pendingRestore.data);
    setSettings(restored.settings);
    setSchedule(restored.schedule);
    setWeightedInvestments(restored.weightedInvestments);
    setPendingRestore(null);
    setSavesOpen(false);
  }

  function startRename(record: SavedPlan<PlanSnapshot>) {
    setEditingSaveId(record.id);
    setEditingSaveName(record.name);
  }

  function commitRename() {
    const name = editingSaveName.trim();
    if (!editingSaveId || !name) return;
    setSavedPlans((current) =>
      current.map((record) =>
        record.id === editingSaveId
          ? { ...record, name, updatedAt: new Date().toISOString() }
          : record,
      ),
    );
    setEditingSaveId(null);
    setEditingSaveName('');
  }

  function deleteSavedPlan(record: SavedPlan<PlanSnapshot>) {
    if (!window.confirm(`Delete “${record.name}”? This cannot be undone.`)) return;
    setSavedPlans((current) => current.filter((item) => item.id !== record.id));
  }

  function exportSavedPlan(record: SavedPlan<PlanSnapshot>) {
    downloadJson(exportFilename(record.name), serializeSavedPlans([record]));
  }

  function exportAllSavedPlans() {
    downloadJson(
      `compound-interest-plans-${new Date().toISOString().slice(0, 10)}.json`,
      serializeSavedPlans(savedPlans),
    );
  }

  function endingBalanceFor(record: SavedPlan<PlanSnapshot>) {
    return calculateProjection({
      initialInvestment: record.data.settings.initialInvestment,
      schedule: record.data.schedule,
      compounding: record.data.settings.compounding,
      contributionTiming: record.data.settings.contributionTiming,
    }).endingBalance;
  }

  function updateSetting<Key extends keyof Settings>(
    key: Key,
    value: Settings[Key],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function updateYears(value: number) {
    const years = Math.min(40, Math.max(1, Math.round(value)));
    setSettings((current) => ({ ...current, years }));
    setSchedule((current) =>
      Array.from({ length: years }, (_, index) => {
        const existing = current[index];
        if (existing) return { ...existing, year: index + 1 };
        return createSchedule(
          1,
          settings.monthlyContribution,
          settings.annualContribution,
          settings.annualRate,
        ).map((row) => ({ ...row, year: index + 1 }))[0];
      }),
    );
    setSelectedScheduleYears((current) =>
      new Set([...current].filter((year) => year <= years)),
    );
  }

  function applyDefaults() {
    setSchedule(
      createSchedule(
        settings.years,
        settings.monthlyContribution,
        settings.annualContribution,
        settings.annualRate,
      ),
    );
  }

  function applyDefaultsToSelectedYears() {
    if (selectedScheduleYears.size === 0) return;
    setSchedule((current) =>
      current.map((row) =>
        selectedScheduleYears.has(row.year)
          ? {
              ...row,
              monthlyContributions: Array(12).fill(
                settings.monthlyContribution,
              ),
              annualContribution: settings.annualContribution,
              annualRate: settings.annualRate,
            }
          : row,
      ),
    );
  }

  function toggleScheduleYear(year: number) {
    setSelectedScheduleYears((current) => {
      const next = new Set(current);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  function toggleAllScheduleYears() {
    setSelectedScheduleYears((current) =>
      current.size === schedule.length
        ? new Set()
        : new Set(schedule.map((row) => row.year)),
    );
  }

  function resetCalculator() {
    setSettings(DEFAULTS);
    setSchedule(
      createSchedule(
        DEFAULTS.years,
        DEFAULTS.monthlyContribution,
        DEFAULTS.annualContribution,
        DEFAULTS.annualRate,
      ),
    );
    setWeightedInvestments(
      DEFAULT_WEIGHTED_INVESTMENTS.map((investment) => ({ ...investment })),
    );
    setSelectedScheduleYears(new Set());
  }

  function updateWeightedInvestment(
    id: string,
    key: 'name' | 'amount' | 'annualReturn',
    value: string | number,
  ) {
    setWeightedInvestments((current) =>
      current.map((investment) =>
        investment.id === id
          ? {
              ...investment,
              [key]:
                key === 'name'
                  ? String(value)
                  : key === 'annualReturn'
                    ? Math.min(100, Math.max(0, Number(value) || 0))
                    : Math.max(0, Number(value) || 0),
            }
          : investment,
      ),
    );
  }

  function addWeightedInvestment() {
    setWeightedInvestments((current) => [
      ...current,
      {
        id: createRecordId(),
        name: `Investment ${current.length + 1}`,
        amount: 0,
        annualReturn: 0,
      },
    ]);
  }

  function removeWeightedInvestment(id: string) {
    setWeightedInvestments((current) =>
      current.filter((investment) => investment.id !== id),
    );
  }

  function applyWeightedReturn() {
    updateSetting('annualRate', Number(weightedAverageReturn.toFixed(4)));
    setActiveTab('planner');
  }

  function updateMonth(yearIndex: number, monthIndex: number, value: number) {
    setSchedule((current) =>
      current.map((row, index) => {
        if (index !== yearIndex) return row;
        const monthlyContributions = [...row.monthlyContributions];
        monthlyContributions[monthIndex] = Math.max(0, value);
        return { ...row, monthlyContributions };
      }),
    );
  }

  function updateYearlyMonthlyPlan(yearIndex: number, value: number) {
    setSchedule((current) =>
      current.map((row, index) =>
        index === yearIndex
          ? { ...row, monthlyContributions: Array(12).fill(Math.max(0, value)) }
          : row,
      ),
    );
  }

  function updateYear(
    yearIndex: number,
    key: 'annualContribution' | 'annualRate',
    value: number,
  ) {
    setSchedule((current) =>
      current.map((row, index) =>
        index === yearIndex ? { ...row, [key]: Math.max(0, value) } : row,
      ),
    );
  }

  const interestShare =
    projection.endingBalance > 0
      ? (projection.totalInterest / projection.endingBalance) * 100
      : 0;
  const maxBalance = Math.max(
    1,
    ...projection.years.map((year) => year.endingBalance),
  );
  const allScheduleYearsSelected =
    schedule.length > 0 && selectedScheduleYears.size === schedule.length;
  const someScheduleYearsSelected =
    selectedScheduleYears.size > 0 && !allScheduleYearsSelected;

  return (
    <>
      <main className="page-shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">
            <Sparkles size={15} aria-hidden="true" /> Investment workspace
          </p>
          <h1>Compound Interest Planner</h1>
          <p className="intro-copy">
            Shape every month of your plan, then see compounding update instantly.
          </p>
        </div>
        <div className="header-actions">
          {isSavedLocally && (
            <span className="cache-status" role="status">
              <Check size={14} aria-hidden="true" /> Saved locally
            </span>
          )}
          <button className="action-button save-button" type="button" onClick={openSaveDialog}>
            <Save size={16} aria-hidden="true" /> Save plan
          </button>
          <button className="action-button" type="button" onClick={() => setSavesOpen(true)}>
            <FolderOpen size={16} aria-hidden="true" /> Saved plans
            {savedPlans.length > 0 && <b>{savedPlans.length}</b>}
          </button>
          <button className="reset-button" type="button" onClick={resetCalculator}>
            <RefreshCcw size={16} aria-hidden="true" /> Reset
          </button>
        </div>
      </header>

      <nav className="feature-tabs" role="tablist" aria-label="Calculator features">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'planner'}
          className={activeTab === 'planner' ? 'active' : ''}
          onClick={() => setActiveTab('planner')}
        >
          <ChartNoAxesCombined size={17} aria-hidden="true" /> Growth planner
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'weighted'}
          className={activeTab === 'weighted' ? 'active' : ''}
          onClick={() => setActiveTab('weighted')}
        >
          <Calculator size={17} aria-hidden="true" /> Weighted return
        </button>
      </nav>

      {activeTab === 'planner' ? (
        <>
          <section className="summary-grid" aria-label="Projection summary">
        <article className="summary-card primary-result">
          <span>Ending balance</span>
          <strong>{money.format(projection.endingBalance)}</strong>
          <small>After {settings.years} years</small>
          <ChartNoAxesCombined className="result-icon" aria-hidden="true" />
        </article>
        <article className="summary-card">
          <span>Total principal</span>
          <strong>{money.format(projection.totalPrincipal)}</strong>
          <small>Initial amount + contributions</small>
        </article>
        <article className="summary-card">
          <span>Total contributions</span>
          <strong>{money.format(projection.totalContributions)}</strong>
          <small>Monthly deposits + annual top-ups</small>
        </article>
        <article className="summary-card interest-card">
          <span>Total interest</span>
          <strong>{money.format(projection.totalInterest)}</strong>
          <small>{interestShare.toFixed(1)}% of the ending balance</small>
          <span className="trend-mark" aria-hidden="true">
            <ArrowUpRight size={18} />
          </span>
        </article>
      </section>

      <section className="workspace-grid">
        <article className="panel assumptions-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">01 · Set the baseline</p>
              <h2>Plan assumptions</h2>
            </div>
            <CircleDollarSign size={22} aria-hidden="true" />
          </div>

          <div className="controls-grid">
            <NumberField
              label="Initial investment"
              prefix="S$"
              value={settings.initialInvestment}
              step={500}
              onChange={(value) => updateSetting('initialInvestment', value)}
            />
            <NumberField
              label="Investment length"
              suffix="years"
              value={settings.years}
              min={1}
              max={40}
              onChange={updateYears}
            />
            <NumberField
              label="Monthly default"
              prefix="S$"
              value={settings.monthlyContribution}
              step={50}
              onChange={(value) => updateSetting('monthlyContribution', value)}
            />
            <NumberField
              label="Annual top-up default"
              prefix="S$"
              value={settings.annualContribution}
              step={500}
              onChange={(value) => updateSetting('annualContribution', value)}
            />
            <NumberField
              label="Expected return default"
              suffix="%"
              value={settings.annualRate}
              max={100}
              step={0.1}
              onChange={(value) => updateSetting('annualRate', value)}
            />
            <label className="field">
              <span>Compounding</span>
              <select
                value={settings.compounding}
                onChange={(event) =>
                  updateSetting(
                    'compounding',
                    event.target.value as CompoundingFrequency,
                  )
                }
              >
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="semiannually">Semi-annually</option>
                <option value="annually">Annually</option>
              </select>
            </label>
          </div>

          <div className="timing-row">
            <fieldset>
              <legend>Contribute at the</legend>
              <label>
                <input
                  type="radio"
                  name="timing"
                  value="beginning"
                  checked={settings.contributionTiming === 'beginning'}
                  onChange={() => updateSetting('contributionTiming', 'beginning')}
                />
                <span>Beginning</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="timing"
                  value="end"
                  checked={settings.contributionTiming === 'end'}
                  onChange={() => updateSetting('contributionTiming', 'end')}
                />
                <span>End</span>
              </label>
              <small>of each contribution period</small>
            </fieldset>
            <div className="apply-area">
              <p>Defaults seed the detailed schedule below.</p>
              <div className="apply-actions">
                <button
                  type="button"
                  className="apply-button secondary"
                  disabled={selectedScheduleYears.size === 0}
                  onClick={applyDefaultsToSelectedYears}
                >
                  Apply to selected
                  {selectedScheduleYears.size > 0 && ` (${selectedScheduleYears.size})`}
                </button>
                <button type="button" className="apply-button" onClick={applyDefaults}>
                  Apply to all years
                </button>
              </div>
            </div>
          </div>
        </article>

        <article className="panel chart-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">02 · See the trajectory</p>
              <h2>Balance by year</h2>
            </div>
            <CalendarRange size={22} aria-hidden="true" />
          </div>
          <div className="chart-legend" aria-hidden="true">
            <span><i className="initial-dot" />Initial</span>
            <span><i className="contribution-dot" />Contributions</span>
            <span><i className="interest-dot" />Interest</span>
          </div>
          <div className="bar-chart" aria-label="Projected ending balance by year">
            {projection.years.map((year) => {
              const initialHeight = (projection.initialInvestment / maxBalance) * 100;
              const contributionHeight =
                (year.cumulativeContributions / maxBalance) * 100;
              const interestHeight = (year.cumulativeInterest / maxBalance) * 100;
              return (
                <div className="bar-column" key={year.year}>
                  <div className="bar-value">{money.format(year.endingBalance)}</div>
                  <div className="bar-track">
                    <span className="bar-interest" style={{ height: `${interestHeight}%` }} />
                    <span
                      className="bar-contribution"
                      style={{ height: `${contributionHeight}%` }}
                    />
                    <span className="bar-initial" style={{ height: `${initialHeight}%` }} />
                  </div>
                  <b>Y{year.year}</b>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="schedule-section">
        <div className="schedule-heading">
          <div>
            <p className="section-kicker">03 · Tune the details</p>
            <h2>Contribution &amp; return schedule</h2>
            <p>
              Set a monthly plan for each year, then fine-tune individual months around raises,
              bonuses, or time off.
            </p>
          </div>
          <div className="scroll-cue">
            <span>Scroll sideways for all months</span>
            <ArrowDownRight size={18} aria-hidden="true" />
          </div>
        </div>

        <div className="table-wrap">
          <table className="schedule-table">
            <thead>
              <tr>
                <th className="sticky-year">
                  <div className="year-header-content">
                    <ReactCheckbox
                      checked={allScheduleYearsSelected}
                      mixed={someScheduleYearsSelected}
                      label={allScheduleYearsSelected ? 'Clear all year selections' : 'Select all years'}
                      onChange={toggleAllScheduleYears}
                    />
                    <span>Year</span>
                  </div>
                </th>
                <th>Monthly plan</th>
                {MONTHS.map((month) => (
                  <th key={month}>{month}</th>
                ))}
                <th>Annual top-up</th>
                <th>Return</th>
                <th>Deposits</th>
                <th>Interest</th>
                <th>Ending balance</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row, yearIndex) => {
                const result = projection.years[yearIndex];
                return (
                  <tr key={row.year}>
                    <th className="sticky-year row-year" scope="row">
                      <div className="row-year-content">
                        <ReactCheckbox
                          checked={selectedScheduleYears.has(row.year)}
                          label={`Select year ${row.year}`}
                          onChange={() => toggleScheduleYear(row.year)}
                        />
                        <span className="year-badge">{String(row.year).padStart(2, '0')}</span>
                      </div>
                    </th>
                    <td className="editable-cell monthly-plan-cell">
                      <span>S$</span>
                      <CurrencyInput
                        aria-label={`Year ${row.year} monthly contribution plan`}
                        title="Change this to fill all 12 months for this year"
                        value={
                          row.monthlyContributions.every(
                            (amount) => amount === row.monthlyContributions[0],
                          )
                            ? row.monthlyContributions[0]
                            : ''
                        }
                        placeholder="Varies"
                        onValueChange={(value) =>
                          updateYearlyMonthlyPlan(yearIndex, value)
                        }
                      />
                    </td>
                    {row.monthlyContributions.map((value, monthIndex) => (
                      <td className="editable-cell" key={MONTHS[monthIndex]}>
                        <span>S$</span>
                        <CurrencyInput
                          aria-label={`Year ${row.year}, ${MONTHS[monthIndex]} contribution`}
                          value={value}
                          onValueChange={(amount) =>
                            updateMonth(yearIndex, monthIndex, amount)
                          }
                        />
                      </td>
                    ))}
                    <td className="editable-cell annual-cell">
                      <span>S$</span>
                      <CurrencyInput
                        aria-label={`Year ${row.year} annual top-up`}
                        value={row.annualContribution}
                        onValueChange={(value) =>
                          updateYear(
                            yearIndex,
                            'annualContribution',
                            value,
                          )
                        }
                      />
                    </td>
                    <td className="editable-cell rate-cell">
                      <input
                        aria-label={`Year ${row.year} expected return`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        step="0.1"
                        value={row.annualRate}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) =>
                          updateYear(
                            yearIndex,
                            'annualRate',
                            Number(event.target.value) || 0,
                          )
                        }
                      />
                      <span>%</span>
                    </td>
                    <td className="result-cell">{tableMoney.format(result.totalContributions)}</td>
                    <td className="result-cell positive">+{tableMoney.format(result.interest)}</td>
                    <td className="result-cell ending-cell">{tableMoney.format(result.endingBalance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="formula-note">
          <strong>How it compounds</strong>
          <p>
            Each year uses its own annual return. The selected compounding frequency is converted
            to an equivalent monthly growth rate so every monthly contribution receives the right
            amount of time in the market. Annual top-ups follow the same beginning/end timing choice.
          </p>
        </div>
          </section>
        </>
      ) : (
        <section className="weighted-workspace" role="tabpanel">
          <div className="weighted-hero">
            <div>
              <p className="section-kicker">Portfolio return calculator</p>
              <h2>Weighted average return</h2>
              <p>
                Combine investments with different sizes and returns into one portfolio-level rate.
              </p>
            </div>
            <button
              className="apply-weighted-button"
              type="button"
              disabled={totalWeightedInvestment === 0}
              onClick={applyWeightedReturn}
            >
              Apply {weightedAverageReturn.toFixed(2)}% to default
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="weighted-summary-grid">
            <article className="weighted-result-card">
              <span>Weighted average</span>
              <strong>{weightedAverageReturn.toFixed(2)}%</strong>
              <small>Expected annual portfolio return</small>
              <PieChart aria-hidden="true" />
            </article>
            <article className="weighted-stat-card">
              <span>Total invested</span>
              <strong>{money.format(totalWeightedInvestment)}</strong>
              <small>Across {weightedInvestments.length} {weightedInvestments.length === 1 ? 'investment' : 'investments'}</small>
            </article>
            <article className="weighted-stat-card apply-note-card">
              <span>Apply behavior</span>
              <strong>Default only</strong>
              <small>Existing yearly return values stay unchanged</small>
            </article>
          </div>

          <article className="weighted-table-card">
            <div className="weighted-table-heading">
              <div>
                <h3>Investment mix</h3>
                <p>Allocation and weighted contribution calculate automatically.</p>
              </div>
              <button type="button" onClick={addWeightedInvestment}>
                <Plus size={16} aria-hidden="true" /> Add investment
              </button>
            </div>

            {weightedInvestments.length === 0 ? (
              <div className="weighted-empty">
                <Calculator size={28} aria-hidden="true" />
                <h3>Add an investment to begin</h3>
                <button type="button" onClick={addWeightedInvestment}>
                  <Plus size={16} aria-hidden="true" /> Add investment
                </button>
              </div>
            ) : (
              <div className="weighted-table-wrap">
                <table className="weighted-table">
                  <thead>
                    <tr>
                      <th>Investment name</th>
                      <th>Invested amount</th>
                      <th>Return</th>
                      <th>Allocation</th>
                      <th>Weighted return</th>
                      <th><span className="sr-only">Remove</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {weightedInvestments.map((investment) => {
                      const allocation =
                        totalWeightedInvestment > 0
                          ? investment.amount / totalWeightedInvestment
                          : 0;
                      return (
                        <tr key={investment.id}>
                          <td>
                            <input
                              className="investment-name-input"
                              aria-label="Investment name"
                              value={investment.name}
                              onChange={(event) =>
                                updateWeightedInvestment(
                                  investment.id,
                                  'name',
                                  event.target.value,
                                )
                              }
                            />
                          </td>
                          <td>
                            <label className="weighted-number-input">
                              <span>S$</span>
                              <CurrencyInput
                                aria-label={`${investment.name} invested amount`}
                                value={investment.amount}
                                onValueChange={(value) =>
                                  updateWeightedInvestment(
                                    investment.id,
                                    'amount',
                                    value,
                                  )
                                }
                              />
                            </label>
                          </td>
                          <td>
                            <label className="weighted-number-input return-input">
                              <input
                                aria-label={`${investment.name} expected return`}
                                type="number"
                                inputMode="decimal"
                                min="0"
                                max="100"
                                step="0.1"
                                value={investment.annualReturn}
                                onFocus={(event) => event.currentTarget.select()}
                                onChange={(event) =>
                                  updateWeightedInvestment(
                                    investment.id,
                                    'annualReturn',
                                    event.target.value,
                                  )
                                }
                              />
                              <span>%</span>
                            </label>
                          </td>
                          <td className="allocation-cell">
                            <strong>{(allocation * 100).toFixed(1)}%</strong>
                            <span><i style={{ width: `${allocation * 100}%` }} /></span>
                          </td>
                          <td className="weighted-contribution-cell">
                            {(allocation * investment.annualReturn).toFixed(2)} pp
                          </td>
                          <td>
                            <button
                              className="remove-investment-button"
                              type="button"
                              aria-label={`Remove ${investment.name}`}
                              onClick={() => removeWeightedInvestment(investment.id)}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total portfolio</td>
                      <td>{money.format(totalWeightedInvestment)}</td>
                      <td>—</td>
                      <td>100%</td>
                      <td>{weightedAverageReturn.toFixed(2)}%</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </article>
        </section>
      )}
      </main>

      {savesOpen && (
        <div className="drawer-layer">
          <button
            className="drawer-backdrop"
            type="button"
            aria-label="Close saved plans"
            onClick={() => setSavesOpen(false)}
          />
          <aside className="saved-drawer" role="dialog" aria-modal="true" aria-labelledby="saved-plans-title">
            <header className="drawer-header">
              <div>
                <p className="section-kicker">Local snapshots</p>
                <h2 id="saved-plans-title">Saved plans</h2>
                <p>{savedPlans.length} {savedPlans.length === 1 ? 'record' : 'records'} on this browser</p>
              </div>
              <button className="icon-button" type="button" aria-label="Close saved plans" onClick={() => setSavesOpen(false)}>
                <X size={19} aria-hidden="true" />
              </button>
            </header>

            <div className="drawer-toolbar">
              <button className="save-another-button" type="button" onClick={openSaveDialog}>
                <Save size={15} aria-hidden="true" /> Save current plan
              </button>
              <button
                className="export-all-button"
                type="button"
                disabled={savedPlans.length === 0}
                onClick={exportAllSavedPlans}
              >
                <Download size={15} aria-hidden="true" /> Export all
              </button>
            </div>

            {savedPlans.length === 0 ? (
              <div className="empty-saves">
                <FolderOpen size={28} aria-hidden="true" />
                <h3>No saved plans yet</h3>
                <p>Save the current calculator values to create your first snapshot.</p>
              </div>
            ) : (
              <div className="records-table-wrap">
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Saved</th>
                      <th>Ending balance</th>
                      <th><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedPlans.map((record) => (
                      <tr key={record.id}>
                        <td className="record-name-cell">
                          {editingSaveId === record.id ? (
                            <form
                              className="rename-form"
                              onSubmit={(event) => {
                                event.preventDefault();
                                commitRename();
                              }}
                            >
                              <input
                                autoFocus
                                aria-label="Saved plan name"
                                value={editingSaveName}
                                onChange={(event) => setEditingSaveName(event.target.value)}
                              />
                              <button type="submit" aria-label="Save new name"><Check size={14} /></button>
                              <button type="button" aria-label="Cancel rename" onClick={() => setEditingSaveId(null)}><X size={14} /></button>
                            </form>
                          ) : (
                            <strong>{record.name}</strong>
                          )}
                        </td>
                        <td>{savedDate.format(new Date(record.createdAt))}</td>
                        <td className="record-balance">{money.format(endingBalanceFor(record))}</td>
                        <td>
                          <div className="record-actions">
                            <button type="button" title="Restore" aria-label={`Restore ${record.name}`} onClick={() => setPendingRestore(record)}>
                              <RefreshCcw size={15} />
                            </button>
                            <button type="button" title="Export" aria-label={`Export ${record.name}`} onClick={() => exportSavedPlan(record)}>
                              <Download size={15} />
                            </button>
                            <button type="button" title="Rename" aria-label={`Rename ${record.name}`} onClick={() => startRename(record)}>
                              <Pencil size={15} />
                            </button>
                            <button className="delete-record" type="button" title="Delete" aria-label={`Delete ${record.name}`} onClick={() => deleteSavedPlan(record)}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </aside>
        </div>
      )}

      {saveDialogOpen && (
        <div className="modal-layer">
          <button
            className="modal-backdrop"
            type="button"
            aria-label="Cancel save"
            onClick={() => setSaveDialogOpen(false)}
          />
          <form
            className="save-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-dialog-title"
            onSubmit={(event) => {
              event.preventDefault();
              saveCurrentPlan();
            }}
          >
            <div className="save-dialog-icon"><Save size={20} aria-hidden="true" /></div>
            <h2 id="save-dialog-title">Save this plan</h2>
            <p>Everything in the calculator—including every monthly contribution—will be stored in this browser.</p>
            <label>
              <span>Save name</span>
              <input autoFocus value={saveName} onChange={(event) => setSaveName(event.target.value)} />
            </label>
            <div className="dialog-actions">
              <button type="button" onClick={() => setSaveDialogOpen(false)}>Cancel</button>
              <button className="confirm-save" type="submit" disabled={!saveName.trim()}>
                <Save size={15} aria-hidden="true" /> Save snapshot
              </button>
            </div>
          </form>
        </div>
      )}

      {pendingRestore && (
        <div className="modal-layer">
          <button
            className="modal-backdrop"
            type="button"
            aria-label="Cancel restore"
            onClick={() => setPendingRestore(null)}
          />
          <section
            className="save-dialog restore-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="restore-dialog-title"
            aria-describedby="restore-dialog-description"
          >
            <div className="save-dialog-icon restore-dialog-icon">
              <AlertTriangle size={21} aria-hidden="true" />
            </div>
            <h2 id="restore-dialog-title">Replace the current plan?</h2>
            <p id="restore-dialog-description">
              Restoring <strong>“{pendingRestore.name}”</strong> will replace every current setting
              and contribution value. Your other saved plans will remain unchanged.
            </p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setPendingRestore(null)}>Keep current plan</button>
              <button className="confirm-restore" type="button" onClick={confirmRestoreSavedPlan}>
                <RefreshCcw size={15} aria-hidden="true" /> Restore saved plan
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default App;
