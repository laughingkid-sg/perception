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

export type AgeBand = '55-and-below' | '55-60' | '60-65' | '65-70' | 'above-70';

export type CpfStatus = 'full' | 'pr-year-1' | 'pr-year-2' | 'none';

export type UsStateMode =
  | 'california'
  | 'washington'
  | 'new-york-city'
  | 'texas'
  | 'rate'
  | 'annual';

export type RegionResult = {
  employerPackage: number;
  grossCash: number;
  taxableCompensation: number;
  incomeTax: number;
  employeeStatutory: number;
  employeeVoluntary: number;
  employeeBenefits: number;
  employeeSavings: number;
  employerSavings: number;
  employerStatutory: number;
  livingExpenses: number;
  cashAfterMandatory: number;
  netPay: number;
  disposableIncome: number;
  wealthAccumulation: number;
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
  statePayrollTax: number;
  employeeFica: number;
  employeeSocialSecurity: number;
  employeeMedicare: number;
  additionalMedicare: number;
  employerFica: number;
  federalTaxableIncome: number;
  stateTaxableIncome: number;
  traditional401k: number;
  roth401k: number;
  healthPremium: number;
  hsaContribution: number;
  otherSection125: number;
  employer401kMatch: number;
};

export const US_401K_LIMIT_2026 = 24_500;
export const US_HSA_SELF_LIMIT_2026 = 4_400;
export const US_HSA_FAMILY_LIMIT_2026 = 8_750;
export const CALIFORNIA_SDI_RATE_2026 = 0.013;
export const CALIFORNIA_STANDARD_DEDUCTION_2026_SINGLE = 5_706;
export const NEW_YORK_STANDARD_DEDUCTION_SINGLE = 8_000;
export const NEW_YORK_PFL_RATE_2026 = 0.00432;
export const NEW_YORK_PFL_MAX_2026 = 411.91;
export const WASHINGTON_PAID_LEAVE_RATE_2026 = 0.0113;
export const WASHINGTON_PAID_LEAVE_EMPLOYEE_SHARE_2026 = 0.7143;
export const WASHINGTON_CARES_RATE_2026 = 0.0058;
const CALIFORNIA_PERSONAL_EXEMPTION_CREDIT_2026 = 153;

const isCash = (benefit: Benefit) =>
  benefit.mode === 'cash-taxable' || benefit.mode === 'cash-nontaxable';

const isTaxable = (benefit: Benefit) =>
  benefit.mode === 'cash-taxable' || benefit.mode === 'package-taxable';

const sum = (values: number[]) =>
  values.reduce(
    (total, value) => total + (Number.isFinite(value) ? value : 0),
    0,
  );

export const annualLivingExpenses = (expenses: Expense[]) =>
  sum(expenses.map((expense) => Math.max(0, expense.monthly))) * 12;

