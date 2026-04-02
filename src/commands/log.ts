import { readTaskConfig, logPath } from '../config';
import { spawn } from 'child_process';

export async function logCommand(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`ccron log - Show task execution logs

Usage: ccron log <name> [--follow]

Options:
  --follow, -f   Tail the log in real-time (Ctrl+C to stop)

Without --follow, shows the last 50 lines of the log.

Log location: ~/.local/share/ccron/logs/<name>.log

Examples:
  ccron log daily-summary
  ccron log daily-summary --follow`);
    return;
  }

  const name = args.find(a => !a.startsWith('-'));
  const follow = args.includes('--follow') || args.includes('-f');

  if (!name) {
    console.error('Usage: ccron log <name> [--follow]');
    process.exit(1);
  }

  const task = await readTaskConfig(name);
  if (!task) {
    console.error(`Task "${name}" not found.`);
    process.exit(1);
  }

  const log = logPath(name);
  const file = Bun.file(log);

  if (!(await file.exists())) {
    console.log(`No logs yet for "${name}".`);
    return;
  }

  if (follow) {
    const tail = spawn('tail', ['-f', log], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    process.on('SIGINT', () => {
      tail.kill();
      process.exit(0);
    });
    await new Promise<void>(resolve => {
      tail.on('close', () => resolve());
    });
  } else {
    // Show last 50 lines
    const result = await Bun.$`tail -50 ${log}`.quiet();
    console.log(result.stdout.toString());
  }
}
