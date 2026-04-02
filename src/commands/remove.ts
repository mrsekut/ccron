import {
  readTaskConfig,
  deleteTaskConfig,
  scriptPath,
  plistPath,
  mcpConfigPath,
  logPath,
  listTaskConfigs,
} from '../config';
import { bootout } from '../launchd';

export async function removeCommand(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`cccron remove - Remove a registered task

Usage: cccron remove <name> [--purge]

Removes a task by:
  1. Unregistering from launchd (launchctl bootout)
  2. Deleting plist, script, task config
  3. Deleting MCP config (if not used by other tasks)

Options:
  --purge   Also delete log files (logs are kept by default)

Examples:
  cccron remove daily-summary
  cccron remove daily-summary --purge`);
    return;
  }

  const purge = args.includes('--purge');
  const name = args.find(a => !a.startsWith('-'));

  if (!name) {
    console.error('Usage: cccron remove <name> [--purge]');
    process.exit(1);
  }

  const task = await readTaskConfig(name);
  if (!task) {
    console.error(`Task "${name}" not found.`);
    process.exit(1);
  }

  // 1. Unregister from launchd
  await bootout(name);
  console.log(`✓ Unregistered from launchd`);

  // 2. Delete plist
  await tryUnlink(plistPath(name));
  console.log(`✓ Plist removed`);

  // 3. Delete script
  await tryUnlink(scriptPath(name));
  console.log(`✓ Script removed`);

  // 4. Delete MCP config if not shared by other tasks
  if (task.mcp.length > 0) {
    const otherTasks = await listTaskConfigs();
    const otherUsing = otherTasks.some(
      t => t.name !== name && t.mcp.some(m => task.mcp.includes(m)),
    );
    if (!otherUsing) {
      await tryUnlink(mcpConfigPath(name));
      console.log(`✓ MCP config removed`);
    } else {
      console.log(`  MCP config kept (used by other tasks)`);
    }
  }

  // 5. Delete task config
  await deleteTaskConfig(name);
  console.log(`✓ Task config removed`);

  // 6. Logs
  if (purge) {
    await tryUnlink(logPath(name));
    console.log(`✓ Logs purged`);
  } else {
    console.log(`  Logs kept at ${logPath(name)} (use --purge to remove)`);
  }

  console.log(`\n"${name}" removed.`);
}

async function tryUnlink(path: string): Promise<void> {
  const { unlink } = await import('fs/promises');
  try {
    await unlink(path);
  } catch {
    // ignore
  }
}