export const benefitTotals = (benefits: Benefit[]) => ({
  cost: sum(benefits.map((benefit) => Math.max(0, benefit.amount))),
  cash: sum(
    benefits.filter(isCash).map((benefit) => Math.max(0, benefit.amount)),
  ),
  taxable: sum(
    benefits.filter(isTaxable).map((benefit) => Math.max(0, benefit.amount)),
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

// The 2026 FTB estimated-tax instructions direct filers to the 2025 rate
// schedule and standard deduction. This estimate assumes a single filer with
// one personal exemption credit and no itemized deductions or other credits.
export const californiaIncomeTax2026SingleEstimate = (taxableIncome: number) =>
  Math.max(
    0,
    progressiveTax(Math.max(0, taxableIncome), [
      { upper: 11_079, rate: 0.01 },
      { upper: 26_264, rate: 0.02 },
      { upper: 41_452, rate: 0.04 },
      { upper: 57_542, rate: 0.06 },
      { upper: 72_724, rate: 0.08 },
      { upper: 371_479, rate: 0.093 },
      { upper: 445_771, rate: 0.103 },
      { upper: 742_953, rate: 0.113 },
      { upper: Number.POSITIVE_INFINITY, rate: 0.123 },
    ]) - CALIFORNIA_PERSONAL_EXEMPTION_CREDIT_2026,
  );

// The 2026 New York rates phase in the first half of a 0.2 percentage-point
// reduction for income up to $215,400. This planning estimate does not model
// New York's high-income benefit recapture or tax credits.
export const newYorkStateIncomeTax2026SingleEstimate = (
  taxableIncome: number,
) =>
  progressiveTax(Math.max(0, taxableIncome), [
    { upper: 8_500, rate: 0.039 },
    { upper: 11_700, rate: 0.044 },
    { upper: 13_900, rate: 0.0515 },
    { upper: 80_650, rate: 0.054 },
    { upper: 215_400, rate: 0.059 },
    { upper: 1_077_550, rate: 0.0685 },
    { upper: 5_000_000, rate: 0.0965 },
    { upper: 25_000_000, rate: 0.103 },
    { upper: Number.POSITIVE_INFINITY, rate: 0.109 },
  ]);

export const newYorkCityIncomeTaxSingleEstimate = (taxableIncome: number) =>
  progressiveTax(Math.max(0, taxableIncome), [
    { upper: 12_000, rate: 0.03078 },
    { upper: 25_000, rate: 0.03762 },
    { upper: 50_000, rate: 0.03819 },
    { upper: Number.POSITIVE_INFINITY, rate: 0.03876 },
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
    : Math.max(
        taxableCompensation * 0.15,
        singaporeResidentTax(taxableCompensation),
      );
  const livingExpenses = annualLivingExpenses(input.expenses);
  const netPay = grossCash - incomeTax - employeeCpf;
  const disposableIncome = netPay - livingExpenses;
  const employerPackage = base + bonus + equity + benefits.cost + employerCpf;
  const employeeStatutory = employeeCpf;
  const employeeSavings = employeeCpf;
  const employerSavings = employerCpf;
  const wealthAccumulation =
    disposableIncome + employeeSavings + employerSavings;

  return {
    employerPackage,
    grossCash,
    taxableCompensation,
    incomeTax,
    employeeStatutory,
    employeeVoluntary: 0,
    employeeBenefits: 0,
    employeeSavings,
    employerSavings,
    employerStatutory: employerCpf,
    livingExpenses,
    cashAfterMandatory: netPay,
    netPay,
    disposableIncome,
    wealthAccumulation,
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
  traditional401k: number;
  roth401k: number;
  healthPremiumMonthly: number;
  hsaContribution: number;
  hsaEligible: boolean;
  hsaCoverage: 'self' | 'family';
  otherSection125: number;
  employer401kMatch: number;
  federalMode: 'automatic' | 'manual';
  manualFederalTax: number;
  stateMode: UsStateMode;
  stateValue: number;
}): UnitedStatesResult {
  const base = Math.max(0, input.base);
  const bonus = Math.max(0, input.bonus);
  const equity = Math.max(0, input.equity);
  const requestedTraditional401k = Math.max(0, input.traditional401k);
  const requestedRoth401k = Math.max(0, input.roth401k);
  const traditional401k = Math.min(
    requestedTraditional401k,
    US_401K_LIMIT_2026,
  );
  const roth401k = Math.min(
    requestedRoth401k,
    Math.max(0, US_401K_LIMIT_2026 - traditional401k),
  );
  const healthPremium = Math.max(0, input.healthPremiumMonthly) * 12;
  const hsaLimit = input.hsaEligible
    ? input.hsaCoverage === 'family'
      ? US_HSA_FAMILY_LIMIT_2026
      : US_HSA_SELF_LIMIT_2026
    : 0;
  const hsaContribution = Math.min(
    Math.max(0, input.hsaContribution),
    hsaLimit,
  );
  const otherSection125 = Math.max(0, input.otherSection125);
  const employer401kMatch = Math.max(0, input.employer401kMatch);
  const benefits = benefitTotals(input.benefits);

  const grossCash = base + bonus + equity + benefits.cash;
  const taxableCompensation = base + bonus + equity + benefits.taxable;
  const federalTaxableIncome = Math.max(
    0,
    taxableCompensation -
      traditional401k -
      healthPremium -
      hsaContribution -
      otherSection125 -
      16_100,
  );
  const federalIncomeTax =
    input.federalMode === 'manual'
      ? Math.max(0, input.manualFederalTax)
      : usFederalTax2026Single(federalTaxableIncome);

  // Traditional and Roth 401(k) deferrals still attract FICA. These health and
  // HSA inputs assume an eligible Section 125 payroll arrangement.
  const ficaWages = Math.max(
    0,
    taxableCompensation - healthPremium - hsaContribution - otherSection125,
  );
  const employeeSocialSecurity = Math.min(ficaWages, 184_500) * 0.062;
  const employeeMedicare = ficaWages * 0.0145;
  const additionalMedicare = Math.max(0, ficaWages - 200_000) * 0.009;
  const employeeFica =
    employeeSocialSecurity + employeeMedicare + additionalMedicare;
  const employerFica =
    Math.min(ficaWages, 184_500) * 0.062 + ficaWages * 0.0145;

  const statePretaxIncome = Math.max(
    0,
    taxableCompensation - traditional401k - healthPremium - otherSection125,
  );

  // California does not conform to the federal HSA deduction, so HSA dollars
  // are intentionally not subtracted from the California income-tax base.
  const californiaTaxableIncome = Math.max(
    0,
    statePretaxIncome - CALIFORNIA_STANDARD_DEDUCTION_2026_SINGLE,
  );
  const newYorkTaxableIncome = Math.max(
    0,
    statePretaxIncome - hsaContribution - NEW_YORK_STANDARD_DEDUCTION_SINGLE,
  );
  const stateTaxableIncome =
    input.stateMode === 'california'
      ? californiaTaxableIncome
      : input.stateMode === 'new-york-city'
        ? newYorkTaxableIncome
        : input.stateMode === 'rate'
          ? statePretaxIncome
          : 0;
  const stateLocalTax =
    input.stateMode === 'california'
      ? californiaIncomeTax2026SingleEstimate(californiaTaxableIncome)
      : input.stateMode === 'new-york-city'
        ? newYorkStateIncomeTax2026SingleEstimate(newYorkTaxableIncome) +
          newYorkCityIncomeTaxSingleEstimate(newYorkTaxableIncome)
        : input.stateMode === 'annual'
          ? Math.max(0, input.stateValue)
          : input.stateMode === 'rate'
            ? statePretaxIncome * (Math.max(0, input.stateValue) / 100)
            : 0;
  const californiaSdiWages = Math.max(
    0,
    taxableCompensation - healthPremium - otherSection125,
  );
  const statePayrollTax =
    input.stateMode === 'california'
      ? californiaSdiWages * CALIFORNIA_SDI_RATE_2026
      : input.stateMode === 'washington'
        ? Math.min(taxableCompensation, 184_500) *
            WASHINGTON_PAID_LEAVE_RATE_2026 *
            WASHINGTON_PAID_LEAVE_EMPLOYEE_SHARE_2026 +
          taxableCompensation * WASHINGTON_CARES_RATE_2026
        : input.stateMode === 'new-york-city'
          ? Math.min(
              taxableCompensation * NEW_YORK_PFL_RATE_2026,
              NEW_YORK_PFL_MAX_2026,
            )
          : 0;
  const incomeTax = federalIncomeTax + stateLocalTax;
  const employeeVoluntary = traditional401k + roth401k + hsaContribution;
  const employeeBenefits = healthPremium + otherSection125;
  const employeeSavings = employeeVoluntary;
  const employerSavings = employer401kMatch;
  const employeeStatutory = employeeFica + statePayrollTax;
  const livingExpenses = annualLivingExpenses(input.expenses);
  const cashAfterMandatory = grossCash - incomeTax - employeeStatutory;
  const netPay = cashAfterMandatory - employeeVoluntary - employeeBenefits;
  const disposableIncome = netPay - livingExpenses;
  const employerPackage =
    base + bonus + equity + benefits.cost + employerFica + employer401kMatch;
  const wealthAccumulation =
    disposableIncome + employeeSavings + employerSavings;

  return {
    employerPackage,
    grossCash,
    taxableCompensation,
    incomeTax,
    employeeStatutory,
    employeeVoluntary,
    employeeBenefits,
    employeeSavings,
    employerSavings,
    employerStatutory: employerFica,
    livingExpenses,
    cashAfterMandatory,
    netPay,
    disposableIncome,
    wealthAccumulation,
    effectiveIncomeTaxRate:
      taxableCompensation > 0 ? incomeTax / taxableCompensation : 0,
    effectiveAllInRate:
      taxableCompensation > 0
        ? (incomeTax + employeeStatutory) / taxableCompensation
        : 0,
    benefitCost: benefits.cost,
    cashBenefits: benefits.cash,
    federalIncomeTax,
    stateLocalTax,
    statePayrollTax,
    employeeFica,
    employeeSocialSecurity,
    employeeMedicare,
    additionalMedicare,
    employerFica,
    federalTaxableIncome,
    stateTaxableIncome,
    traditional401k,
    roth401k,
    healthPremium,
    hsaContribution,
    otherSection125,
    employer401kMatch,
  };
}
