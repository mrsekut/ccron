import { homedir } from 'os';
import { join } from 'path';

/**
 * Where ccron writes generated files. Passed around instead of read from
 * constants so tests can point it at a temporary directory.
 */
export type Paths = {
  launchAgents: string;
  bin: string;
  logs: string;
};

export function defaultPaths(home: string = homedir()): Paths {
  return {
    launchAgents: join(home, 'Library', 'LaunchAgents'),
    bin: join(home, '.local', 'bin'),
    logs: join(home, '.local', 'share', 'ccron', 'logs'),
  };
}

export function scriptPath(paths: Paths, name: string): string {
  return join(paths.bin, `ccron-${name}.sh`);
}

export function plistPath(paths: Paths, name: string): string {
  return join(paths.launchAgents, plistFileName(name));
}

export function logPath(paths: Paths, name: string): string {
  return join(paths.logs, `${name}.log`);
}

export const LABEL_PREFIX = 'com.ccron.';

export function plistLabel(name: string): string {
  return `${LABEL_PREFIX}${name}`;
}

export function plistFileName(name: string): string {
  return `${plistLabel(name)}.plist`;
}
