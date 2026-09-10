export type BenefitMode =
  | 'cash-taxable'
  | 'cash-nontaxable'
  | 'package-taxable'
  | 'package-nontaxable';

export type Benefit = {
  id: string;
  name: string;
  amount: number;
  mode: BenefitMode;
};

export type Expense = {
  id: string;
  name: string;
  monthly: number;
};

export type AgeBand =
  | '55-and-below'
  | '55-60'
  | '60-65'
  | '65-70'
  | 'above-70';

export type CpfStatus = 'full' | 'pr-year-1' | 'pr-year-2' | 'none';

export type RegionResult = {
  employerPackage: number;
  grossCash: number;
  taxableCompensation: number;
  incomeTax: number;
  employeeStatutory: number;
  employeeVoluntary: number;
  employerStatutory: number;
  livingExpenses: number;
  netPay: number;
  disposableIncome: number;
  effectiveIncomeTaxRate: number;
  effectiveAllInRate: number;
  benefitCost: number;
  cashBenefits: number;
};

export type SingaporeResult = RegionResult & {
  employeeCpf: number;
  employerCpf: number;
  cpfWages: number;
  chargeableIncome: number;
  reliefs: number;
};

export type UnitedStatesResult = RegionResult & {
  federalIncomeTax: number;
  stateLocalTax: number;
  employeeFica: number;
  employerFica: number;
  federalTaxableIncome: number;
};

const isCash = (benefit: Benefit) =>
  benefit.mode === 'cash-taxable' || benefit.mode === 'cash-nontaxable';

const isTaxable = (benefit: Benefit) =>
  benefit.mode === 'cash-taxable' || benefit.mode === 'package-taxable';

const sum = (values: number[]) =>
  values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);

export const annualLivingExpenses = (expenses: Expense[]) =>
  sum(expenses.map((expense) => Math.max(0, expense.monthly))) * 12;

export const benefitTotals = (benefits: Benefit[]) => ({
  cost: sum(benefits.map((benefit) => Math.max(0, benefit.amount))),
  cash: sum(
    benefits
      .filter(isCash)
      .map((benefit) => Math.max(0, benefit.amount)),
  ),
  taxable: sum(
    benefits
      .filter(isTaxable)
      .map((benefit) => Math.max(0, benefit.amount)),
  ),
  cashTaxable: sum(
    benefits
      .filter((benefit) => benefit.mode === 'cash-taxable')
      .map((benefit) => Math.max(0, benefit.amount)),
  ),
});

export const progressiveTax = (
  taxableIncome: number,
  brackets: Array<{ upper: number; rate: number }>,
) => {
  let lower = 0;
  let tax = 0;

  for (const bracket of brackets) {
    if (taxableIncome <= lower) break;
    const slice = Math.min(taxableIncome, bracket.upper) - lower;
    tax += Math.max(0, slice) * bracket.rate;
    lower = bracket.upper;
  }

  return tax;
};

export const singaporeResidentTax = (chargeableIncome: number) =>
  progressiveTax(Math.max(0, chargeableIncome), [
    { upper: 20_000, rate: 0 },
    { upper: 30_000, rate: 0.02 },
    { upper: 40_000, rate: 0.035 },
    { upper: 80_000, rate: 0.07 },
    { upper: 120_000, rate: 0.115 },
    { upper: 160_000, rate: 0.15 },
    { upper: 200_000, rate: 0.18 },
    { upper: 240_000, rate: 0.19 },
    { upper: 280_000, rate: 0.195 },
    { upper: 320_000, rate: 0.2 },
    { upper: 500_000, rate: 0.22 },
    { upper: 1_000_000, rate: 0.23 },
    { upper: Number.POSITIVE_INFINITY, rate: 0.24 },
  ]);

