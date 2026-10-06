import { dirname, resolve } from 'path';
import {
  absoluteDir,
  absoluteFile,
  err,
  jobName,
  nonEmptyString,
  ok,
  type Job,
  type Manifest,
  type ManifestId,
  type PathKind,
  type Result,
  type Schedule,
} from './domain';
import { parseSchedule, ScheduleParseError } from './schedule';

export type ValidationError = {
  /** Job name as written in the manifest, when the error belongs to a job. */
  job?: string;
  field?: string;
  message: string;
};

/** Facts the I/O layer gathered so that parsing itself stays pure. */
export type ParseContext = {
  home: string;
  pathKind: (absolutePath: string) => PathKind;
};

const JOB_FIELDS = ['schedule', 'prompt', 'cwd', 'mcpConfig'] as const;

/**
 * Turn the raw JSON of a ccron.json into a validated Manifest.
 *
 * Every problem is collected instead of stopping at the first one, so a single
 * run shows everything that needs fixing. Relative paths are resolved against
 * the directory of the manifest's real location.
 */
export function parseManifest(
  raw: unknown,
  id: ManifestId,
  ctx: ParseContext,
): Result<Manifest, ValidationError[]> {
  if (!isRecord(raw)) return err([{ message: 'manifest must be an object' }]);

  const errors: ValidationError[] = [];
  for (const key of Object.keys(raw)) {
    if (key !== 'jobs') errors.push({ message: `unknown key "${key}"` });
  }

  const rawJobs = raw['jobs'];
  if (!isRecord(rawJobs)) {
    errors.push({ field: 'jobs', message: '"jobs" must be an object' });
    return err(errors);
  }

  const baseDir = dirname(id);
  const jobs: Job[] = [];
  for (const [name, rawJob] of Object.entries(rawJobs)) {
    const result = parseJob(name, rawJob, baseDir, ctx);
    if (result.ok) jobs.push(result.value);
    else errors.push(...result.error);
  }

  if (errors.length > 0) return err(errors);
  return ok({ id, jobs });
}

function parseJob(
  rawName: string,
  raw: unknown,
  baseDir: string,
  ctx: ParseContext,
): Result<Job, ValidationError[]> {
  const errors: ValidationError[] = [];
  const fail = (field: string | undefined, message: string) =>
    errors.push({
      job: rawName,
      ...(field === undefined ? {} : { field }),
      message,
    });

  const name = jobName(rawName);
  if (!name.ok) fail(undefined, name.error);

  if (!isRecord(raw)) {
    fail(undefined, 'job must be an object');
    return err(errors);
  }

  for (const key of Object.keys(raw)) {
    if (!(JOB_FIELDS as readonly string[]).includes(key))
      fail(key, `unknown key "${key}"`);
  }

  const schedule = field(raw, 'schedule', fail, parseScheduleField);
  const prompt = field(raw, 'prompt', fail, nonEmptyString);
  const cwd = field(raw, 'cwd', fail, input => {
    const path = resolve(baseDir, input);
    const dir = absoluteDir(path, ctx.pathKind(path));
    if (!dir.ok) return dir;
    if (isTccProtected(path, ctx.home))
      return err(
        `${path} is under a TCC-protected directory (~/Desktop, ~/Documents, ~/Downloads); claude cannot read it from launchd`,
      );
    return dir;
  });
  const mcpConfig =
    raw['mcpConfig'] === undefined
      ? undefined
      : field(raw, 'mcpConfig', fail, input => {
          const path = resolve(baseDir, input);
          return absoluteFile(path, ctx.pathKind(path));
        });

  if (
    errors.length > 0 ||
    !name.ok ||
    schedule === undefined ||
    prompt === undefined ||
    cwd === undefined
  )
    return err(errors);

  return ok({
    name: name.value,
    schedule,
    prompt,
    cwd,
    ...(mcpConfig === undefined ? {} : { mcpConfig }),
  });
}

/** Read a required string field and run it through a constructor. */
function field<T>(
  raw: Record<string, unknown>,
  key: string,
  fail: (field: string, message: string) => void,
  construct: (input: string) => Result<T, string>,
): T | undefined {
  const value = raw[key];
  if (value === undefined) {
    fail(key, 'is required');
    return undefined;
  }
  if (typeof value !== 'string') {
    fail(key, 'must be a string');
    return undefined;
  }
  const result = construct(value);
  if (!result.ok) {
    fail(key, result.error);
    return undefined;
  }
  return result.value;
}

function parseScheduleField(input: string): Result<Schedule, string> {
  try {
    return ok({ expression: input, intervals: parseSchedule(input) });
  } catch (e) {
    if (e instanceof ScheduleParseError) return err(e.message);
    throw e;
  }
}

const TCC_DIRS = ['Desktop', 'Documents', 'Downloads'];

// Granting Full Disk Access to /bin/bash is not enough: the claude process gets
// its own TCC identity and still fails with EPERM on these paths.
function isTccProtected(path: string, home: string): boolean {
  return TCC_DIRS.some(dir => {
    const protectedDir = `${home}/${dir}`;
    return path === protectedDir || path.startsWith(`${protectedDir}/`);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
