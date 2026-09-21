import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

import { formatCurrencyInput, parseCurrencyInput } from '@/lib/number-format';

type CurrencyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'inputMode' | 'value' | 'onChange'
> & {
  value: number | '';
  onValueChange: (value: number) => void;
};

const displayValue = (value: number | '') =>
  value === '' ? '' : formatCurrencyInput(value);

export function CurrencyInput({
  value,
  onValueChange,
  onBlur,
  onFocus,
  ...props
}: CurrencyInputProps) {
  const [draft, setDraft] = useState(() => displayValue(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(displayValue(value));
  }, [value]);

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      value={draft}
      onFocus={(event) => {
        focused.current = true;
        event.currentTarget.select();
        onFocus?.(event);
      }}
      onBlur={(event) => {
        focused.current = false;
        setDraft(displayValue(value));
        onBlur?.(event);
      }}
      onChange={(event) => {
        const parsed = parseCurrencyInput(event.target.value);
        setDraft(parsed.display);
        onValueChange(parsed.value);
      }}
    />
  );
}
