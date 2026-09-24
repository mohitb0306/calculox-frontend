"use client";

// --- SHARED CALENDAR + TIME PICKER ---
// A single, reusable, custom-built date (and optional time) picker meant to
// replace native <input type="date"> / <input type="time"> everywhere in the
// date-based calculator family (Chronological Age, Birthday, Age
// Difference). Deliberately styled to match the app's own design system —
// same neutral/indigo palette, rounded-xl/3xl radii, shadow-sm cards, and
// dark-mode classes used across BMI/BMR/WHR/ChronologicalAge — rather than
// leaning on the browser's OS-themed date/time widgets.
//
// Positioning technique (fixed-position portal, reposition on scroll/resize,
// close on outside click) intentionally mirrors the InfoTip pattern already
// used in ChronologicalAgeCalculator.tsx, so it behaves consistently inside
// scroll containers, modals, etc.

import React, { useState, useRef, useCallback, useLayoutEffect, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import SafeIcon from '@/components/common/SafeIcon';
import * as FiIcons from 'react-icons/fi';

const { FiCalendar, FiClock, FiChevronLeft, FiChevronRight, FiChevronDown, FiX } = FiIcons;

// --- TYPES ---

export interface DateTimePickerProps {
  /** Controlled value. When `includeTime` is true, the time component of
   *  this Date IS the source of truth (the picker does not keep hidden
   *  internal time state) — pass a midnight Date to represent "no time set".
   *  The time field can be set before a date is: if so, `onChange` fires
   *  with today's date carrying the entered time, so callers shouldn't
   *  assume a non-midnight time implies the person deliberately confirmed
   *  today's date too. */
  value: Date | null;
  onChange: (date: Date | null) => void;

  /** Show the clock/time selector inside the popover, and reflect time in
   *  the trigger's display text. Defaults to false (date-only picker). */
  includeTime?: boolean;

  /** Controlled "time not set / unknown" state. There is no checkbox for
   *  this anymore — it's driven entirely by the time field itself: typing
   *  a valid time (or picking one from the wheels) clears it to false
   *  automatically, and emptying the field (or pressing the panel's Clear
   *  button) sets it back to true automatically. The component manages
   *  this on its own; `onTimeUnknownChange` just mirrors the current state
   *  out to the caller (e.g. so a report can flag totals as approximate).
   *  Only meaningful when `includeTime` is true. */
  timeUnknown?: boolean;
  onTimeUnknownChange?: (unknown: boolean) => void;
  /** Static info line shown under the time wheels (e.g. "Leave this field
   *  empty if you don't know the exact time — it'll default to
   *  midnight"). Purely informational, not a control — only rendered once
   *  a date is set. */
  timeUnknownLabel?: string;

  minDate?: Date;
  maxDate?: Date;

  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  error?: boolean;
  disabled?: boolean;

  /** Small caption shown above the date field. Defaults to "Date". */
  dateLabel?: string;
  /** Small caption shown above the time field (only relevant when
   *  `includeTime` is true). Defaults to "Time". Always rendered with a
   *  trailing "*" — time is optional in every consumer of this component
   *  (it defaults to midnight) and can be set independently of, and
   *  before, the date field. The explanatory footnote for that "*"
   *  belongs to the surrounding input card, not this component — see
   *  each calculator's own "* Optional — ..." line under its Input
   *  Fields card (matches the pattern already used for Body Fat in
   *  BMRCalculator.tsx). */
  timeLabel?: string;
}

type CalendarView = 'days' | 'months' | 'years';

// --- DATE HELPERS (local, self-contained — mirrors the "no sibling
// imports" discipline dateLogic.ts already follows) ---

const stripTime = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const isBeforeDay = (a: Date, b: Date): boolean => stripTime(a).getTime() < stripTime(b).getTime();
const isAfterDay = (a: Date, b: Date): boolean => stripTime(a).getTime() > stripTime(b).getTime();

const isDayInRange = (d: Date, min?: Date, max?: Date): boolean => {
  if (min && isBeforeDay(d, min)) return false;
  if (max && isAfterDay(d, max)) return false;
  return true;
};

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = MONTH_LABELS.map((m) => m.slice(0, 3));
const WEEKDAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const buildDayGrid = (year: number, month: number): Date[] => {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0 = Sunday
  const gridStart = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
};

// Resting (blurred) display for the date field. Deliberately the exact
// same MM/DD/YYYY shape produced by formatEditableDate below — whether a
// date arrives via the calendar popover or via typing, the trigger shows
// the identical numeric US format the moment it settles, so nothing
// visually shifts on blur and there's only ever one date format in this
// component, full stop.
const formatTriggerDate = (d: Date): string => formatEditableDate(d);

// Time keeps a locale-neutral 12-hour clock display (h:mm AM/PM) — this
// already matches what a person types (see parseEditableTime) so no
// separate "trigger vs typed" format exists for time.
const formatTriggerTime = (d: Date): string =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

// --- MANUAL-ENTRY PARSING ---
// Lets someone type a date/time directly instead of only picking from the
// popover.
//
// The field order is a fixed MM/DD/YYYY (US convention) by product
// requirement — not derived from the browser/OS locale. This is
// intentional: with a locale-detected order, the same picker would show
// "DD/MM/YYYY" to one visitor and "MM/DD/YYYY" to another, and — worse —
// the typed format and the resting (post-blur/post-calendar-pick) display
// format could disagree with each other. Both the placeholder hint and
// the resting trigger text (see formatTriggerDate/formatEditableDate
// below) now follow this same single, fixed order, so the field reads
// identically no matter how the date was entered or who is looking at it.
const DATE_FIELD_ORDER: Array<'day' | 'month' | 'year'> = ['month', 'day', 'year'];
const DATE_FORMAT_HINT = 'MM/DD/YYYY';

// Editable/typed representation of a date, in the locale's own field order.
const formatEditableDate = (d: Date): string => {
  const parts: Record<'day' | 'month' | 'year', string> = {
    day: String(d.getDate()).padStart(2, '0'),
    month: String(d.getMonth() + 1).padStart(2, '0'),
    year: String(d.getFullYear()),
  };
  return DATE_FIELD_ORDER.map((k) => parts[k]).join('/');
};

const parseEditableDate = (raw: string): Date | null => {
  const m = raw.trim().match(/^(\d{1,4})[\/\-.](\d{1,4})[\/\-.](\d{1,4})$/);
  if (!m) return null;
  const rawParts = [m[1], m[2], m[3]];
  const values: Record<'day' | 'month' | 'year', number> = { day: 0, month: 0, year: 0 };
  DATE_FIELD_ORDER.forEach((key, i) => { values[key] = parseInt(rawParts[i], 10); });
  let { day, month, year } = values;
  const yearStr = rawParts[DATE_FIELD_ORDER.indexOf('year')];
  if (yearStr.length <= 2) year = year <= 50 ? 2000 + year : 1900 + year;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  // Guards against JS's date rollover (e.g. Feb 30 -> Mar 2), which would
  // otherwise silently "accept" an invalid typed date.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
};

// Typed time is unambiguous by construction: with an AM/PM suffix it's read
// as 12-hour (1-12), without one it's read as 24-hour (0-23) — so "3:45 PM"
// and "15:45" both work and never conflict.
const parseEditableTime = (raw: string): { hour24: number; minute: number } | null => {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (minute < 0 || minute > 59) return null;
  const period = m[3]?.toUpperCase();
  if (period) {
    if (hour < 1 || hour > 12) return null;
    return { hour24: period === 'PM' ? (hour % 12) + 12 : hour % 12, minute };
  }
  if (hour < 0 || hour > 23) return null;
  return { hour24: hour, minute };
};

const to12Hour = (hour24: number): { hour12: number; period: 'AM' | 'PM' } => {
  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, period };
};

