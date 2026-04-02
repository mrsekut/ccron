export type CalendarInterval = {
  Hour: number;
  Minute: number;
  Weekday?: number; // 0=Sun, 1=Mon, ..., 6=Sat (launchd convention)
};

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri

/**
 * Parse a schedule string into launchd StartCalendarInterval entries.
 *
 * Supported formats:
 *   "HH:MM daily"           → every day at HH:MM
 *   "HH:MM weekdays"        → Mon-Fri at HH:MM
 *   "HH:MM fri"             → every Friday at HH:MM
 *   "HH:MM mon,wed,fri"     → specific days at HH:MM
 *   "M H * * D"             → cron expression (minute hour * * day-of-week)
 */
export function parseSchedule(input: string): CalendarInterval[] {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ScheduleParseError("Schedule string is empty");
  }

  // Try cron format first (5 fields separated by spaces)
  if (isCronExpression(trimmed)) {
    return parseCron(trimmed);
  }

  return parseHumanReadable(trimmed);
}

function isCronExpression(input: string): boolean {
  // Cron has exactly 5 space-separated fields, and doesn't start with HH:MM
  const parts = input.split(/\s+/);
  return parts.length === 5 && !parts[0]!.includes(":");
}

function parseHumanReadable(input: string): CalendarInterval[] {
  const parts = input.split(/\s+/);
  if (parts.length < 2) {
    throw new ScheduleParseError(
      `Invalid schedule format: "${input}". Expected "HH:MM <when>" (e.g. "17:15 weekdays")`,
    );
  }

  const [timePart, ...rest] = parts;
  const { hour, minute } = parseTime(timePart!);
  const when = rest.join(",").toLowerCase();

  if (when === "daily") {
    return [{ Hour: hour, Minute: minute }];
  }

  if (when === "weekdays") {
    return WEEKDAYS.map((day) => ({ Hour: hour, Minute: minute, Weekday: day }));
  }

  // Single or comma-separated day names: "fri", "mon,wed,fri"
  const dayNames = when.split(",").map((d) => d.trim());
  const weekdays = dayNames.map((name) => {
    const day = WEEKDAY_MAP[name];
    if (day === undefined) {
      throw new ScheduleParseError(
        `Unknown day name: "${name}". Valid names: ${Object.keys(WEEKDAY_MAP).join(", ")}`,
      );
    }
    return day;
  });

  return weekdays.map((day) => ({ Hour: hour, Minute: minute, Weekday: day }));
}

function parseCron(input: string): CalendarInterval[] {
  const fields = input.split(/\s+/);
  const minuteField = fields[0]!;
  const hourField = fields[1]!;
  const dayOfMonth = fields[2]!;
  const month = fields[3]!;
  const dayOfWeek = fields[4]!;

  // Reject unsupported patterns
  if (dayOfMonth !== "*" || month !== "*") {
    throw new ScheduleParseError(
      `Day-of-month and month fields must be "*". ` +
        `launchd StartCalendarInterval only supports hour/minute/weekday scheduling.`,
    );
  }

  if (minuteField.includes("/") || hourField.includes("/")) {
    throw new ScheduleParseError(
      `Step values (e.g. "*/5") are not supported. ` +
        `launchd StartCalendarInterval cannot express interval-based schedules. ` +
        `Use a fixed time instead (e.g. "17:15 weekdays").`,
    );
  }

  if (minuteField.includes("-") || hourField.includes("-")) {
    throw new ScheduleParseError(
      `Range values (e.g. "9-17") are not supported. ` +
        `launchd StartCalendarInterval can only express fixed times.`,
    );
  }

  const minute = parseIntStrict(minuteField, "minute", 0, 59);
  const hour = parseIntStrict(hourField, "hour", 0, 23);

  const weekdays = parseCronDayOfWeek(dayOfWeek);

  if (weekdays === null) {
    return [{ Hour: hour, Minute: minute }];
  }

  return weekdays.map((day) => ({ Hour: hour, Minute: minute, Weekday: day }));
}

function parseCronDayOfWeek(field: string): number[] | null {
  if (field === "*") return null;

  const parts = field.split(",");
  const days: number[] = [];

  for (const part of parts) {
    if (part.includes("-")) {
      const segments = part.split("-");
      const start = parseDayValue(segments[0]!);
      const end = parseDayValue(segments[1]!);
      if (start <= end) {
        for (let i = start; i <= end; i++) days.push(i);
      } else {
        // Wrap around: e.g. 5-1 → Fri,Sat,Sun,Mon
        for (let i = start; i <= 6; i++) days.push(i);
        for (let i = 0; i <= end; i++) days.push(i);
      }
    } else {
      days.push(parseDayValue(part));
    }
  }

  return days;
}

function parseDayValue(value: string): number {
  const name = WEEKDAY_MAP[value.toLowerCase()];
  if (name !== undefined) return name;
  return parseIntStrict(value, "day-of-week", 0, 6);
}

function parseTime(time: string): { hour: number; minute: number } {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    throw new ScheduleParseError(
      `Invalid time format: "${time}". Expected HH:MM (e.g. "17:15")`,
    );
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23) {
    throw new ScheduleParseError(`Hour must be 0-23, got ${hour}`);
  }
  if (minute < 0 || minute > 59) {
    throw new ScheduleParseError(`Minute must be 0-59, got ${minute}`);
  }
  return { hour, minute };
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
    this.name = "ScheduleParseError";
  }
}
