import { plistLabel } from './paths';

export async function bootstrap(plistPath: string): Promise<void> {
  const uid = process.getuid?.() ?? 501;
  const result = await Bun.$`launchctl bootstrap gui/${uid} ${plistPath}`
    .quiet()
    .nothrow();
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString().trim();
    // Already bootstrapped is not an error
    if (stderr.includes('service already bootstrapped')) return;
    throw new Error(`launchctl bootstrap failed: ${stderr}`);
  }
}

export async function bootout(name: string): Promise<void> {
  const uid = process.getuid?.() ?? 501;
  const label = plistLabel(name);
  const result = await Bun.$`launchctl bootout gui/${uid}/${label}`
    .quiet()
    .nothrow();
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString().trim();
    // Not loaded is not an error: bootout is also used before (re)loading.
    // launchctl reports it as "Boot-out failed: 3: No such process".
    if (stderr.includes('No such process')) return;
    if (stderr.includes('Could not find service')) return;
    throw new Error(`launchctl bootout failed: ${stderr}`);
  }
}

export async function kickstart(name: string): Promise<void> {
  const uid = process.getuid?.() ?? 501;
  const label = plistLabel(name);
  const result = await Bun.$`launchctl kickstart gui/${uid}/${label}`
    .quiet()
    .nothrow();
  if (result.exitCode !== 0) {
    throw new Error(
      `launchctl kickstart failed: ${result.stderr.toString().trim()}`,
    );
  }
}

export type LaunchdStatus = {
  pid: number | null;
  lastExitStatus: number | null;
};

export async function listOne(name: string): Promise<LaunchdStatus | null> {
  const label = plistLabel(name);
  const result = await Bun.$`launchctl list ${label}`.quiet().nothrow();
  if (result.exitCode !== 0) return null;

  const output = result.stdout.toString();
  let pid: number | null = null;
  let lastExitStatus: number | null = null;

  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    const pidMatch = trimmed.match(/^"PID"\s*=\s*(\d+)/);
    if (pidMatch) pid = Number(pidMatch[1]);
    const statusMatch = trimmed.match(/^"LastExitStatus"\s*=\s*(\d+)/);
    if (statusMatch) lastExitStatus = Number(statusMatch[1]);
  }

  return { pid, lastExitStatus };
}

/** launchctl operations, injectable so tests can swap in a fake. */
export type Launchd = {
  bootstrap: (plistPath: string) => Promise<void>;
  bootout: (name: string) => Promise<void>;
  kickstart: (name: string) => Promise<void>;
  status: (name: string) => Promise<LaunchdStatus | null>;
};

export const systemLaunchd: Launchd = {
  bootstrap,
  bootout,
  kickstart,
  status: listOne,
};
