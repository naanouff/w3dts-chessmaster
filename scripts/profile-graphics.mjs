/**
 * Launches the graphics bench, one window size at a time, and writes tmp/graphics-bench.json.
 * Sizes match GRAPHICS_BENCH_WINDOWS and GRAPHICS_MOTION_WINDOWS.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronVite = path.join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js');

const REST = [
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
  [3440, 1440],
  [3840, 2160],
];
const MOTION = [
  [1920, 1080],
  [3440, 1440],
  [3840, 2160],
];

function portBusy(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, '127.0.0.1');
  });
}

if (await portBusy(5173)) {
  process.stderr.write('Port 5173 is already in use. Close the running client, then run the bench.\n');
  process.exit(1);
}

function killTree(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  child.kill();
}

function launch(width, height, pass) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [electronVite, 'dev'], {
      cwd: root,
      env: {
        ...process.env,
        CHESS_GRAPHICS_BENCH: '1',
        CHESS_BENCH_WIDTH: String(width),
        CHESS_BENCH_HEIGHT: String(height),
        CHESS_BENCH_PASS: pass,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let buffer = '';
    let done = false;
    let report = null;
    const timer = setTimeout(() => fail(new Error(`bench timed out at ${width}x${height} ${pass}`)), 50 * 60 * 1000);
    let killTimer;
    const fail = (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      killTree(child);
      reject(error);
    };
    const succeed = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      resolve(report);
    };
    const take = (chunk) => {
      const text = chunk.toString();
      buffer += text;
      if (/\[renderer\]|\[bench\]|GPU /.test(text)) process.stderr.write(text);
      const start = buffer.indexOf('GRAPHICS_BENCH ');
      if (start < 0 || report) return;
      const end = buffer.indexOf('\n', start);
      if (end < 0) return;
      try {
        report = JSON.parse(buffer.slice(start + 'GRAPHICS_BENCH '.length, end));
        killTimer = setTimeout(() => killTree(child), 8000);
      } catch (error) {
        fail(error);
      }
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('exit', (code) => {
      if (report) succeed();
      else {
        const lines = buffer.split(/\r?\n/).filter((line) => /GPU |\[bench\]|\[renderer\]|ERROR:/.test(line));
        const detail = lines.slice(-12).join('\n');
        fail(new Error(detail || `bench exited before a report (${code ?? 'no code'})`));
      }
    });
  });
}

async function pause() {
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

async function measureWindow(width, height, pass) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const report = await launch(width, height, pass);
      if (report.stopped !== 'unready' || attempt === 2) return report;
      process.stderr.write(`retry ${width}x${height} ${pass} (clock not live)\n`);
    } catch (error) {
      if (attempt === 2) throw error;
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`retry ${width}x${height} ${pass}\n${message}\n`);
    }
    await pause();
  }
  throw new Error(`bench failed at ${width}x${height} ${pass}`);
}

try {
  await run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

async function run() {
  const windows = [];
  let stopped = null;
  for (const [width, height] of REST) {
    process.stderr.write(`rest ${width}x${height}\n`);
    const report = await measureWindow(width, height, 'rest');
    windows.push({ pass: 'rest', ...report });
    process.stderr.write(`  fluid ${report.fluidMs} quality ${report.qualityMs}\n`);
    if (report.stopped === 'vsync' || report.stopped === 'unready') {
      stopped = report.stopped;
      break;
    }
    await pause();
  }
  const motion = [];
  if (!stopped) {
    for (const [width, height] of MOTION) {
      process.stderr.write(`motion ${width}x${height}\n`);
      motion.push(await measureWindow(width, height, 'motion'));
      await pause();
    }
  }

  mkdirSync(path.join(root, 'tmp'), { recursive: true });
  const out = path.join(root, 'tmp', 'graphics-bench.json');
  writeFileSync(out, JSON.stringify({ stopped, windows, motion }, null, 2));
  process.stderr.write(`${out}\n`);
  if (stopped) process.exitCode = 2;
}
