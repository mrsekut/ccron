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
} from "../config";
import { parseSchedule } from "../schedule";
import { validateMcpPresets } from "../mcp";
import {
  generateScriptContent,
  generatePlistContent,
  generateMcpConfigContent,
} from "../generator";
import { bootstrap } from "../launchd";

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
  console.log(`✓ Task config saved: ~/.config/ccron/tasks/${task.name}.json`);

  // Generate MCP config if needed
  if (task.mcp.length > 0) {
    const mcpContent = generateMcpConfigContent(task.mcp);
    await Bun.write(mcpConfigPath(task.name), mcpContent);
    console.log(`✓ MCP config saved: ~/.config/ccron/mcp/${task.name}.json`);
  }

  // Generate script
  const scriptContent = generateScriptContent(task, globalConfig);
  const scriptFile = scriptPath(task.name);
  await Bun.write(scriptFile, scriptContent);
  const { chmod } = await import("fs/promises");
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
  let name = "";
  let schedule = "";
  let prompt: string | null = null;
  let promptFile: string | null = null;
  let mcp: string[] = [];
  let allowedTools: string[] = [];
  let maxTurns: number | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const next = args[i + 1];

    switch (arg) {
      case "--name":
        name = next ?? "";
        i++;
        break;
      case "--schedule":
        schedule = next ?? "";
        i++;
        break;
      case "--prompt":
        prompt = next ?? "";
        i++;
        break;
      case "--prompt-file":
        promptFile = next ?? "";
        i++;
        break;
      case "--mcp":
        mcp = (next ?? "").split(",").filter(Boolean);
        i++;
        break;
      case "--allowed-tools":
        allowedTools = (next ?? "").split(",").filter(Boolean);
        i++;
        break;
      case "--max-turns":
        maxTurns = Number(next);
        i++;
        break;
      case "--help":
      case "-h":
        printAddHelp();
        process.exit(0);
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
    }
  }

  return { name, schedule, prompt, promptFile, mcp, allowedTools, maxTurns };
}

async function validateOptions(opts: AddOptions): Promise<void> {
  const errors: string[] = [];

  // Name
  if (!opts.name) {
    errors.push("--name is required");
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
    errors.push("--schedule is required");
  }

  // Prompt
  if (!opts.prompt && !opts.promptFile) {
    errors.push("Either --prompt or --prompt-file is required");
  }
  if (opts.prompt && opts.promptFile) {
    errors.push("Cannot specify both --prompt and --prompt-file");
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
  if (opts.maxTurns !== null && (!Number.isInteger(opts.maxTurns) || opts.maxTurns < 1)) {
    errors.push("--max-turns must be a positive integer");
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
        "Warning: Could not detect claude CLI path. Set it manually with ccron config --claude-path",
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
      const { dirname } = await import("path");
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
  ccron add --name daily-summary --schedule "15 17 * * 1-5" --prompt-file ./prompts/daily.txt
  ccron add --name weekly-review --schedule "0 22 * * 5" --prompt "週次レビューを作成して" --mcp slack
  ccron add --name hourly-check --schedule "0 9 * * *" --prompt "ステータスチェック" --allowed-tools "Bash,Read"

Note: Step values (*/5) and ranges in minute/hour are not supported by launchd.`);
}
