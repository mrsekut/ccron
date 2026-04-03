import {
  type TaskConfig,
  type GlobalConfig,
  validateTaskName,
  readTaskConfig,
  writeTaskConfig,
  readGlobalConfig,
  writeGlobalConfig,
  ensureDirectories,
  scriptPath,
  plistPath,
} from '../config';
import { parseSchedule } from '../schedule';
import {
  generateScriptContent,
  generatePlistContent,
} from '../generator';
import { bootstrap } from '../launchd';

type AddOptions = {
  name: string;
  schedule: string;
  prompt: string | null;
  mcpConfig: string | null;
};

export async function addCommand(args: string[]): Promise<void> {
  const opts = parseAddArgs(args);
  await validateOptions(opts);

  await ensureDirectories();

  // Detect claude CLI path if not configured
  const globalConfig = await ensureGlobalConfig();

  // Parse schedule to validate it early
  const intervals = parseSchedule(opts.schedule);

  const now = new Date().toISOString();
  const task: TaskConfig = {
    name: opts.name,
    schedule: opts.schedule,
    prompt: opts.prompt,
    mcpConfig: opts.mcpConfig,
    createdAt: now,
    updatedAt: now,
  };

  // Save task config
  await writeTaskConfig(task);
  console.log(`✓ Task config saved: ~/.config/ccron/tasks/${task.name}.json`);

  // Generate script
  const scriptContent = generateScriptContent(task, globalConfig);
  const scriptFile = scriptPath(task.name);
  await Bun.write(scriptFile, scriptContent);
  const { chmod } = await import('fs/promises');
  await chmod(scriptFile, 0o755);
  console.log(`✓ Script generated: ~/.local/bin/ccron-${task.name}.sh`);

  // Generate plist
  const plistContent = generatePlistContent(task, globalConfig, intervals);
  const plistFile = plistPath(task.name);
  await Bun.write(plistFile, plistContent);
  console.log(
    `✓ Plist generated: ~/Library/LaunchAgents/com.ccron.${task.name}.plist`,
  );

  // Register with launchd
  await bootstrap(plistFile);
  console.log(`✓ Registered with launchd`);

  console.log(
    `\n${task.name} scheduled (${task.schedule}). Run "ccron test ${task.name}" to verify setup.`,
  );
}

function parseAddArgs(args: string[]): AddOptions {
  const { parseArgs } = require('util');
  const { values } = parseArgs({
    args,
    options: {
      name: { type: 'string' },
      schedule: { type: 'string' },
      prompt: { type: 'string' },
      'mcp-config': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });

  if (values.help) {
    printAddHelp();
    process.exit(0);
  }

  return {
    name: values.name ?? '',
    schedule: values.schedule ?? '',
    prompt: values.prompt ?? null,
    mcpConfig: values['mcp-config'] ?? null,
  };
}

async function validateOptions(opts: AddOptions): Promise<void> {
  const errors: string[] = [];

  // Name
  if (!opts.name) {
    errors.push('--name is required');
  } else {
    const nameError = validateTaskName(opts.name);
    if (nameError) errors.push(nameError);
    else {
      const existing = await readTaskConfig(opts.name);
      if (existing) {
        errors.push(
          `Task "${opts.name}" already exists. Use "ccron edit ${opts.name}" to modify.`,
        );
      }
    }
  }

  // Schedule
  if (!opts.schedule) {
    errors.push('--schedule is required');
  }

  // Prompt
  if (!opts.prompt) {
    errors.push('--prompt is required');
  }

  // MCP config file
  if (opts.mcpConfig) {
    const file = Bun.file(opts.mcpConfig);
    if (!(await file.exists())) {
      errors.push(`MCP config file not found: ${opts.mcpConfig}`);
    }
  }

  if (errors.length > 0) {
    for (const e of errors) console.error(`Error: ${e}`);
    process.exit(1);
  }
}

async function ensureGlobalConfig(): Promise<GlobalConfig> {
  const config = await readGlobalConfig();

  if (!config.claudePath) {
    const detected = await detectClaudePath();
    if (detected) {
      config.claudePath = detected;
      await writeGlobalConfig(config);
      console.log(`✓ claude CLI detected: ${detected}`);
    } else {
      console.error(
        'Warning: Could not detect claude CLI path. Set it manually with ccron config --claude-path',
      );
    }
  }

  return config;
}

async function detectClaudePath(): Promise<string | null> {
  try {
    const result = await Bun.$`which claude`.quiet();
    if (result.exitCode === 0) {
      const fullPath = result.stdout.toString().trim();
      // Return the directory containing claude
      const { dirname } = await import('path');
      return dirname(fullPath);
    }
  } catch {
    // ignore
  }
  return null;
}

function printAddHelp() {
  console.log(`ccron add - Register a new scheduled task

Usage: ccron add [options]

Required:
  --name <name>           Task name (lowercase letters, numbers, hyphens)
  --schedule <cron>       Cron expression: "minute hour * * day-of-week"
  --prompt <text>         Prompt string

Optional:
  --mcp-config <path>     Path to MCP config JSON file

Schedule format (cron):
  "minute hour * * day-of-week"

  minute:       0-59
  hour:         0-23
  day-of-week:  0-6 (0=Sun), ranges (1-5), comma-separated (1,3,5)
  day-of-month and month: must be "*" (launchd limitation)

Examples:
  ccron add --name daily-summary --schedule "15 17 * * 1-5" --prompt "日次サマリーを作成して"
  ccron add --name weekly-review --schedule "0 22 * * 5" --prompt "週次レビューを作成して" --mcp-config ~/.config/ccron/mcp/slack.json

Note: Step values (*/5) and ranges in minute/hour are not supported by launchd.`);
}
