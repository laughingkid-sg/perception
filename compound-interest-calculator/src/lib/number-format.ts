export function formatCurrencyInput(value: number) {
  if (!Number.isFinite(value)) return '0';
  return Math.max(0, Math.round(value)).toLocaleString('en-SG');
}

export function parseCurrencyInput(rawValue: string) {
  const digits = rawValue.replace(/\D/g, '');
  if (!digits) return { display: '', value: 0 };

  const normalized = digits.replace(/^0+(?=\d)/, '');
  const value = Number(normalized);
  return {
    display: formatCurrencyInput(value),
    value,
  };
}
