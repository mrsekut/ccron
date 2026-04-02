import {
  type TaskConfig,
  type GlobalConfig,
  validateTaskName,
  readTaskConfig,
  writeTaskConfig,
  readGlobalConfig,
  writeGlobalConfig,
  ensureDirectories,
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
import { bootstrap } from '../launchd';

type AddOptions = {
  name: string;
  schedule: string;
  prompt: string | null;
  promptFile: string | null;
  mcp: string[];
  allowedTools: string[];
  maxTurns: number | null;
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
    promptFile: opts.promptFile,
    mcp: opts.mcp,
    allowedTools: opts.allowedTools,
    maxTurns: opts.maxTurns,
    createdAt: now,
    updatedAt: now,
  };

  // Save task config
  await writeTaskConfig(task);
  console.log(`✓ Task config saved: ~/.config/cccron/tasks/${task.name}.json`);

  // Generate MCP config if needed
  if (task.mcp.length > 0) {
    const mcpContent = generateMcpConfigContent(task.mcp);
    await Bun.write(mcpConfigPath(task.name), mcpContent);
    console.log(`✓ MCP config saved: ~/.config/cccron/mcp/${task.name}.json`);
  }

  // Generate script
  const scriptContent = generateScriptContent(task, globalConfig);
  const scriptFile = scriptPath(task.name);
  await Bun.write(scriptFile, scriptContent);
  const { chmod } = await import('fs/promises');
  await chmod(scriptFile, 0o755);
  console.log(`✓ Script generated: ~/.local/bin/cccron-${task.name}.sh`);

  // Generate plist
  const plistContent = generatePlistContent(task, globalConfig, intervals);
  const plistFile = plistPath(task.name);
  await Bun.write(plistFile, plistContent);
  console.log(
    `✓ Plist generated: ~/Library/LaunchAgents/com.cccron.${task.name}.plist`,
  );

  // Register with launchd
  await bootstrap(plistFile);
  console.log(`✓ Registered with launchd`);

  console.log(
    `\n${task.name} scheduled (${task.schedule}). Run "cccron test ${task.name}" to verify setup.`,
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
      'prompt-file': { type: 'string' },
      mcp: { type: 'string' },
      'allowed-tools': { type: 'string' },
      'max-turns': { type: 'string' },
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
    promptFile: values['prompt-file'] ?? null,
    mcp: values.mcp ? values.mcp.split(',').filter(Boolean) : [],
    allowedTools: values['allowed-tools']
      ? values['allowed-tools'].split(',').filter(Boolean)
      : [],
    maxTurns: values['max-turns'] ? Number(values['max-turns']) : null,
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
          `Task "${opts.name}" already exists. Use "cccron edit ${opts.name}" to modify.`,
        );
      }
    }
  }

  // Schedule
  if (!opts.schedule) {
    errors.push('--schedule is required');
  }

  // Prompt
  if (!opts.prompt && !opts.promptFile) {
    errors.push('Either --prompt or --prompt-file is required');
  }
  if (opts.prompt && opts.promptFile) {
    errors.push('Cannot specify both --prompt and --prompt-file');
  }
  if (opts.promptFile) {
    const file = Bun.file(opts.promptFile);
    if (!(await file.exists())) {
      errors.push(`Prompt file not found: ${opts.promptFile}`);
    }
  }

  // MCP
  if (opts.mcp.length > 0) {
    const mcpError = validateMcpPresets(opts.mcp);
    if (mcpError) errors.push(mcpError);
  }

  // Max turns
  if (
    opts.maxTurns !== null &&
    (!Number.isInteger(opts.maxTurns) || opts.maxTurns < 1)
  ) {
    errors.push('--max-turns must be a positive integer');
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
        'Warning: Could not detect claude CLI path. Set it manually with cccron config --claude-path',
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
  console.log(`cccron add - Register a new scheduled task

Usage: cccron add [options]

Required:
  --name <name>           Task name (lowercase letters, numbers, hyphens)
  --schedule <cron>       Cron expression: "minute hour * * day-of-week"
  --prompt <text>         Prompt string (mutually exclusive with --prompt-file)
  --prompt-file <path>    Path to prompt file (mutually exclusive with --prompt)

Optional:
  --mcp <names>           MCP server presets, comma-separated (slack, linear)
  --allowed-tools <tools> Allowed tools, comma-separated (Bash,Read,Write,Edit,Glob,Grep)
  --max-turns <n>         Maximum number of turns

Schedule format (cron):
  "minute hour * * day-of-week"

  minute:       0-59
  hour:         0-23
  day-of-week:  0-6 (0=Sun), ranges (1-5), comma-separated (1,3,5)
  day-of-month and month: must be "*" (launchd limitation)

Examples:
  cccron add --name daily-summary --schedule "15 17 * * 1-5" --prompt-file ./prompts/daily.txt
  cccron add --name weekly-review --schedule "0 22 * * 5" --prompt "週次レビューを作成して" --mcp slack
  cccron add --name hourly-check --schedule "0 9 * * *" --prompt "ステータスチェック" --allowed-tools "Bash,Read"

Note: Step values (*/5) and ranges in minute/hour are not supported by launchd.`);
}
