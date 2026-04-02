import { readTaskConfig, logPath } from "../config";
import { kickstart } from "../launchd";
import { spawn } from "child_process";

export async function runCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`ccron run - Manually trigger a task

Usage: ccron run <name>

Kicks start the task via launchctl and tails the log file in real-time.
Press Ctrl+C to stop following the log (the task continues running).

Example:
  ccron run daily-summary`);
    return;
  }

  const name = args[0];
  if (!name) {
    console.error("Usage: ccron run <name>");
    process.exit(1);
  }

  const task = await readTaskConfig(name);
  if (!task) {
    console.error(`Task "${name}" not found.`);
    process.exit(1);
  }

  const log = logPath(name);

  // Ensure log file exists for tail
  await Bun.write(
    log,
    await Bun.file(log)
      .text()
      .catch(() => ""),
    {
      createPath: true,
    },
  );

  console.log(`Kicking start ${name}...`);
  await kickstart(name);
  console.log(`Started. Tailing log (Ctrl+C to stop):\n`);

  // tail -f the log file
  const tail = spawn("tail", ["-f", log], {
    stdio: ["ignore", "inherit", "inherit"],
  });

  process.on("SIGINT", () => {
    tail.kill();
    process.exit(0);
  });

  await new Promise<void>((resolve) => {
    tail.on("close", () => resolve());
  });
}
