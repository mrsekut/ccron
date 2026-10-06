import { parseArgs } from 'util';
import { execute } from '../execute';
import {
  formatAction,
  formatConflicts,
  formatOwner,
  untouchedJobs,
} from '../format';
import { actionName } from '../plan';
import { formatPrepareError, prepare, type Deps } from '../workflow';

const HELP = `ccron apply - Make launchd match a manifest

Usage: ccron apply <ccron.json> [--dry-run]

Creates, updates and adopts the declared jobs, and deletes jobs this manifest
created earlier but no longer declares. Jobs owned by other manifests or by no
manifest are left alone.

Options:
  --dry-run   Show the plan without changing anything`;

/** Returns the process exit code. */
export async function apply(
  args: string[],
  deps: Deps,
  out: (line: string) => void,
): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        'dry-run': { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
      allowPositionals: true,
    });
  } catch (e) {
    out(e instanceof Error ? e.message : String(e));
    out('Usage: ccron apply <ccron.json> [--dry-run]');
    return 1;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    out(HELP);
    return 0;
  }
  const manifestPath = positionals[0];
  if (manifestPath === undefined || positionals.length > 1) {
    out('Usage: ccron apply <ccron.json> [--dry-run]');
    return 1;
  }

  const prepared = await prepare(manifestPath, deps);
  if (!prepared.ok) {
    out(formatPrepareError(prepared.error));
    return 1;
  }
  const { manifest, actual, plan } = prepared.value;
  if (!plan.ok) {
    out(formatConflicts(plan.error));
    return 1;
  }

  out(`Plan for ${manifest.id}:`);
  if (plan.value.actions.length === 0) out('  (no jobs)');
  for (const action of plan.value.actions) out(formatAction(action));

  const untouched = untouchedJobs(
    actual,
    new Set(manifest.jobs.map(j => j.name as string)),
  );
  if (untouched.length > 0) {
    out('Left alone:');
    for (const job of untouched)
      out(`    ${job.name}: ${formatOwner(job.owner)}`);
  }

  if (values['dry-run']) return 0;
  if (plan.value.actions.every(a => a.kind === 'noop')) {
    out('Nothing to do.');
    return 0;
  }

  out('');
  const results = await execute(plan.value, deps);
  for (const result of results) {
    if (result.action.kind === 'noop') continue;
    const name = actionName(result.action);
    out(
      result.ok
        ? `✓ ${result.action.kind} ${name}`
        : `✗ ${result.action.kind} ${name}: ${result.error}`,
    );
  }
  const failed = results.some(r => !r.ok);
  if (failed)
    out('\nStopped at the first failure. Fix the cause and run apply again.');
  return failed ? 1 : 0;
}
