import {
  readTaskConfig,
  writeTaskConfig,
  readGlobalConfig,
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
import { bootout, bootstrap } from "../launchd";

export async function editCommand(args: string[]): Promise<void> {
  const name = args.find((a) => !a.startsWith("-"));

  if (!name) {
    console.error("Usage: ccron edit <name> [options]");
    process.exit(1);
  }

  const task = await readTaskConfig(name);
  if (!task) {
    console.error(`Task "${name}" not found.`);
    process.exit(1);
  }

  let changed = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const next = args[i + 1];

    switch (arg) {
      case "--schedule":
        task.schedule = next ?? "";
        parseSchedule(task.schedule); // validate
        i++;
        changed = true;
        break;
      case "--prompt":
        task.prompt = next ?? "";
        task.promptFile = null;
        i++;
        changed = true;
        break;
      case "--prompt-file":
        task.promptFile = next ?? "";
        task.prompt = null;
        if (!(await Bun.file(task.promptFile).exists())) {
          console.error(`Prompt file not found: ${task.promptFile}`);
          process.exit(1);
        }
        i++;
        changed = true;
        break;
      case "--mcp": {
        const mcpNames = (next ?? "").split(",").filter(Boolean);
        const mcpError = validateMcpPresets(mcpNames);
        if (mcpError) {
          console.error(`Error: ${mcpError}`);
          process.exit(1);
        }
        task.mcp = mcpNames;
        i++;
        changed = true;
        break;
      }
      case "--allowed-tools":
        task.allowedTools = (next ?? "").split(",").filter(Boolean);
        i++;
        changed = true;
        break;
      case "--max-turns":
        task.maxTurns = next ? Number(next) : null;
        i++;
        changed = true;
        break;
      case "--help":
      case "-h":
        printEditHelp();
        process.exit(0);
      default:
        if (arg !== name) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  if (!changed) {
    console.log("No changes specified. Use --help to see available options.");
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
    await Bun.write(mcpConfigPath(task.name), generateMcpConfigContent(task.mcp));
    console.log(`✓ MCP config regenerated`);
  }

  // Regenerate script
  const scriptContent = generateScriptContent(task, globalConfig);
  const scriptFile = scriptPath(task.name);
  await Bun.write(scriptFile, scriptContent);
  const { chmod } = await import("fs/promises");
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
