import {
  readTaskConfig,
  writeTaskConfig,
  readGlobalConfig,
  scriptPath,
  plistPath,
} from '../config';
import { parseSchedule } from '../schedule';
import {
  generateScriptContent,
  generatePlistContent,
} from '../generator';
import { bootout, bootstrap } from '../launchd';

export async function editCommand(args: string[]): Promise<void> {
  const { parseArgs } = require('util');
  const { values, positionals } = parseArgs({
    args,
    options: {
      schedule: { type: 'string' },
      prompt: { type: 'string' },
      'mcp-config': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    printEditHelp();
    process.exit(0);
  }

  const name = positionals[0] as string | undefined;
  if (!name) {
    console.error('Usage: ccron edit <name> [options]');
    process.exit(1);
  }

  const task = await readTaskConfig(name);
  if (!task) {
    console.error(`Task "${name}" not found.`);
    process.exit(1);
  }

  let changed = false;

  if (values.schedule !== undefined) {
    task.schedule = values.schedule;
    parseSchedule(task.schedule);
    changed = true;
  }

  if (values.prompt !== undefined) {
    task.prompt = values.prompt;
    changed = true;
  }

  if (values['mcp-config'] !== undefined) {
    const mcpPath = values['mcp-config'];
    if (mcpPath && !(await Bun.file(mcpPath).exists())) {
      console.error(`MCP config file not found: ${mcpPath}`);
      process.exit(1);
    }
    task.mcpConfig = mcpPath || null;
    changed = true;
  }

  if (!changed) {
    console.log('No changes specified. Use --help to see available options.');
    return;
  }

  task.updatedAt = new Date().toISOString();

  const globalConfig = await readGlobalConfig();
  const intervals = parseSchedule(task.schedule);

  // Update task config
  await writeTaskConfig(task);
  console.log(`✓ Task config updated`);

  // Regenerate script
  const scriptContent = generateScriptContent(task, globalConfig);
  const scriptFile = scriptPath(task.name);
  await Bun.write(scriptFile, scriptContent);
  const { chmod } = await import('fs/promises');
  await chmod(scriptFile, 0o755);
  console.log(`✓ Script regenerated`);

  // Regenerate plist
  const plistContent = generatePlistContent(task, globalConfig, intervals);
  await Bun.write(plistPath(task.name), plistContent);
  console.log(`✓ Plist regenerated`);

  // Reload launchd
  await bootout(task.name);
  await bootstrap(plistPath(task.name));
  console.log(`✓ launchd reloaded`);

  console.log(`\n"${task.name}" updated.`);
}

function printEditHelp() {
  console.log(`ccron edit - Edit a task's configuration

Usage: ccron edit <name> [options]

Options:
  --schedule <cron>       Update cron expression
  --prompt <text>         Update prompt
  --mcp-config <path>     Update MCP config file path (pass "" to remove)

Examples:
  ccron edit daily-summary --schedule "0 18 * * 1-5"
  ccron edit daily-summary --prompt "新しいプロンプト"
  ccron edit daily-summary --mcp-config ~/.config/ccron/mcp/slack.json`);
}
