import type { Action, ActualJob, Conflict, Owner } from './domain';
import { plistLabel, plistPath, scriptPath, type Paths } from './paths';
import { actionName } from './plan';

const ACTION_MARK: Record<Action['kind'], string> = {
  create: '+',
  update: '~',
  adopt: '>',
  delete: '-',
  noop: '=',
};

export function formatAction(action: Action): string {
  return `  ${ACTION_MARK[action.kind]} ${action.kind.padEnd(6)} ${actionName(action)}`;
}

export function formatOwner(owner: Owner): string {
  switch (owner.kind) {
    case 'mine':
      return 'this manifest';
    case 'other':
      return `owned by ${owner.manifest}`;
    case 'orphan':
      return `orphan (manifest ${owner.manifest} no longer exists)`;
    case 'unowned':
      return 'unowned (no CCRON_MANIFEST)';
  }
}

export function formatConflicts(conflicts: Conflict[]): string {
  return [
    'cannot apply: these job names are already used elsewhere:',
    ...conflicts.map(c => `  ${c.name}: ${formatOwner(c.owner)}`),
  ].join('\n');
}

/** Jobs this manifest neither declares nor owns; apply leaves them alone. */
export function untouchedJobs(
  actual: ActualJob[],
  declared: Set<string>,
): ActualJob[] {
  return actual.filter(j => j.owner.kind !== 'mine' && !declared.has(j.name));
}

export function removalCommand(paths: Paths, name: string): string {
  return `launchctl bootout gui/$(id -u)/${plistLabel(name)}; rm -f '${plistPath(paths, name)}' '${scriptPath(paths, name)}'`;
}
