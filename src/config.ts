import { homedir } from 'os';
import { join } from 'path';

// --- Types ---

export type TaskConfig = {
  name: string;
  schedule: string;
  prompt: string | null;
  mcpConfig: string | null;
  cwd: string | null;
};

export type GlobalConfig = {
  claudePath: string;
  extraPaths: string[];
  ulimit: number;
};

// --- Paths ---

const home = homedir();

export const PATHS = {
  binDir: join(home, '.local', 'bin'),
  logsDir: join(home, '.local', 'share', 'ccron', 'logs'),
  launchAgentsDir: join(home, 'Library', 'LaunchAgents'),
} as const;

export function scriptPath(name: string): string {
  return join(PATHS.binDir, `ccron-${name}.sh`);
}

export function plistPath(name: string): string {
  return join(PATHS.launchAgentsDir, `com.ccron.${name}.plist`);
}

export function logPath(name: string): string {
  return join(PATHS.logsDir, `${name}.log`);
}

export function plistLabel(name: string): string {
  return `com.ccron.${name}`;
}
