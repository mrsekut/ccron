import { isAbsolute } from 'path';
import type { CalendarInterval } from './schedule';

// --- Result ---

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// --- Constrained values ---
//
// Each branded type can only be obtained through its constructor below, so a
// value of that type is proof that the check has passed.

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** `^[a-z0-9][a-z0-9-]*$`, at most 64 characters. */
export type JobName = Brand<string, 'JobName'>;
export type NonEmptyString = Brand<string, 'NonEmptyString'>;
/** An absolute path that pointed at an existing directory when checked. */
export type AbsoluteDir = Brand<string, 'AbsoluteDir'>;
/** An absolute path that pointed at an existing file when checked. */
export type AbsoluteFile = Brand<string, 'AbsoluteFile'>;
/**
 * A manifest's identity: its path after `realpath`. Comparing raw paths would
 * treat the same file reached through a symlink as a different owner.
 */
export type ManifestId = Brand<string, 'ManifestId'>;

const JOB_NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
const JOB_NAME_MAX = 64;

export function jobName(input: string): Result<JobName, string> {
  if (!input) return err('job name is empty');
  if (input.length > JOB_NAME_MAX)
    return err(`job name must be ${JOB_NAME_MAX} characters or less`);
  if (!JOB_NAME_RE.test(input))
    return err(
      'job name must contain only lowercase letters, numbers, and hyphens, and start with a letter or number',
    );
  return ok(input as JobName);
}

export function nonEmptyString(input: string): Result<NonEmptyString, string> {
  if (input.trim() === '') return err('must not be empty');
  return ok(input as NonEmptyString);
}

/** What the filesystem said about a path. Gathered by the I/O layer. */
export type PathKind = 'directory' | 'file' | 'missing';

export function absoluteDir(
  path: string,
  kind: PathKind,
): Result<AbsoluteDir, string> {
  if (!isAbsolute(path)) return err(`not an absolute path: ${path}`);
  if (kind === 'missing') return err(`directory does not exist: ${path}`);
  if (kind !== 'directory') return err(`not a directory: ${path}`);
  return ok(path as AbsoluteDir);
}

export function absoluteFile(
  path: string,
  kind: PathKind,
): Result<AbsoluteFile, string> {
  if (!isAbsolute(path)) return err(`not an absolute path: ${path}`);
  if (kind === 'missing') return err(`file does not exist: ${path}`);
  if (kind !== 'file') return err(`not a file: ${path}`);
  return ok(path as AbsoluteFile);
}

/** `realpath` must already have been applied by the caller. */
export function manifestId(realpath: string): Result<ManifestId, string> {
  if (!isAbsolute(realpath)) return err(`not an absolute path: ${realpath}`);
  return ok(realpath as ManifestId);
}

// --- Desired state (from the manifest) ---

export type Schedule = {
  expression: string;
  intervals: CalendarInterval[];
};

export type Job = {
  name: JobName;
  schedule: Schedule;
  prompt: NonEmptyString;
  cwd: AbsoluteDir;
  mcpConfig?: AbsoluteFile;
};

export type Manifest = {
  id: ManifestId;
  jobs: Job[];
};

// --- Actual state (read from disk and launchctl) ---

/** Ownership as seen from the manifest being applied. */
export type Owner =
  | { kind: 'mine' }
  | { kind: 'other'; manifest: ManifestId }
  // The recorded manifest no longer exists, so it cannot be a ManifestId.
  | { kind: 'orphan'; manifest: string }
  // No CCRON_MANIFEST: made by hand or by ccron <= 0.3.
  | { kind: 'unowned' };

export type Artifacts =
  | { kind: 'complete'; plist: string; script: string }
  | { kind: 'partial'; plist: string }; // the script is missing

export type ActualJob = {
  name: JobName;
  owner: Owner;
  artifacts: Artifacts;
  loaded: boolean;
};

export type ActualState = ActualJob[];

// --- Plan ---

/** The generated files for a job, exactly as they will be written. */
export type Rendered = { script: string; plist: string };

// Writing actions carry what plan() compared against, so execute() writes
// exactly what was judged to be needed.
export type Action =
  | { kind: 'create'; job: Job; rendered: Rendered }
  | { kind: 'update'; job: Job; rendered: Rendered }
  | { kind: 'adopt'; job: Job; rendered: Rendered }
  | { kind: 'delete'; name: JobName }
  | { kind: 'noop'; name: JobName };

/** Only `plan()` produces this, so `execute()` cannot run an unchecked plan. */
export type Plan = Brand<{ manifest: ManifestId; actions: Action[] }, 'Plan'>;

export type Conflict = { name: JobName; owner: Owner };
