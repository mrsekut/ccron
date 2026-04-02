import { listTaskConfigs } from "../config";
import { listOne } from "../launchd";

export async function listCommand(_args: string[]): Promise<void> {
  const tasks = await listTaskConfigs();

  if (tasks.length === 0) {
    console.log("No tasks registered. Use `ccron add` to create one.");
    return;
  }

  // Header
  const nameW = Math.max(4, ...tasks.map((t) => t.name.length));
  const schedW = Math.max(8, ...tasks.map((t) => t.schedule.length));

  const header = [
    "NAME".padEnd(nameW),
    "SCHEDULE".padEnd(schedW),
    "STATUS".padEnd(10),
    "LAST EXIT",
  ].join("  ");

  console.log(header);
  console.log("-".repeat(header.length));

  for (const task of tasks) {
    const status = await listOne(task.name);
    const statusStr = status ? "active" : "not loaded";
    const exitStr =
      status?.lastExitStatus !== null && status?.lastExitStatus !== undefined
        ? String(status.lastExitStatus)
        : "-";

    console.log(
      [
        task.name.padEnd(nameW),
        task.schedule.padEnd(schedW),
        statusStr.padEnd(10),
        exitStr,
      ].join("  "),
    );
  }
}