export const usFederalTax2026Single = (taxableIncome: number) =>
  progressiveTax(Math.max(0, taxableIncome), [
    { upper: 12_400, rate: 0.1 },
    { upper: 50_400, rate: 0.12 },
    { upper: 105_700, rate: 0.22 },
    { upper: 201_775, rate: 0.24 },
    { upper: 256_225, rate: 0.32 },
    { upper: 640_600, rate: 0.35 },
    { upper: Number.POSITIVE_INFINITY, rate: 0.37 },
  ]);

export const cpfRates = (status: CpfStatus, ageBand: AgeBand) => {
  if (status === 'none') return { employer: 0, employee: 0 };

  if (status === 'pr-year-1') {
    return ageBand === '55-and-below' || ageBand === '55-60'
      ? { employer: 0.04, employee: 0.05 }
      : { employer: 0.035, employee: 0.05 };
  }

  if (status === 'pr-year-2') {
    if (ageBand === '55-and-below') return { employer: 0.09, employee: 0.15 };
    if (ageBand === '55-60') return { employer: 0.06, employee: 0.125 };
    if (ageBand === '60-65') return { employer: 0.035, employee: 0.075 };
    return { employer: 0.035, employee: 0.05 };
  }

  const fullRates: Record<AgeBand, { employer: number; employee: number }> = {
    '55-and-below': { employer: 0.17, employee: 0.2 },
    '55-60': { employer: 0.16, employee: 0.18 },
    '60-65': { employer: 0.125, employee: 0.125 },
    '65-70': { employer: 0.09, employee: 0.075 },
    'above-70': { employer: 0.075, employee: 0.05 },
  };

  return fullRates[ageBand];
};

const earnedIncomeRelief = (ageBand: AgeBand) => {
  if (ageBand === '55-and-below') return 1_000;
  if (ageBand === '55-60') return 6_000;
  return 8_000;
};

export function calculateSingapore(input: {
  base: number;
  bonus: number;
  equity: number;
  benefits: Benefit[];
  expenses: Expense[];
  cpfStatus: CpfStatus;
  ageBand: AgeBand;
  taxResident: boolean;
  otherReliefs: number;
}): SingaporeResult {
  const base = Math.max(0, input.base);
  const bonus = Math.max(0, input.bonus);
  const equity = Math.max(0, input.equity);
  const benefits = benefitTotals(input.benefits);
  const rates = cpfRates(input.cpfStatus, input.ageBand);

  const cpfOrdinaryWages = Math.min(base / 12, 8_000) * 12;
  const additionalWageCeiling = Math.max(0, 102_000 - cpfOrdinaryWages);
  const cpfAdditionalWages = Math.min(
    bonus + benefits.cashTaxable,
    additionalWageCeiling,
  );
  const cpfWages = cpfOrdinaryWages + cpfAdditionalWages;
  const employeeCpf = cpfWages * rates.employee;
  const employerCpf = cpfWages * rates.employer;

  const grossCash = base + bonus + equity + benefits.cash;
  const taxableCompensation = base + bonus + equity + benefits.taxable;
  const reliefs = input.taxResident
    ? Math.min(
        80_000,
        employeeCpf +
          earnedIncomeRelief(input.ageBand) +
          Math.max(0, input.otherReliefs),
      )
    : 0;
  const chargeableIncome = Math.max(0, taxableCompensation - reliefs);
  const residentTax = singaporeResidentTax(chargeableIncome);
  const incomeTax = input.taxResident
    ? residentTax
    : Math.max(taxableCompensation * 0.15, singaporeResidentTax(taxableCompensation));
  const livingExpenses = annualLivingExpenses(input.expenses);
  const netPay = grossCash - incomeTax - employeeCpf;
  const disposableIncome = netPay - livingExpenses;
  const employerPackage = base + bonus + equity + benefits.cost + employerCpf;
  const employeeStatutory = employeeCpf;

  return {
    employerPackage,
    grossCash,
    taxableCompensation,
    incomeTax,
    employeeStatutory,
    employeeVoluntary: 0,
    employerStatutory: employerCpf,
    livingExpenses,
    netPay,
    disposableIncome,
    effectiveIncomeTaxRate:
      taxableCompensation > 0 ? incomeTax / taxableCompensation : 0,
    effectiveAllInRate:
      taxableCompensation > 0
        ? (incomeTax + employeeStatutory) / taxableCompensation
        : 0,
    benefitCost: benefits.cost,
    cashBenefits: benefits.cash,
    employeeCpf,
    employerCpf,
    cpfWages,
    chargeableIncome,
    reliefs,
  };
}

