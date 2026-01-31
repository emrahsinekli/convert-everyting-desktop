#!/usr/bin/env node

// This script unsets ELECTRON_RUN_AS_NODE before running Electron
// Required because something in the system sets this variable

const { spawn } = require('child_process');
const path = require('path');

// Remove ELECTRON_RUN_AS_NODE from environment
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

// Set the start URL
env.ELECTRON_START_URL = process.env.ELECTRON_START_URL || 'http://localhost:3000';

// Find electron binary
const electronPath = require('electron');

console.log('Starting Electron with ELECTRON_RUN_AS_NODE unset...');

// Spawn electron
const child = spawn(electronPath, ['.'], {
  cwd: path.join(__dirname),
  env: env,
  stdio: 'inherit'
});

child.on('error', (err) => {
  console.error('Failed to start Electron:', err);
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code);
});
