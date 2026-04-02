import {
	readTaskConfig,
	scriptPath,
	plistPath,
	logPath,
	taskConfigPath,
	mcpConfigPath,
} from "../config";
import { listOne } from "../launchd";

export async function showCommand(args: string[]): Promise<void> {
	if (args.includes("--help") || args.includes("-h")) {
		console.log(`ccron show - Show detailed information about a task

Usage: ccron show <name>

Displays task configuration, launchd status, and file locations.`);
		return;
	}

	const name = args[0];
	if (!name) {
		console.error("Task name is required. Usage: ccron show <name>");
		process.exit(1);
	}

	const task = await readTaskConfig(name);
	if (!task) {
		console.error(`Task "${name}" not found.`);
		process.exit(1);
	}

	const status = await listOne(name);
	const statusStr = status
		? status.pid
			? `active (pid: ${status.pid})`
			: "active (pid: idle)"
		: "not loaded";
	const exitStr =
		status?.lastExitStatus !== null && status?.lastExitStatus !== undefined
			? String(status.lastExitStatus)
			: "-";

	const promptDisplay = task.promptFile
		? `(file) ${task.promptFile}`
		: task.prompt && task.prompt.length > 80
			? task.prompt.slice(0, 80) + "..."
			: (task.prompt ?? "(none)");

	const lines = [
		`Name:       ${task.name}`,
		`Schedule:   ${task.schedule}`,
		`Prompt:     ${promptDisplay}`,
		`MCP:        ${task.mcp.length > 0 ? task.mcp.join(", ") : "(none)"}`,
		`Tools:      ${task.allowedTools.length > 0 ? task.allowedTools.join(", ") : "(none)"}`,
		`Max turns:  ${task.maxTurns ?? "(default)"}`,
		`Status:     ${statusStr}`,
		`Last exit:  ${exitStr}`,
		`Created:    ${formatDate(task.createdAt)}`,
		`Updated:    ${formatDate(task.updatedAt)}`,
		``,
		`Files:`,
		`  Config:   ${shorten(taskConfigPath(name))}`,
		`  Script:   ${shorten(scriptPath(name))}`,
		`  Plist:    ${shorten(plistPath(name))}`,
		`  Log:      ${shorten(logPath(name))}`,
	];

	if (task.mcp.length > 0) {
		lines.push(`  MCP:      ${shorten(mcpConfigPath(name))}`);
	}

	console.log(lines.join("\n"));
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleString("ja-JP", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
	});
}

function shorten(path: string): string {
	const home = process.env["HOME"] ?? "";
	return home && path.startsWith(home) ? "~" + path.slice(home.length) : path;
}
