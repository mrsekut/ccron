import { parseArgs } from 'util';
import type { Action, ActualJob } from '../domain';
import {
  formatConflicts,
  formatOwner,
  removalCommand,
  untouchedJobs,
} from '../format';
import { logPath } from '../paths';
import { actionName } from '../plan';
import { formatPrepareError, prepare, type Deps } from '../workflow';

const HELP = `ccron status - Show how launchd compares to a manifest

Usage: ccron status <ccron.json>

For each declared job: whether it is in sync, whether launchd has it loaded,
its last exit status and its log file. Also lists other com.ccron.* jobs with
their owner, and how to remove the ones nobody owns.`;

const SYNC_STATE: Record<Action['kind'], string> = {
  noop: 'in sync',
  create: 'not installed',
  update: 'out of date',
  adopt: 'unowned (apply adopts it)',
  delete: 'removed from manifest (apply deletes it)',
};

/** Returns the process exit code. */
export async function status(
  args: string[],
  deps: Deps,
  out: (line: string) => void,
): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: { help: { type: 'boolean', short: 'h', default: false } },
      allowPositionals: true,
    });
  } catch (e) {
    out(e instanceof Error ? e.message : String(e));
    out('Usage: ccron status <ccron.json>');
    return 1;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    out(HELP);
    return 0;
  }
  const manifestPath = positionals[0];
  if (manifestPath === undefined || positionals.length > 1) {
    out('Usage: ccron status <ccron.json>');
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

  out(`Jobs in ${manifest.id}:`);
  if (plan.value.actions.length === 0) out('  (none)');
  for (const action of plan.value.actions) {
    const name = actionName(action);
    out(`  ${name}: ${SYNC_STATE[action.kind]}`);
    if (action.kind === 'create') continue;
    const launchd = await deps.launchd.status(name);
    out(`    launchd:   ${describeLaunchd(launchd)}`);
    out(`    log:       ${logPath(deps.paths, name)}`);
  }

  const untouched = untouchedJobs(
    actual,
    new Set(manifest.jobs.map(j => j.name as string)),
  );
  if (untouched.length > 0) {
    out('');
    out('Other ccron jobs (apply leaves these alone):');
    for (const job of untouched) describeUntouched(job, deps, out);
  }
  return 0;
}

function describeLaunchd(
  status: { pid: number | null; lastExitStatus: number | null } | null,
): string {
  if (status === null) return 'not loaded';
  if (status.pid !== null) return `running (pid ${status.pid})`;
  return `loaded, last exit ${status.lastExitStatus ?? '-'}`;
}

function describeUntouched(
  job: ActualJob,
  deps: Deps,
  out: (line: string) => void,
): void {
  out(`  ${job.name}: ${formatOwner(job.owner)}`);
  if (job.owner.kind === 'unowned' || job.owner.kind === 'orphan')
    out(`    remove:    ${removalCommand(deps.paths, job.name)}`);
}
