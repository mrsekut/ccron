export type CalendarInterval = {
  Hour: number;
  Minute: number;
  Weekday?: number; // 0=Sun, 1=Mon, ..., 6=Sat (launchd convention)
};

/**
 * Parse a cron expression into launchd StartCalendarInterval entries.
 *
 * Format: "minute hour * * day-of-week"
 *
 * Constraints (launchd limitations):
 *   - Day-of-month and month fields must be "*"
 *   - Step values (e.g. *​/5) are not supported
 *   - Range values in minute/hour are not supported
 *
 * Examples:
 *   "15 17 * * *"     → every day at 17:15
 *   "15 17 * * 1-5"   → weekdays at 17:15
 *   "0 22 * * 5"      → every Friday at 22:00
 *   "0 9 * * 1,3,5"   → Mon/Wed/Fri at 9:00
 */
export function parseSchedule(input: string): CalendarInterval[] {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ScheduleParseError('Schedule string is empty');
  }

  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5) {
    throw new ScheduleParseError(
      `Invalid cron expression: "${input}". Expected 5 fields: "minute hour * * day-of-week"`,
    );
  }

  const minuteField = fields[0]!;
  const hourField = fields[1]!;
  const dayOfMonth = fields[2]!;
  const month = fields[3]!;
  const dayOfWeek = fields[4]!;

  if (dayOfMonth !== '*' || month !== '*') {
    throw new ScheduleParseError(
      `Day-of-month and month fields must be "*". ` +
        `launchd StartCalendarInterval only supports hour/minute/weekday scheduling.`,
    );
  }

  if (minuteField.includes('/') || hourField.includes('/')) {
    throw new ScheduleParseError(
      `Step values (e.g. "*/5") are not supported. ` +
        `launchd StartCalendarInterval cannot express interval-based schedules.`,
    );
  }

  if (minuteField.includes('-') || hourField.includes('-')) {
    throw new ScheduleParseError(
      `Range values (e.g. "9-17") in minute/hour are not supported. ` +
        `launchd StartCalendarInterval can only express fixed times.`,
    );
  }

  const minute = parseIntStrict(minuteField, 'minute', 0, 59);
  const hour = parseIntStrict(hourField, 'hour', 0, 23);

  const weekdays = parseDayOfWeek(dayOfWeek);

  if (weekdays === null) {
    return [{ Hour: hour, Minute: minute }];
  }

  return weekdays.map(day => ({ Hour: hour, Minute: minute, Weekday: day }));
}

function parseDayOfWeek(field: string): number[] | null {
  if (field === '*') return null;

  const parts = field.split(',');
  const days: number[] = [];

  for (const part of parts) {
    if (part.includes('-')) {
      const segments = part.split('-');
      const start = parseIntStrict(segments[0]!, 'day-of-week', 0, 6);
      const end = parseIntStrict(segments[1]!, 'day-of-week', 0, 6);
      if (start <= end) {
        for (let i = start; i <= end; i++) days.push(i);
      } else {
        // Wrap around: e.g. 5-1 → Fri,Sat,Sun,Mon
        for (let i = start; i <= 6; i++) days.push(i);
        for (let i = 0; i <= end; i++) days.push(i);
      }
    } else {
      days.push(parseIntStrict(part, 'day-of-week', 0, 6));
    }
  }

  return days;
}

function parseIntStrict(
  value: string,
  name: string,
  min: number,
  max: number,
): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new ScheduleParseError(
      `Invalid ${name}: "${value}". Must be an integer between ${min} and ${max}.`,
    );
  }
  return num;
}

export class ScheduleParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduleParseError';
  }
}
