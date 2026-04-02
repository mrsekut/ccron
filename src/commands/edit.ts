import {
  readTaskConfig,
  writeTaskConfig,
  readGlobalConfig,
  mcpConfigPath,
  scriptPath,
  plistPath,
} from '../config';
import { parseSchedule } from '../schedule';
import { validateMcpPresets } from '../mcp';
import {
  generateScriptContent,
  generatePlistContent,
  generateMcpConfigContent,
} from '../generator';
import { bootout, bootstrap } from '../launchd';

export async function editCommand(args: string[]): Promise<void> {
  const { parseArgs } = require('util');
  const { values, positionals } = parseArgs({
    args,
    options: {
      schedule: { type: 'string' },
      prompt: { type: 'string' },
      'prompt-file': { type: 'string' },
      mcp: { type: 'string' },
      'allowed-tools': { type: 'string' },
      'max-turns': { type: 'string' },
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
    task.promptFile = null;
    changed = true;
  }

  if (values['prompt-file'] !== undefined) {
    task.promptFile = values['prompt-file'];
    task.prompt = null;
    if (!(await Bun.file(task.promptFile!).exists())) {
      console.error(`Prompt file not found: ${task.promptFile}`);
      process.exit(1);
    }
    changed = true;
  }

  if (values.mcp !== undefined) {
    const mcpNames = values.mcp.split(',').filter(Boolean);
    const mcpError = validateMcpPresets(mcpNames);
    if (mcpError) {
      console.error(`Error: ${mcpError}`);
      process.exit(1);
    }
    task.mcp = mcpNames;
    changed = true;
  }

  if (values['allowed-tools'] !== undefined) {
    task.allowedTools = values['allowed-tools'].split(',').filter(Boolean);
    changed = true;
  }

  if (values['max-turns'] !== undefined) {
    task.maxTurns = Number(values['max-turns']);
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

  // Regenerate MCP config
  if (task.mcp.length > 0) {
    await Bun.write(
      mcpConfigPath(task.name),
      generateMcpConfigContent(task.mcp),
    );
    console.log(`✓ MCP config regenerated`);
  }

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
  --prompt <text>         Update prompt (clears --prompt-file)
  --prompt-file <path>    Update prompt file (clears --prompt)
  --mcp <names>           Update MCP presets (comma-separated)
  --allowed-tools <tools> Update allowed tools (comma-separated)
  --max-turns <n>         Update max turns

Examples:
  ccron edit daily-summary --schedule "0 18 * * 1-5"
  ccron edit daily-summary --prompt-file ./prompts/v2.txt
  ccron edit daily-summary --mcp slack,linear`);
}
