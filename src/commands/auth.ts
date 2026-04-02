import { readTaskConfig, mcpConfigPath } from '../config';
import { spawn } from 'child_process';

export async function authCommand(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`cccron auth - Re-authenticate MCP servers for a task

Usage: cccron auth <name>

Opens an interactive claude session with the task's MCP config, allowing
you to complete OAuth flows for MCP servers (Slack, Linear, etc.).
The session runs from /tmp to avoid git repo issues.

Exit claude after authentication is complete.

Example:
  cccron auth daily-summary`);
    return;
  }

  const name = args[0];
  if (!name) {
    console.error('Usage: cccron auth <name>');
    process.exit(1);
  }

  const task = await readTaskConfig(name);
  if (!task) {
    console.error(`Task "${name}" not found.`);
    process.exit(1);
  }

  if (task.mcp.length === 0) {
    console.log(`Task "${name}" has no MCP servers configured.`);
    return;
  }

  const mcpConfig = mcpConfigPath(name);
  if (!(await Bun.file(mcpConfig).exists())) {
    console.error(`MCP config not found: ${mcpConfig}`);
    console.error(
      `Re-register with: cccron add --name ${name} --mcp ${task.mcp.join(',')}`,
    );
    process.exit(1);
  }

  console.log(`Opening claude with MCP config for "${name}"...`);
  console.log(`MCP servers: ${task.mcp.join(', ')}`);
  console.log(`Complete the authentication flow, then exit claude.\n`);

  const child = spawn('claude', ['--mcp-config', mcpConfig], {
    cwd: '/tmp',
    stdio: 'inherit',
  });

  await new Promise<void>((resolve, reject) => {
    child.on('close', code => {
      if (code === 0) {
        console.log(`\nAuthentication complete for "${name}".`);
        resolve();
      } else {
        reject(new Error(`claude exited with code ${code}`));
      }
    });
    child.on('error', reject);
  });
}
