import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { formatMonth } from "../lib/calculations";

export function MonthSelect({
  value,
  months,
  onChange,
}: {
  value: string;
  months: string[];
  onChange: (month: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    root.current?.querySelector(`[data-option="${active}"]`)?.scrollIntoView({ block: "nearest" });
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, active]);
  const choose = (index: number) => {
    onChange(months[index]);
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div
      className="month-select"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span id={`${id}-label`} className="field-label">
        Plan start month
      </span>
      <button
        ref={trigger}
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => {
          setActive(Math.max(0, months.indexOf(value)));
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive(Math.max(0, months.indexOf(value)));
            setOpen(true);
          }
        }}
      >
        <span id={`${id}-value`}>{formatMonth(value)}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div
          ref={list}
          id={`${id}-list`}
          className="month-options"
          role="listbox"
          tabIndex={-1}
          aria-labelledby={`${id}-label`}
          aria-activedescendant={`${id}-option-${active}`}
          onKeyDown={(event) => {
            if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape"].includes(event.key))
              event.preventDefault();
            if (event.key === "ArrowDown") setActive(Math.min(months.length - 1, active + 1));
            if (event.key === "ArrowUp") setActive(Math.max(0, active - 1));
            if (event.key === "Home") setActive(0);
            if (event.key === "End") setActive(months.length - 1);
            if (event.key === "Enter" || event.key === " ") choose(active);
            if (event.key === "Escape") {
              setOpen(false);
              trigger.current?.focus();
            }
          }}
        >
          {months.map((month, index) => (
            <div
              key={month}
              id={`${id}-option-${index}`}
              data-option={index}
              className={`month-option ${active === index ? "active" : ""}`}
              role="option"
              aria-selected={value === month}
              onPointerMove={() => setActive(index)}
              onClick={() => choose(index)}
            >
              {formatMonth(month)}
              {value === month && <Check size={15} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