export function calculateUnitedStates(input: {
  base: number;
  bonus: number;
  equity: number;
  benefits: Benefit[];
  expenses: Expense[];
  retirement401k: number;
  otherPretax: number;
  federalMode: 'automatic' | 'manual';
  manualFederalTax: number;
  stateMode: 'rate' | 'annual';
  stateValue: number;
}): UnitedStatesResult {
  const base = Math.max(0, input.base);
  const bonus = Math.max(0, input.bonus);
  const equity = Math.max(0, input.equity);
  const retirement401k = Math.max(0, input.retirement401k);
  const otherPretax = Math.max(0, input.otherPretax);
  const benefits = benefitTotals(input.benefits);

  const grossCash = base + bonus + equity + benefits.cash;
  const taxableCompensation = base + bonus + equity + benefits.taxable;
  const federalTaxableIncome = Math.max(
    0,
    taxableCompensation - retirement401k - otherPretax - 16_100,
  );
  const federalIncomeTax =
    input.federalMode === 'manual'
      ? Math.max(0, input.manualFederalTax)
      : usFederalTax2026Single(federalTaxableIncome);

  // A 401(k) deferral generally still attracts FICA; the other pre-tax field is
  // modeled as a Section 125/HSA-style payroll deduction that reduces FICA wages.
  const ficaWages = Math.max(0, taxableCompensation - otherPretax);
  const employeeSocialSecurity = Math.min(ficaWages, 184_500) * 0.062;
  const employeeMedicare = ficaWages * 0.0145;
  const additionalMedicare = Math.max(0, ficaWages - 200_000) * 0.009;
  const employeeFica =
    employeeSocialSecurity + employeeMedicare + additionalMedicare;
  const employerFica =
    Math.min(ficaWages, 184_500) * 0.062 + ficaWages * 0.0145;

  const stateTaxBase = Math.max(
    0,
    taxableCompensation - retirement401k - otherPretax,
  );
  const stateLocalTax =
    input.stateMode === 'annual'
      ? Math.max(0, input.stateValue)
      : stateTaxBase * (Math.max(0, input.stateValue) / 100);
  const incomeTax = federalIncomeTax + stateLocalTax;
  const employeeVoluntary = retirement401k + otherPretax;
  const employeeStatutory = employeeFica;
  const livingExpenses = annualLivingExpenses(input.expenses);
  const netPay =
    grossCash - incomeTax - employeeFica - retirement401k - otherPretax;
  const disposableIncome = netPay - livingExpenses;
  const employerPackage =
    base + bonus + equity + benefits.cost + employerFica;

  return {
    employerPackage,
    grossCash,
    taxableCompensation,
    incomeTax,
    employeeStatutory,
    employeeVoluntary,
    employerStatutory: employerFica,
    livingExpenses,
    netPay,
    disposableIncome,
    effectiveIncomeTaxRate:
      taxableCompensation > 0 ? incomeTax / taxableCompensation : 0,
    effectiveAllInRate:
      taxableCompensation > 0
        ? (incomeTax + employeeFica) / taxableCompensation
        : 0,
    benefitCost: benefits.cost,
    cashBenefits: benefits.cash,
    federalIncomeTax,
    stateLocalTax,
    employeeFica,
    employerFica,
    federalTaxableIncome,
  };
}
