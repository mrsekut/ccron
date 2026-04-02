import { test, expect, describe } from 'bun:test';
import { parseSchedule, ScheduleParseError } from './schedule';

describe('parseSchedule', () => {
  test('daily at specific time', () => {
    expect(parseSchedule('15 17 * * *')).toEqual([{ Hour: 17, Minute: 15 }]);
  });

  test('midnight', () => {
    expect(parseSchedule('0 0 * * *')).toEqual([{ Hour: 0, Minute: 0 }]);
  });

  test('end of day', () => {
    expect(parseSchedule('59 23 * * *')).toEqual([{ Hour: 23, Minute: 59 }]);
  });

  test('specific weekday', () => {
    expect(parseSchedule('0 22 * * 5')).toEqual([
      { Hour: 22, Minute: 0, Weekday: 5 },
    ]);
  });

  test('weekday range (Mon-Fri)', () => {
    expect(parseSchedule('15 17 * * 1-5')).toEqual([
      { Hour: 17, Minute: 15, Weekday: 1 },
      { Hour: 17, Minute: 15, Weekday: 2 },
      { Hour: 17, Minute: 15, Weekday: 3 },
      { Hour: 17, Minute: 15, Weekday: 4 },
      { Hour: 17, Minute: 15, Weekday: 5 },
    ]);
  });

  test('comma-separated weekdays', () => {
    expect(parseSchedule('0 9 * * 1,3,5')).toEqual([
      { Hour: 9, Minute: 0, Weekday: 1 },
      { Hour: 9, Minute: 0, Weekday: 3 },
      { Hour: 9, Minute: 0, Weekday: 5 },
    ]);
  });

  test('wrap-around range (Fri-Mon)', () => {
    expect(parseSchedule('0 9 * * 5-1')).toEqual([
      { Hour: 9, Minute: 0, Weekday: 5 },
      { Hour: 9, Minute: 0, Weekday: 6 },
      { Hour: 9, Minute: 0, Weekday: 0 },
      { Hour: 9, Minute: 0, Weekday: 1 },
    ]);
  });

  test('sunday as 0', () => {
    expect(parseSchedule('0 10 * * 0')).toEqual([
      { Hour: 10, Minute: 0, Weekday: 0 },
    ]);
  });
});

describe('parseSchedule - errors', () => {
  test('empty string', () => {
    expect(() => parseSchedule('')).toThrow(ScheduleParseError);
  });

  test('not 5 fields', () => {
    expect(() => parseSchedule('15 17 *')).toThrow(ScheduleParseError);
    expect(() => parseSchedule('17:15 weekdays')).toThrow(ScheduleParseError);
  });

  test('invalid hour', () => {
    expect(() => parseSchedule('0 25 * * *')).toThrow(ScheduleParseError);
  });

  test('invalid minute', () => {
    expect(() => parseSchedule('60 9 * * *')).toThrow(ScheduleParseError);
  });

  test('step values not supported', () => {
    expect(() => parseSchedule('*/5 * * * *')).toThrow(ScheduleParseError);
    expect(() => parseSchedule('0 */2 * * *')).toThrow(ScheduleParseError);
  });

  test('day-of-month not supported', () => {
    expect(() => parseSchedule('0 9 15 * *')).toThrow(ScheduleParseError);
  });

  test('month not supported', () => {
    expect(() => parseSchedule('0 9 * 6 *')).toThrow(ScheduleParseError);
  });

  test('range in minute/hour not supported', () => {
    expect(() => parseSchedule('0-30 9 * * *')).toThrow(ScheduleParseError);
    expect(() => parseSchedule('0 9-17 * * *')).toThrow(ScheduleParseError);
  });

  test('invalid day-of-week', () => {
    expect(() => parseSchedule('0 9 * * 7')).toThrow(ScheduleParseError);
  });
});
