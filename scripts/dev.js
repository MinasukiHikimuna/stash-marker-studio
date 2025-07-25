#!/usr/bin/env node

import { spawn } from 'child_process';
import { platform } from 'os';

const buildDir = process.argv[2] || '.next-dev';
const isWindows = platform() === 'win32';

// Set environment variable and run next dev
const env = { ...process.env, BUILD_DIR: buildDir };

const command = isWindows ? 'next.cmd' : 'next';
const args = ['dev'];

const child = spawn(command, args, {
  env,
  stdio: 'inherit',
  shell: isWindows
});

child.on('exit', (code) => {
  process.exit(code);
});