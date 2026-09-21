export type CompoundingFrequency =
  | 'daily'
  | 'monthly'
  | 'quarterly'
  | 'semiannually'
  | 'annually';

export type ContributionTiming = 'beginning' | 'end';

export type YearPlan = {
  year: number;
  monthlyContributions: number[];
  annualContribution: number;
  annualRate: number;
};

export type YearResult = {
  year: number;
  startingBalance: number;
  monthlyContributions: number;
  annualContribution: number;
  totalContributions: number;
  interest: number;
  endingBalance: number;
  cumulativeContributions: number;
  cumulativeInterest: number;
};

export type ProjectionResult = {
  endingBalance: number;
  initialInvestment: number;
  totalContributions: number;
  totalPrincipal: number;
  totalInterest: number;
  years: YearResult[];
};

export type WeightedReturnInput = {
  amount: number;
  annualReturn: number;
};

const periodsPerYear: Record<CompoundingFrequency, number> = {
  daily: 365,
  monthly: 12,
  quarterly: 4,
  semiannually: 2,
  annually: 1,
};

export function equivalentMonthlyRate(
  annualRate: number,
  compounding: CompoundingFrequency,
) {
  const nominalRate = Math.max(-99.999, annualRate) / 100;
  const periods = periodsPerYear[compounding];
  return Math.pow(1 + nominalRate / periods, periods / 12) - 1;
}

const safeAmount = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

export function calculateWeightedAverageReturn(
  investments: WeightedReturnInput[],
) {
  const totalAmount = investments.reduce(
    (total, investment) => total + safeAmount(investment.amount),
    0,
  );
  if (totalAmount === 0) return 0;

  const weightedReturn = investments.reduce(
    (total, investment) =>
      total +
      safeAmount(investment.amount) *
        (Number.isFinite(investment.annualReturn)
          ? Math.max(0, investment.annualReturn)
          : 0),
    0,
  );

  return weightedReturn / totalAmount;
}

export function calculateProjection(input: {
  initialInvestment: number;
  schedule: YearPlan[];
  compounding: CompoundingFrequency;
  contributionTiming: ContributionTiming;
}): ProjectionResult {
  const initialInvestment = safeAmount(input.initialInvestment);
  let balance = initialInvestment;
  let cumulativeContributions = 0;
  let cumulativeInterest = 0;
  const years: YearResult[] = [];

  for (const plan of input.schedule) {
    const startingBalance = balance;
    const monthlyRate = equivalentMonthlyRate(
      plan.annualRate,
      input.compounding,
    );
    const monthlyContributions = Array.from(
      { length: 12 },
      (_, month) => safeAmount(plan.monthlyContributions[month] ?? 0),
    );
    const annualContribution = safeAmount(plan.annualContribution);
    let interest = 0;

    for (let month = 0; month < 12; month += 1) {
      const monthlyContribution = monthlyContributions[month];

      if (input.contributionTiming === 'beginning') {
        balance += monthlyContribution;
        if (month === 0) balance += annualContribution;
      }

      const monthInterest = balance * monthlyRate;
      balance += monthInterest;
      interest += monthInterest;

      if (input.contributionTiming === 'end') {
        balance += monthlyContribution;
        if (month === 11) balance += annualContribution;
      }
    }

    const monthlyTotal = monthlyContributions.reduce(
      (total, value) => total + value,
      0,
    );
    const totalContributions = monthlyTotal + annualContribution;
    cumulativeContributions += totalContributions;
    cumulativeInterest += interest;

    years.push({
      year: plan.year,
      startingBalance,
      monthlyContributions: monthlyTotal,
      annualContribution,
      totalContributions,
      interest,
      endingBalance: balance,
      cumulativeContributions,
      cumulativeInterest,
    });
  }

  return {
    endingBalance: balance,
    initialInvestment,
    totalContributions: cumulativeContributions,
    totalPrincipal: initialInvestment + cumulativeContributions,
    totalInterest: balance - initialInvestment - cumulativeContributions,
    years,
  };
}

export function createSchedule(
  years: number,
  monthlyContribution: number,
  annualContribution: number,
  annualRate: number,
): YearPlan[] {
  return Array.from({ length: Math.max(1, Math.round(years)) }, (_, index) => ({
    year: index + 1,
    monthlyContributions: Array(12).fill(safeAmount(monthlyContribution)),
    annualContribution: safeAmount(annualContribution),
    annualRate: Number.isFinite(annualRate) ? annualRate : 0,
  }));
}
