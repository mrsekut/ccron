import { test, expect, describe } from "bun:test";
import { parseSchedule, ScheduleParseError } from "./schedule";

describe("parseSchedule - human readable", () => {
  test("daily", () => {
    expect(parseSchedule("9:00 daily")).toEqual([{ Hour: 9, Minute: 0 }]);
  });

  test("daily with leading zero", () => {
    expect(parseSchedule("09:00 daily")).toEqual([{ Hour: 9, Minute: 0 }]);
  });

  test("weekdays", () => {
    const result = parseSchedule("17:15 weekdays");
    expect(result).toEqual([
      { Hour: 17, Minute: 15, Weekday: 1 },
      { Hour: 17, Minute: 15, Weekday: 2 },
      { Hour: 17, Minute: 15, Weekday: 3 },
      { Hour: 17, Minute: 15, Weekday: 4 },
      { Hour: 17, Minute: 15, Weekday: 5 },
    ]);
  });

  test("single day", () => {
    expect(parseSchedule("22:00 fri")).toEqual([
      { Hour: 22, Minute: 0, Weekday: 5 },
    ]);
  });

  test("multiple days", () => {
    expect(parseSchedule("9:00 mon,wed,fri")).toEqual([
      { Hour: 9, Minute: 0, Weekday: 1 },
      { Hour: 9, Minute: 0, Weekday: 3 },
      { Hour: 9, Minute: 0, Weekday: 5 },
    ]);
  });

  test("midnight", () => {
    expect(parseSchedule("0:00 daily")).toEqual([{ Hour: 0, Minute: 0 }]);
  });

  test("end of day", () => {
    expect(parseSchedule("23:59 daily")).toEqual([{ Hour: 23, Minute: 59 }]);
  });
});

describe("parseSchedule - cron format", () => {
  test("daily at specific time", () => {
    expect(parseSchedule("15 17 * * *")).toEqual([{ Hour: 17, Minute: 15 }]);
  });

  test("specific weekday", () => {
    expect(parseSchedule("0 22 * * 5")).toEqual([
      { Hour: 22, Minute: 0, Weekday: 5 },
    ]);
  });

  test("weekday range (Mon-Fri)", () => {
    const result = parseSchedule("15 17 * * 1-5");
    expect(result).toEqual([
      { Hour: 17, Minute: 15, Weekday: 1 },
      { Hour: 17, Minute: 15, Weekday: 2 },
      { Hour: 17, Minute: 15, Weekday: 3 },
      { Hour: 17, Minute: 15, Weekday: 4 },
      { Hour: 17, Minute: 15, Weekday: 5 },
    ]);
  });

  test("comma-separated weekdays", () => {
    expect(parseSchedule("0 9 * * 1,3,5")).toEqual([
      { Hour: 9, Minute: 0, Weekday: 1 },
      { Hour: 9, Minute: 0, Weekday: 3 },
      { Hour: 9, Minute: 0, Weekday: 5 },
    ]);
  });

  test("wrap-around range (Fri-Mon)", () => {
    expect(parseSchedule("0 9 * * 5-1")).toEqual([
      { Hour: 9, Minute: 0, Weekday: 5 },
      { Hour: 9, Minute: 0, Weekday: 6 },
      { Hour: 9, Minute: 0, Weekday: 0 },
      { Hour: 9, Minute: 0, Weekday: 1 },
    ]);
  });
});

describe("parseSchedule - error cases", () => {
  test("empty string", () => {
    expect(() => parseSchedule("")).toThrow(ScheduleParseError);
  });

  test("invalid time format", () => {
    expect(() => parseSchedule("25:00 daily")).toThrow(ScheduleParseError);
    expect(() => parseSchedule("12:60 daily")).toThrow(ScheduleParseError);
    expect(() => parseSchedule("abc daily")).toThrow(ScheduleParseError);
  });

  test("unknown day name", () => {
    expect(() => parseSchedule("9:00 funday")).toThrow(ScheduleParseError);
  });

  test("step values not supported", () => {
    expect(() => parseSchedule("*/5 * * * *")).toThrow(ScheduleParseError);
    expect(() => parseSchedule("0 */2 * * *")).toThrow(ScheduleParseError);
  });

  test("day-of-month not supported", () => {
    expect(() => parseSchedule("0 9 15 * *")).toThrow(ScheduleParseError);
  });

  test("month not supported", () => {
    expect(() => parseSchedule("0 9 * 6 *")).toThrow(ScheduleParseError);
  });

  test("range in hour/minute not supported", () => {
    expect(() => parseSchedule("0-30 9 * * *")).toThrow(ScheduleParseError);
    expect(() => parseSchedule("0 9-17 * * *")).toThrow(ScheduleParseError);
  });

  test("only time without when", () => {
    expect(() => parseSchedule("17:00")).toThrow(ScheduleParseError);
  });
});
