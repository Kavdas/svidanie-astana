const ALMATY_TZ = 'Asia/Almaty';
const ALMATY_OFFSET = '+05:00';

export type ReportRange = 'today' | 'week' | 'month';

export function isReportRange(value: unknown): value is ReportRange {
  return value === 'today' || value === 'week' || value === 'month';
}

function todayInAlmaty(now: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ALMATY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function addDaysToDateString(dateString: string, days: number) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Calendar-aligned report windows in Asia/Almaty time (today / this week
 * starting Monday / this month starting the 1st, all "to date").
 *
 * Returns both timestamptz bounds (for columns like created_at) and plain
 * date-string bounds (for date-only columns like expenses.spent_at) — the
 * two must not be mixed, since converting an Almaty midnight to UTC shifts
 * the calendar date.
 */
export function getReportRangeBounds(range: ReportRange) {
  const now = new Date();
  const todayDate = todayInAlmaty(now);
  const tomorrowDate = addDaysToDateString(todayDate, 1);
  const toTimestamp = new Date(`${tomorrowDate}T00:00:00${ALMATY_OFFSET}`);

  let fromDate = todayDate;

  if (range === 'week') {
    const [year, month, day] = todayDate.split('-').map(Number);
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    fromDate = addDaysToDateString(todayDate, -daysSinceMonday);
  } else if (range === 'month') {
    const [year, month] = todayDate.split('-');
    fromDate = `${year}-${month}-01`;
  }

  const fromTimestamp = new Date(`${fromDate}T00:00:00${ALMATY_OFFSET}`);

  return {
    from: fromTimestamp.toISOString(),
    to: toTimestamp.toISOString(),
    fromDate,
    toDate: tomorrowDate,
  };
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export function isValidDayString(value: unknown): value is string {
  return typeof value === 'string' && DAY_PATTERN.test(value);
}

export function isValidMonthString(value: unknown): value is string {
  return typeof value === 'string' && MONTH_PATTERN.test(value);
}

/** One specific calendar day, e.g. "2026-03-14" — for picking an arbitrary
 * day rather than always "today". */
export function getExactDayBounds(day: string) {
  return { fromDate: day, toDate: addDaysToDateString(day, 1) };
}

/**
 * One full calendar month, e.g. "2026-02" — spans the 1st through the last
 * day of *that* month regardless of whether it has 28, 29, 30 or 31 days.
 * Passing the 1-indexed month number straight into Date.UTC's (0-indexed)
 * month slot lands on day 1 of the *next* month, which also rolls over
 * December -> January correctly.
 */
export function getExactMonthBounds(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const fromDate = `${month}-01`;
  const toDate = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);

  return { fromDate, toDate };
}
