import { basename } from 'path';
import type { Launchd } from '../launchd';
import { LABEL_PREFIX } from '../paths';

/** In-memory launchd. `failBootstrap` names jobs whose bootstrap throws. */
export function fakeLaunchd(failBootstrap: string[] = []) {
  const loaded = new Set<string>();
  const launchd: Launchd = {
    bootstrap: async plistPath => {
      const name = basename(plistPath, '.plist').slice(LABEL_PREFIX.length);
      if (failBootstrap.includes(name))
        throw new Error(`bootstrap failed: ${name}`);
      loaded.add(name);
    },
    bootout: async name => {
      loaded.delete(name);
    },
    kickstart: async () => {},
    status: async name =>
      loaded.has(name) ? { pid: null, lastExitStatus: 0 } : null,
  };
  return {
    launchd,
    loaded,
    isLoaded: async (name: string) => loaded.has(name),
  };
}
