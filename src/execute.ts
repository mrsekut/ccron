import { chmod, mkdir, rm } from 'fs/promises';
import type { Action, JobName, Plan, Rendered } from './domain';
import type { Launchd } from './launchd';
import { plistPath, scriptPath, type Paths } from './paths';

export type ExecuteDeps = {
  paths: Paths;
  launchd: Launchd;
};

export type ActionResult =
  | { action: Action; ok: true }
  | { action: Action; ok: false; error: string };

/**
 * Apply a plan to disk and launchd.
 *
 * Stops at the first failure and returns the results so far. Nothing is rolled
 * back: the manifest is the source of truth, so fixing the cause and applying
 * again converges.
 */
export async function execute(
  plan: Plan,
  deps: ExecuteDeps,
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  for (const action of plan.actions) {
    try {
      await run(action, deps);
      results.push({ action, ok: true });
    } catch (e) {
      results.push({
        action,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
      break;
    }
  }
  return results;
}

async function run(action: Action, deps: ExecuteDeps): Promise<void> {
  switch (action.kind) {
    case 'noop':
      return;
    case 'create':
    case 'update':
    case 'adopt':
      return install(action.job.name, action.rendered, deps);
    case 'delete':
      return uninstall(action.name, deps);
  }
}

async function install(
  name: JobName,
  rendered: Rendered,
  { paths, launchd }: ExecuteDeps,
): Promise<void> {
  await Promise.all([
    mkdir(paths.bin, { recursive: true }),
    mkdir(paths.logs, { recursive: true }),
    mkdir(paths.launchAgents, { recursive: true }),
  ]);
  const script = scriptPath(paths, name);
  await Bun.write(script, rendered.script);
  await chmod(script, 0o755);
  await Bun.write(plistPath(paths, name), rendered.plist);
  // launchd does not reread a loaded plist, so reload it.
  await launchd.bootout(name);
  await launchd.bootstrap(plistPath(paths, name));
}

/** Logs are kept so that past runs can still be inspected. */
async function uninstall(
  name: JobName,
  { paths, launchd }: ExecuteDeps,
): Promise<void> {
  await launchd.bootout(name);
  await rm(plistPath(paths, name), { force: true });
  await rm(scriptPath(paths, name), { force: true });
}