const to24Hour = (hour12: number, period: 'AM' | 'PM'): number => {
  const base = hour12 % 12;
  return period === 'PM' ? base + 12 : base;
};

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i); // 0..59

// --- TIME SELECT FIELD ---
// The earlier custom scroll-wheel picker (mouse-wheel/trackpad/touch
// gesture handling, settle timers, rAF animation) has been removed. In its
// place: a plain, native <select> per field (hour / minute / AM-PM).
//
// Why a native select instead of another custom control: it is the most
// reliably accessible, truly "works everywhere" way to offer "pick one of
// a short fixed list of values." It's keyboard-operable and
// screen-reader-friendly with zero extra ARIA wiring (no role="listbox"
// choreography needed), and — critically for "every screen size" — each
// platform renders it with its own native picker UI: a large, touch-sized
// wheel/sheet on iOS, a similar big-target list on Android, a standard
// dropdown on desktop. That native UI is already tuned by the platform for
// its own input method, so there's no gesture code left here to get wrong
// on any given device. The visible closed-state control below is
// restyled to match the app's design system; the open list itself is left
// to the OS/browser, exactly like the date fields already leave native
// text-cursor behavior to the browser.
function TimeSelectField<T extends string | number>({
  value, onChange, options, format, ariaLabel, disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: T[];
  format: (v: T) => string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        disabled={disabled}
        value={String(value)}
        onChange={(e) => {
          const match = options.find((opt) => String(opt) === e.target.value);
          if (match !== undefined) onChange(match);
        }}
        className="w-full appearance-none rounded-lg border border-neutral-200/70 dark:border-neutral-700/50 bg-neutral-50 dark:bg-neutral-900/40 text-neutral-700 dark:text-neutral-200 text-sm font-bold tabular-nums text-center py-2.5 pl-2 pr-6 cursor-pointer transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700/60 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-neutral-50 dark:disabled:hover:bg-neutral-900/40"
      >
        {options.map((opt) => (
          <option key={String(opt)} value={String(opt)}>
            {format(opt)}
          </option>
        ))}
      </select>
      <SafeIcon
        icon={FiChevronDown}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500"
      />
    </div>
  );
}

