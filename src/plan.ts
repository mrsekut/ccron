import {
  err,
  ok,
  type Action,
  type ActualJob,
  type ActualState,
  type Conflict,
  type Manifest,
  type Plan,
  type Rendered,
  type Result,
} from './domain';
import { render, type RenderEnv } from './generator';

/**
 * Decide what has to change for launchd to match the manifest.
 *
 * Only jobs owned by this manifest are ever deleted. A declared job whose name
 * is taken by another manifest (or by an orphan) is a conflict and nothing is
 * planned at all; a job without an owner is adopted.
 */
export function plan(
  manifest: Manifest,
  actual: ActualState,
  env: RenderEnv,
): Result<Plan, Conflict[]> {
  const actualByName = new Map(actual.map(job => [job.name as string, job]));
  const declared = new Set(manifest.jobs.map(job => job.name as string));

  const actions: Action[] = [];
  const conflicts: Conflict[] = [];

  for (const job of manifest.jobs) {
    const rendered = render(job, env);
    const existing = actualByName.get(job.name);

    if (existing === undefined) {
      actions.push({ kind: 'create', job, rendered });
      continue;
    }

    switch (existing.owner.kind) {
      case 'mine':
        actions.push(
          isInSync(existing, rendered)
            ? { kind: 'noop', name: job.name }
            : { kind: 'update', job, rendered },
        );
        break;
      case 'unowned':
        actions.push({ kind: 'adopt', job, rendered });
        break;
      case 'other':
      case 'orphan':
        conflicts.push({ name: job.name, owner: existing.owner });
        break;
    }
  }

  for (const job of actual) {
    if (job.owner.kind === 'mine' && !declared.has(job.name)) {
      actions.push({ kind: 'delete', name: job.name });
    }
  }

  if (conflicts.length > 0) return err(conflicts);

  actions.sort((a, b) => actionName(a).localeCompare(actionName(b)));
  return ok({ manifest: manifest.id, actions } as Plan);
}

function isInSync(existing: ActualJob, rendered: Rendered): boolean {
  return (
    existing.loaded &&
    existing.artifacts.kind === 'complete' &&
    existing.artifacts.plist === rendered.plist &&
    existing.artifacts.script === rendered.script
  );
}

export function actionName(action: Action): string {
  return 'job' in action ? action.job.name : action.name;
}
