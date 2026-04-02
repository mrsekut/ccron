import {
  readTaskConfig,
  readGlobalConfig,
  scriptPath,
  plistPath,
  mcpConfigPath,
} from "../config";
import { listOne } from "../launchd";
import { homedir } from "os";

type CheckResult = {
  label: string;
  ok: boolean;
  detail: string;
  fix?: string;
};

export async function testCommand(args: string[]): Promise<void> {
  const name = args[0];
  if (!name) {
    console.error("Usage: ccron test <name>");
    process.exit(1);
  }

  const task = await readTaskConfig(name);
  if (!task) {
    console.error(`Task "${name}" not found.`);
    process.exit(1);
  }

  console.log(`Checking ${name}...\n`);

  const checks: CheckResult[] = [];

  checks.push(await checkClaudeCli());
  checks.push(await checkClaudeAuth());
  checks.push(await checkUlimit());
  checks.push(await checkScriptExists(name));
  checks.push(checkScriptTccSafe(name));
  checks.push(await checkPlistRegistered(name));

  if (task.mcp.length > 0) {
    checks.push(await checkMcpConfig(name));
  }

  // Print results
  for (const check of checks) {
    if (check.ok) {
      console.log(`  ✓ ${check.label}: ${check.detail}`);
    } else {
      console.log(`  ✗ ${check.label}: ${check.detail}`);
      if (check.fix) {
        console.log(`    → ${check.fix}`);
      }
    }
  }

  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\n${passed}/${checks.length} checks passed.`);
  if (failed > 0) {
    console.log(`${failed} issue(s) found.`);
    process.exit(1);
  }
}

async function checkClaudeCli(): Promise<CheckResult> {
  try {
    const result = await Bun.$`which claude`.quiet();
    if (result.exitCode === 0) {
      const path = result.stdout.toString().trim();
      // Try to get version
      const ver = await Bun.$`claude --version`.quiet();
      const version = ver.exitCode === 0 ? ver.stdout.toString().trim() : "";
      return {
        label: "claude CLI",
        ok: true,
        detail: `found (${path}${version ? ` ${version}` : ""})`,
      };
    }
  } catch {
    // fall through
  }
  return {
    label: "claude CLI",
    ok: false,
    detail: "not found in PATH",
    fix: "Install claude CLI or set path with ccron config",
  };
}

async function checkClaudeAuth(): Promise<CheckResult> {
  try {
    const result = await Bun.$`claude auth status`.quiet();
    const output = result.stdout.toString() + result.stderr.toString();
    if (result.exitCode === 0) {
      return {
        label: "claude auth",
        ok: true,
        detail: "authenticated",
      };
    }
    return {
      label: "claude auth",
      ok: false,
      detail: output.trim() || "not authenticated",
      fix: "Run: claude auth login",
    };
  } catch {
    return {
      label: "claude auth",
      ok: false,
      detail: "failed to check",
      fix: "Run: claude auth login",
    };
  }
}

async function checkUlimit(): Promise<CheckResult> {
  const global = await readGlobalConfig();
  try {
    const result = await Bun.$`ulimit -n`.quiet();
    const current = Number(result.stdout.toString().trim());
    if (current >= global.ulimit) {
      return {
        label: "ulimit -n",
        ok: true,
        detail: `${current} (sufficient)`,
      };
    }
    return {
      label: "ulimit -n",
      ok: true, // Script sets it, so just a warning
      detail: `${current} (script will set to ${global.ulimit})`,
    };
  } catch {
    return {
      label: "ulimit -n",
      ok: true,
      detail: "could not check (script will set it)",
    };
  }
}

async function checkScriptExists(name: string): Promise<CheckResult> {
  const path = scriptPath(name);
  const exists = await Bun.file(path).exists();
  return {
    label: "script",
    ok: exists,
    detail: exists ? `exists (${path})` : `not found (${path})`,
    fix: exists ? undefined : `Re-register: ccron add --name ${name} ...`,
  };
}

function checkScriptTccSafe(name: string): CheckResult {
  const path = scriptPath(name);
  const home = homedir();
  const tccDirs = [
    `${home}/Desktop`,
    `${home}/Documents`,
    `${home}/Downloads`,
  ];
  const inTcc = tccDirs.some((dir) => path.startsWith(dir));
  return {
    label: "TCC protection",
    ok: !inTcc,
    detail: inTcc
      ? `script is in TCC-protected directory`
      : `script path is outside TCC-protected directories`,
    fix: inTcc
      ? "Move script outside ~/Desktop, ~/Documents, ~/Downloads"
      : undefined,
  };
}

async function checkPlistRegistered(name: string): Promise<CheckResult> {
  const status = await listOne(name);
  const path = plistPath(name);
  const fileExists = await Bun.file(path).exists();

  if (status) {
    return {
      label: "launchd",
      ok: true,
      detail: `registered (pid: ${status.pid ?? "idle"})`,
    };
  }
  return {
    label: "launchd",
    ok: false,
    detail: fileExists ? "plist exists but not loaded" : "plist not found",
    fix: `Re-register: ccron add --name ${name} ...`,
  };
}

async function checkMcpConfig(name: string): Promise<CheckResult> {
  const path = mcpConfigPath(name);
  const exists = await Bun.file(path).exists();
  return {
    label: "MCP config",
    ok: exists,
    detail: exists ? `exists (${path})` : `not found (${path})`,
    fix: exists ? undefined : `Re-register with --mcp flag`,
  };
}