// --- MAIN COMPONENT ---

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value, onChange, includeTime = false,
  timeUnknown, onTimeUnknownChange, timeUnknownLabel = "Don't know the exact time? Leave this field empty — it'll default to midnight.",
  minDate, maxDate,
  placeholder = 'Select a date', ariaLabel, id, error = false, disabled = false,
  dateLabel = 'Date', timeLabel = 'Time',
}) => {
  const prefersReducedMotion = useReducedMotion();
  // Which field's popover is open, if any. Date and time are now two
  // separate trigger buttons (rendered side-by-side in one row) instead of
  // a single combined trigger, so only one of their panels can be open at
  // a time.
  const [openPanel, setOpenPanel] = useState<'date' | 'time' | null>(null);
  const open = openPanel !== null;
  const [view, setView] = useState<CalendarView>('days');
  const [viewDate, setViewDate] = useState<Date>(() => stripTime(value ?? clampToRange(new Date(), minDate, maxDate)));
  const [decadeStart, setDecadeStart] = useState<number>(() => Math.floor((value ?? new Date()).getFullYear() / 12) * 12);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerDateRef = useRef<HTMLInputElement | null>(null);
  const triggerTimeRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Manual-entry text state for the two fields. Each field shows this raw,
  // editable text while focused, and a formatted read-only-looking string
  // (still a real input) once blurred — see formatEditableDate/Time above.
  // dateError/timeError surface *why* a typed value didn't take, instead of
  // silently discarding it (which is what made typing look broken before).
  const [dateFocused, setDateFocused] = useState(false);
  const [dateInputText, setDateInputText] = useState('');
  const [dateError, setDateError] = useState<'format' | 'range' | null>(null);
  const [timeFocused, setTimeFocused] = useState(false);
  const [timeInputText, setTimeInputText] = useState('');
  const [timeError, setTimeError] = useState<'format' | null>(null);

  const DATE_PANEL_WIDTH = 296;
  const TIME_PANEL_WIDTH = 264;
  const PANEL_WIDTH = openPanel === 'time' ? TIME_PANEL_WIDTH : DATE_PANEL_WIDTH;
  const VIEWPORT_MARGIN = 8;
  const GAP_BELOW_TRIGGER = 8;

  function clampToRange(d: Date, min?: Date, max?: Date): Date {
    if (min && isBeforeDay(d, min)) return stripTime(min);
    if (max && isAfterDay(d, max)) return stripTime(max);
    return d;
  }

  const updatePosition = useCallback(() => {
    const btn = openPanel === 'time' ? triggerTimeRef.current : triggerDateRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = PANEL_WIDTH;
    let left = rect.left;
    left = Math.min(Math.max(left, VIEWPORT_MARGIN), window.innerWidth - width - VIEWPORT_MARGIN);

    const panelHeight = panelRef.current?.getBoundingClientRect().height ?? 420;
    let top = rect.bottom + GAP_BELOW_TRIGGER;
    // Flip above the trigger if there isn't room below.
    if (top + panelHeight > window.innerHeight - VIEWPORT_MARGIN && rect.top - panelHeight - GAP_BELOW_TRIGGER > VIEWPORT_MARGIN) {
      top = rect.top - panelHeight - GAP_BELOW_TRIGGER;
    }
    setCoords({ top, left, width });
  }, [PANEL_WIDTH, openPanel]);

  useLayoutEffect(() => {
    if (openPanel !== 'date') return;
    setView('days');
    setViewDate(stripTime(value ?? clampToRange(new Date(), minDate, maxDate)));
    setDecadeStart(Math.floor((value ?? new Date()).getFullYear() / 12) * 12);
    updatePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPanel]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, view, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current && !wrapperRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setOpenPanel(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenPanel(null);
    };
    const handleReposition = () => updatePosition();
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [open, updatePosition]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const dayGrid = useMemo(() => buildDayGrid(year, month), [year, month]);

  // The time field no longer waits on a date to exist — someone can set a
  // time first. When that happens there's no real Date yet to carry the
  // hour/minute onto, so we implicitly anchor it to today (midnight),
  // exactly like selectDay() below already does in reverse (carrying an
  // already-set time onto whatever day gets picked later).
  const effectiveDateForTime = value ?? stripTime(new Date());

  const selectDay = (d: Date) => {
    if (!isDayInRange(d, minDate, maxDate)) return;
    const next = new Date(d);
    if (includeTime && value) {
      next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    } else {
      next.setHours(0, 0, 0, 0);
    }
    onChange(next);
    // Time now lives in its own field, so the date popover always closes
    // once a day is picked (previously stayed open when includeTime so the
    // time wheels — then inside the same panel — remained reachable).
    setOpenPanel(null);
  };

  const setHour12 = (h: number) => {
    const { period } = to12Hour(effectiveDateForTime.getHours());
    const next = new Date(effectiveDateForTime);
    next.setHours(to24Hour(h, period), effectiveDateForTime.getMinutes(), 0, 0);
    onChange(next);
    onTimeUnknownChange?.(false);
  };

  const setMinute = (m: number) => {
    const next = new Date(effectiveDateForTime);
    next.setMinutes(m, 0, 0);
    onChange(next);
    onTimeUnknownChange?.(false);
  };

  const setPeriod = (p: 'AM' | 'PM') => {
    const { hour12 } = to12Hour(effectiveDateForTime.getHours());
    const next = new Date(effectiveDateForTime);
    next.setHours(to24Hour(hour12, p), effectiveDateForTime.getMinutes(), 0, 0);
    onChange(next);
    onTimeUnknownChange?.(false);
  };

  // Resets the time-of-day back to midnight and marks it unknown again —
  // the explicit one-click equivalent of manually deleting everything in
  // the time field. Lives in the panel footer, mirroring the date panel's
  // own Clear button.
  const clearTime = () => {
    if (!value) return;
    const next = new Date(value);
    next.setHours(0, 0, 0, 0);
    onChange(next);
    onTimeUnknownChange?.(true);
    setTimeInputText('');
    setTimeError(null);
  };

  // Commits whatever the person typed into the date field. Empty text
  // clears the value; unparsable or out-of-range text is now surfaced as a
  // visible error instead of being silently discarded.
  const commitDateText = () => {
    const text = dateInputText.trim();
    if (text === '') {
      onChange(null);
      setDateError(null);
    } else {
      const parsed = parseEditableDate(text);
      if (!parsed) {
        setDateError('format');
      } else if (!isDayInRange(parsed, minDate, maxDate)) {
        setDateError('range');
      } else {
        const next = new Date(parsed);
        if (includeTime && value) {
          next.setHours(value.getHours(), value.getMinutes(), 0, 0);
        } else {
          next.setHours(0, 0, 0, 0);
        }
        onChange(next);
        setViewDate(stripTime(next));
        setDateError(null);
      }
    }
    setDateFocused(false);
  };

  // Commits typed time text ("3:45 PM" or "15:45"). Works even if no date
  // has been picked yet — in that case the committed value is implicitly
  // anchored to today (see effectiveDateForTime above), the same way
  // picking a date after a time was already typed carries that time
  // over (selectDay). Emptying the field and blurring is how a person
  // marks the time "unknown" again — there's no separate checkbox for
  // that anymore, so this is the only path back to the unknown state
  // besides the panel's own Clear button, and it only applies once a
  // value actually exists (nothing to blank out otherwise).
  const commitTimeText = () => {
    const text = timeInputText.trim();
    if (text === '') {
      if (value && !timeUnknown) {
        const next = new Date(value);
        next.setHours(0, 0, 0, 0);
        onChange(next);
        onTimeUnknownChange?.(true);
      }
      setTimeError(null);
    } else {
      const parsed = parseEditableTime(text);
      if (!parsed) {
        setTimeError('format');
      } else {
        const next = new Date(effectiveDateForTime);
        next.setHours(parsed.hour24, parsed.minute, 0, 0);
        onChange(next);
        onTimeUnknownChange?.(false);
        setTimeError(null);
      }
    }
    setTimeFocused(false);
  };


  const goMonth = (delta: number) => setViewDate(new Date(year, month + delta, 1));
  const goYear = (delta: number) => setViewDate(new Date(year + delta, month, 1));
  const goDecade = (delta: number) => setDecadeStart((d) => d + delta * 12);

  const monthDisabled = (m: number, y: number) => {
    if (minDate && (y < minDate.getFullYear() || (y === minDate.getFullYear() && m < minDate.getMonth()))) return true;
    if (maxDate && (y > maxDate.getFullYear() || (y === maxDate.getFullYear() && m > maxDate.getMonth()))) return true;
    return false;
  };
  const yearDisabled = (y: number) => {
    if (minDate && y < minDate.getFullYear()) return true;
    if (maxDate && y > maxDate.getFullYear()) return true;
    return false;
  };

  // Displayed value: raw typed text while focused (or after a failed
  // parse, so the person can see and fix what they typed), formatted text
  // once blurred with a valid value.
  const dateDisplayValue = (dateFocused || dateError) ? dateInputText : (value ? formatTriggerDate(value) : '');
  const timeDisplayValue = (timeFocused || timeError)
    ? timeInputText
    : !value
      ? ''
      : timeUnknown
        ? ''
        : formatTriggerTime(value);
  const datePlaceholder = dateFocused && !dateInputText ? DATE_FORMAT_HINT : placeholder;
  const timePlaceholder = 'h:mm AM/PM';

  const { hour12: selHour12, period: selPeriod } = value ? to12Hour(value.getHours()) : { hour12: 12, period: 'AM' as const };
  const selMinute = value ? value.getMinutes() : 0;

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Date and time are two separate, directly-typable fields shown
          side-by-side in one row (time only when includeTime is set),
          each with its own icon, caption, and picker popover. */}
      <div className="flex items-stretch gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {dateLabel}
          </span>
          <div className={`flex items-stretch w-full rounded-xl border shadow-sm overflow-hidden transition-colors duration-150 bg-neutral-50 dark:bg-neutral-900/40 ${
            error || dateError
              ? 'border-red-300 dark:border-red-500/60'
              : dateFocused || openPanel === 'date'
                ? 'border-indigo-300 dark:border-indigo-500/60 ring-2 ring-indigo-400/50'
                : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
          }`}>
            <div className="relative flex-1 min-w-0">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <SafeIcon icon={FiCalendar} className="w-4 h-4 flex-shrink-0 text-neutral-400 dark:text-neutral-500" />
            </span>
            <input
              id={id}
              ref={triggerDateRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              disabled={disabled}
              aria-haspopup="dialog"
              aria-expanded={openPanel === 'date'}
              aria-label={ariaLabel}
              aria-invalid={Boolean(dateError)}
              value={dateDisplayValue}
              placeholder={datePlaceholder}
              onFocus={() => {
                // Typing is fully independent of the calendar popover —
                // focusing/clicking into the field just readies it for
                // manual entry. But if the popover happens to be open
                // (from either icon), clicking straight into the field
                // closes it first, per product request.
                if (openPanel !== null) setOpenPanel(null);
                if (!dateError) setDateInputText(value ? formatEditableDate(value) : '');
                setDateFocused(true);
              }}
              onChange={(e) => {
                // Auto-insert the "/" separators as the person types digits
                // (credit-card-expiry style), so MM/DD/YYYY is produced
                // without anyone needing to type a literal "/" — which a
                // numeric mobile keyboard can't produce in the first place.
                // Only applied on forward typing (value got longer); a
                // backspace/delete is left completely alone so removing
                // characters behaves exactly as expected, including
                // deleting an auto-inserted slash itself.
                let v = e.target.value.replace(/[^\d/]/g, '');
                if (v.length > dateInputText.length) {
                  const digits = v.replace(/\//g, '');
                  if ((digits.length === 2 || digits.length === 4) && !v.endsWith('/')) {
                    v = `${v}/`;
                  }
                }
                setDateInputText(v);
                if (dateError) setDateError(null);
              }}
              onBlur={commitDateText}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className={`w-full bg-transparent pl-10 pr-3 py-3 font-semibold text-left focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                value && !dateError ? 'text-neutral-900 dark:text-white' : 'text-neutral-400 dark:text-neutral-500 font-medium'
              }`}
            />
            </div>
            <button
              type="button"
              disabled={disabled}
              aria-haspopup="dialog"
              aria-expanded={openPanel === 'date'}
              aria-label={ariaLabel ? `Open calendar for ${ariaLabel}` : 'Open calendar'}
              onClick={() => {
                // Second click on the same icon toggles the popover shut;
                // clicking it while the *other* field's popover is open
                // switches straight to this one instead of requiring two
                // clicks.
                if (openPanel === 'date') {
                  setOpenPanel(null);
                } else {
                  if (!dateError) setDateInputText(value ? formatEditableDate(value) : '');
                  setOpenPanel('date');
                }
              }}
              className={`flex-shrink-0 w-11 flex items-center justify-center border-l transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                openPanel === 'date'
                  ? 'border-indigo-200 dark:border-indigo-500/40 bg-indigo-50/60 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                  : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100/60 dark:hover:bg-neutral-700/40'
              }`}
            >
              <SafeIcon icon={FiCalendar} className="w-4 h-4" />
            </button>
          </div>
          {dateError && (
            <p className="text-[11px] font-semibold text-red-500 mt-1">
              {dateError === 'format'
                ? `Couldn't read that date — try ${DATE_FORMAT_HINT}`
                : "That date is outside the allowed range"}
            </p>
          )}
        </div>

        {includeTime && (
          <div className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              {timeLabel} <span className="text-neutral-400 dark:text-neutral-500 font-normal">*</span>
            </span>
            <div className={`flex items-stretch w-full rounded-xl border shadow-sm overflow-hidden transition-colors duration-150 bg-neutral-50 dark:bg-neutral-900/40 ${
              timeError
                ? 'border-red-300 dark:border-red-500/60'
                : timeFocused || openPanel === 'time'
                  ? 'border-indigo-300 dark:border-indigo-500/60 ring-2 ring-indigo-400/50'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
            }`}>
            <div className="relative flex-1 min-w-0">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <SafeIcon icon={FiClock} className="w-4 h-4 flex-shrink-0 text-neutral-400 dark:text-neutral-500" />
              </span>
              <input
                ref={triggerTimeRef}
                type="text"
                autoComplete="off"
                disabled={disabled}
                aria-haspopup="dialog"
                aria-expanded={openPanel === 'time'}
                aria-label={ariaLabel ? `${ariaLabel} — time` : 'Time'}
                aria-invalid={Boolean(timeError)}
                value={timeDisplayValue}
                placeholder={timePlaceholder}
                onFocus={() => {
                  // Same change as the date field: focusing only readies
                  // the field for typing, and closes an already-open
                  // popover (from either icon) rather than leaving it
                  // hanging open behind the field.
                  if (openPanel !== null) setOpenPanel(null);
                  if (!timeError) setTimeInputText(value && !timeUnknown ? formatTriggerTime(value) : '');
                  setTimeFocused(true);
                }}
                onChange={(e) => {
                  // Mirrors the date field: auto-insert the ":" after the
                  // hour as the person types, so "230p" becomes "2:30p" on
                  // its own. A lone "1" is left alone (it could still
                  // become 10/11/12), but "2"-"9" complete the hour by
                  // themselves and get the colon right away — the same
                  // rule iOS/Android native time pickers use. Backspacing
                  // is left untouched, same as the date field.
                  let v = e.target.value.replace(/[^\d:apmAPM\s]/gi, '');
                  if (v.length > timeInputText.length && !v.includes(':')) {
                    const digits = v.replace(/\D/g, '');
                    const hourComplete = digits.length === 2 || (digits.length === 1 && parseInt(digits, 10) > 1);
                    if (hourComplete) v = `${digits}:`;
                  }
                  setTimeInputText(v);
                  if (timeError) setTimeError(null);
                }}
                onBlur={commitTimeText}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className={`w-full bg-transparent pl-10 pr-3 py-3 font-semibold text-left focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                  value && !timeUnknown && !timeError ? 'text-neutral-900 dark:text-white' : 'text-neutral-400 dark:text-neutral-500 font-medium'
                }`}
              />
            </div>
            <button
              type="button"
              disabled={disabled}
              aria-haspopup="dialog"
              aria-expanded={openPanel === 'time'}
              aria-label={ariaLabel ? `Open time picker for ${ariaLabel}` : 'Open time picker'}
              onClick={() => {
                // Second click toggles it shut; clicking it while the date
                // popover is open switches straight to this one instead.
                if (openPanel === 'time') {
                  setOpenPanel(null);
                } else {
                  if (!timeError) setTimeInputText(value && !timeUnknown ? formatTriggerTime(value) : '');
                  setOpenPanel('time');
                }
              }}
              className={`flex-shrink-0 w-11 flex items-center justify-center border-l transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                openPanel === 'time'
                  ? 'border-indigo-200 dark:border-indigo-500/40 bg-indigo-50/60 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                  : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100/60 dark:hover:bg-neutral-700/40'
              }`}
            >
              <SafeIcon icon={FiClock} className="w-4 h-4" />
            </button>
            </div>
            {timeError && (
              <p className="text-[11px] font-semibold text-red-500 mt-1">
                Couldn't read that time — try h:mm AM/PM
              </p>
            )}
          </div>
        )}

      </div>

      {open && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label={openPanel === 'time' ? 'Choose a time' : 'Choose a date'}
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.15, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              width: coords?.width ?? PANEL_WIDTH,
              visibility: coords ? 'visible' : 'hidden',
            }}
            className="z-[100] rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl overflow-hidden"
          >
            {openPanel === 'date' && (
              <>
                {/* CALENDAR HEADER */}
                <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
                  <button
                    type="button"
                    onClick={() => (view === 'days' ? goMonth(-1) : view === 'months' ? goYear(-1) : goDecade(-1))}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-colors cursor-pointer"
                    aria-label="Previous"
                  >
                    <SafeIcon icon={FiChevronLeft} className="w-4 h-4" />
                  </button>

                  {view === 'days' && (
                    <button
                      type="button"
                      onClick={() => setView('months')}
                      className="flex-1 text-center text-sm font-extrabold text-neutral-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                    >
                      {MONTH_LABELS[month]} {year}
                    </button>
                  )}
                  {view === 'months' && (
                    <button
                      type="button"
                      onClick={() => setView('years')}
                      className="flex-1 text-center text-sm font-extrabold text-neutral-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                    >
                      {year}
                    </button>
                  )}
                  {view === 'years' && (
                    <span className="flex-1 text-center text-sm font-extrabold text-neutral-900 dark:text-white">
                      {decadeStart}–{decadeStart + 11}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => (view === 'days' ? goMonth(1) : view === 'months' ? goYear(1) : goDecade(1))}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-colors cursor-pointer"
                    aria-label="Next"
                  >
                    <SafeIcon icon={FiChevronRight} className="w-4 h-4" />
                  </button>
                </div>

                {/* DAYS VIEW */}
                {view === 'days' && (
                  <div className="px-3 pb-3">
                    <div className="grid grid-cols-7 gap-1 mb-1">
                      {WEEKDAY_SHORT.map((w) => (
                        <div key={w} className="text-center text-[10px] font-bold uppercase tracking-wide text-neutral-400 dark:text-neutral-500 py-1">
                          {w}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {dayGrid.map((d) => {
                        const inMonth = d.getMonth() === month;
                        const selected = value ? isSameDay(d, value) : false;
                        const isToday = isSameDay(d, new Date());
                        const disabledDay = !isDayInRange(d, minDate, maxDate);
                        return (
                          <button
                            key={d.toISOString()}
                            type="button"
                            disabled={disabledDay}
                            onClick={() => selectDay(d)}
                            className={`aspect-square rounded-lg text-[13px] font-semibold tabular-nums transition-colors duration-100 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                              selected
                                ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-600'
                                : inMonth
                                  ? `text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 ${isToday ? 'ring-1 ring-indigo-300 dark:ring-indigo-600' : ''}`
                                  : 'text-neutral-300 dark:text-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
                            }`}
                          >
                            {d.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* MONTHS VIEW */}
                {view === 'months' && (
                  <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
                    {MONTH_SHORT.map((m, i) => {
                      const dis = monthDisabled(i, year);
                      const active = i === month;
                      return (
                        <button
                          key={m}
                          type="button"
                          disabled={dis}
                          onClick={() => { setViewDate(new Date(year, i, 1)); setView('days'); }}
                          className={`rounded-lg py-2.5 text-sm font-bold transition-colors duration-100 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                            active ? 'bg-indigo-600 text-white' : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/60'
                          }`}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* YEARS VIEW */}
                {view === 'years' && (
                  <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
                    {Array.from({ length: 12 }, (_, i) => decadeStart + i).map((y) => {
                      const dis = yearDisabled(y);
                      const active = y === year;
                      return (
                        <button
                          key={y}
                          type="button"
                          disabled={dis}
                          onClick={() => { setViewDate(new Date(y, month, 1)); setView('months'); }}
                          className={`rounded-lg py-2.5 text-sm font-bold tabular-nums transition-colors duration-100 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                            active ? 'bg-indigo-600 text-white' : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/60'
                          }`}
                        >
                          {y}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* FOOTER (date panel) */}
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-neutral-100 dark:border-neutral-700/60 bg-neutral-50/60 dark:bg-neutral-900/30">
                  <button
                    type="button"
                    onClick={() => { onChange(null); setOpenPanel(null); }}
                    className="text-xs font-bold text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <SafeIcon icon={FiX} className="w-3 h-3" />
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenPanel(null)}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </>
            )}

            {/* TIME PANEL */}
            {openPanel === 'time' && (
              <>
                <div className="px-3 pt-3 pb-3">
                  {/* Wheels are always usable now, even with no date set
                      yet — selHour12/selMinute/selPeriod already fall
                      back to a 12:00 AM display in that case, matching
                      effectiveDateForTime's implicit midnight-today
                      anchor above, so there's nothing to special-case
                      here. */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mb-1 text-center">
                        Hour
                      </span>
                      <TimeSelectField
                        options={HOUR_OPTIONS}
                        value={selHour12}
                        onChange={setHour12}
                        format={(h) => String(h)}
                        ariaLabel="Hour"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mb-1 text-center">
                        Minute
                      </span>
                      <TimeSelectField
                        options={MINUTE_OPTIONS}
                        value={selMinute}
                        onChange={setMinute}
                        format={(m) => String(m).padStart(2, '0')}
                        ariaLabel="Minute"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mb-1 text-center">
                        AM/PM
                      </span>
                      <TimeSelectField
                        options={['AM', 'PM'] as const}
                        value={selPeriod}
                        onChange={setPeriod}
                        format={(p) => p}
                        ariaLabel="AM or PM"
                      />
                    </div>
                  </div>

                  {/* Static info line, not a control — replaces the old
                      "I don't know the exact time" checkbox. The field
                      itself now carries that meaning: an empty time field
                      *is* "unknown," so there's nothing to toggle. This
                      just tells the person that leaving it blank is fine.
                      Shown unconditionally now that the panel itself no
                      longer requires a date first. */}
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-3 leading-relaxed">
                    {timeUnknownLabel}
                  </p>
                </div>

                {/* FOOTER (time panel) */}
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-neutral-100 dark:border-neutral-700/60 bg-neutral-50/60 dark:bg-neutral-900/30">
                  <button
                    type="button"
                    onClick={clearTime}
                    disabled={!value || timeUnknown}
                    className="text-xs font-bold text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors cursor-pointer inline-flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-neutral-400 dark:disabled:hover:text-neutral-500"
                  >
                    <SafeIcon icon={FiX} className="w-3 h-3" />
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenPanel(null)}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default DateTimePicker;
