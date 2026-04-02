import { homedir } from 'os';
import { join } from 'path';

// --- Types ---

export type TaskConfig = {
  name: string;
  schedule: string;
  prompt: string | null;
  promptFile: string | null;
  mcp: string[];
  allowedTools: string[];
  maxTurns: number | null;
  createdAt: string;
  updatedAt: string;
};

export type GlobalConfig = {
  claudePath: string;
  extraPaths: string[];
  ulimit: number;
};

// --- Paths ---

const home = homedir();

export const PATHS = {
  configDir: join(home, '.config', 'cccron'),
  tasksDir: join(home, '.config', 'cccron', 'tasks'),
  mcpDir: join(home, '.config', 'cccron', 'mcp'),
  globalConfig: join(home, '.config', 'cccron', 'config.json'),
  binDir: join(home, '.local', 'bin'),
  logsDir: join(home, '.local', 'share', 'cccron', 'logs'),
  launchAgentsDir: join(home, 'Library', 'LaunchAgents'),
} as const;

export function taskConfigPath(name: string): string {
  return join(PATHS.tasksDir, `${name}.json`);
}

export function mcpConfigPath(name: string): string {
  return join(PATHS.mcpDir, `${name}.json`);
}

export function scriptPath(name: string): string {
  return join(PATHS.binDir, `cccron-${name}.sh`);
}

export function plistPath(name: string): string {
  return join(PATHS.launchAgentsDir, `com.cccron.${name}.plist`);
}

export function logPath(name: string): string {
  return join(PATHS.logsDir, `${name}.log`);
}

export function plistLabel(name: string): string {
  return `com.cccron.${name}`;
}

// --- I/O ---

export async function ensureDirectories(): Promise<void> {
  const { mkdir } = await import('fs/promises');
  await Promise.all([
    mkdir(PATHS.tasksDir, { recursive: true }),
    mkdir(PATHS.mcpDir, { recursive: true }),
    mkdir(PATHS.binDir, { recursive: true }),
    mkdir(PATHS.logsDir, { recursive: true }),
    mkdir(PATHS.launchAgentsDir, { recursive: true }),
  ]);
}

export async function readTaskConfig(name: string): Promise<TaskConfig | null> {
  const file = Bun.file(taskConfigPath(name));
  if (!(await file.exists())) return null;
  return file.json() as Promise<TaskConfig>;
}

export async function writeTaskConfig(config: TaskConfig): Promise<void> {
  await Bun.write(taskConfigPath(config.name), JSON.stringify(config, null, 2));
}

export async function listTaskConfigs(): Promise<TaskConfig[]> {
  const { readdir } = await import('fs/promises');
  let files: string[];
  try {
    files = await readdir(PATHS.tasksDir);
  } catch {
    return [];
  }
  const tasks: TaskConfig[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const content = await Bun.file(join(PATHS.tasksDir, file)).json();
    tasks.push(content as TaskConfig);
  }
  return tasks;
}

export async function deleteTaskConfig(name: string): Promise<void> {
  const { unlink } = await import('fs/promises');
  try {
    await unlink(taskConfigPath(name));
  } catch {
    // ignore if not found
  }
}

export async function readGlobalConfig(): Promise<GlobalConfig> {
  const file = Bun.file(PATHS.globalConfig);
  if (!(await file.exists())) {
    return defaultGlobalConfig();
  }
  return file.json() as Promise<GlobalConfig>;
}

export async function writeGlobalConfig(config: GlobalConfig): Promise<void> {
  await Bun.write(PATHS.globalConfig, JSON.stringify(config, null, 2));
}

function defaultGlobalConfig(): GlobalConfig {
  return {
    claudePath: '',
    extraPaths: [],
    ulimit: 2147483646,
  };
}

// --- Validation (pure) ---

const TASK_NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

export function validateTaskName(name: string): string | null {
  if (!name) return 'Task name is required';
  if (!TASK_NAME_RE.test(name))
    return 'Task name must contain only lowercase letters, numbers, and hyphens, and start with a letter or number';
  if (name.length > 64) return 'Task name must be 64 characters or less';
  return null;
}
