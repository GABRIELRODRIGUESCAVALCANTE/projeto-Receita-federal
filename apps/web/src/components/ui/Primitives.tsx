import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

/** Número monetário com transição rápida e algarismos tabulares */
export function AnimatedCurrency({ value, className = '' }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startVal = prevRef.current;
    const diff = value - startVal;

    if (prefersReduced || Math.abs(diff) < 0.001) {
      setDisplay(value);
      prevRef.current = value;
      return;
    }

    const duration = 260;
    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(startVal + diff * eased);
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
        prevRef.current = value;
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value]);

  const formatted = display.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return <span className={`tabular-nums ${className}`}>{formatted}</span>;
}

interface RateMeterProps {
  value: number;
  max?: number;
  label: string;
  tone?: 'primary' | 'neutral' | 'success' | 'warning';
}

const METER_FILL: Record<NonNullable<RateMeterProps['tone']>, string> = {
  primary: 'bg-[#0B4F6C] dark:bg-[#38A3C7]',
  neutral: 'bg-slate-600 dark:bg-slate-400',
  success: 'bg-emerald-700 dark:bg-emerald-500',
  warning: 'bg-amber-600 dark:bg-amber-500',
};

/** Régua linear de alíquota / carga efetiva — direta e comparável */
export function RateMeter({ value, max = 30, label, tone = 'primary' }: RateMeterProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</span>
        <span className="font-mono text-base font-semibold tracking-tight text-slate-900 tabular-nums dark:text-slate-100">
          {value.toFixed(2)}%
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-800 dark:ring-slate-700/80"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Number(value.toFixed(2))}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${METER_FILL[tone]}`}
          style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%` }}
        />
      </div>
    </div>
  );
}

interface MetricCellProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'primary' | 'success';
}

/** Célula de indicador para compor faixas tabulares sem excesso de cards */
export function MetricCell({ label, value, hint, tone = 'default' }: MetricCellProps) {
  const valueColor =
    tone === 'primary'
      ? 'text-[#0B4F6C] dark:text-[#5CC2E3]'
      : tone === 'success'
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-slate-900 dark:text-slate-100';

  return (
    <div className="bg-white px-4 py-3.5 sm:px-5 sm:py-4 dark:bg-[#131920]">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-1 font-mono text-xl font-semibold tracking-tight tabular-nums ${valueColor}`}>{value}</div>
      {hint && <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{hint}</div>}
    </div>
  );
}

interface SegmentedTabItem<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
}

export function SegmentedTabs<T extends string>({
  items,
  active,
  onChange,
  ariaLabel = 'Seções',
}: {
  items: Array<SegmentedTabItem<T>>;
  active: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100/90 p-1 dark:border-[#232C38] dark:bg-[#0C1015]"
    >
      {items.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
              isActive
                ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/90 dark:bg-[#1A222C] dark:text-slate-100 dark:shadow-none dark:ring-[#2E3A49]'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                  isActive
                    ? 'bg-slate-100 text-slate-800 dark:bg-[#131920] dark:text-slate-200'
                    : 'bg-slate-200/70 text-slate-600 dark:bg-[#1A222C] dark:text-slate-400'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard restrictions
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      className="rtc-btn-secondary inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
      )}
      <span>{copied ? 'Copiado' : label}</span>
    </button>
  );
}

export function StatusDot({
  status,
  label,
}: {
  status: 'online' | 'offline' | 'degraded';
  label?: string;
}) {
  const dotClass =
    status === 'online'
      ? 'bg-emerald-600 dark:bg-emerald-400'
      : status === 'degraded'
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-rose-600 dark:bg-rose-400';

  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotClass}`}
      aria-label={label}
      aria-hidden={!label}
    />
  );
}
