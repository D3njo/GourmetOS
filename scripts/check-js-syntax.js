#!/usr/bin/env node
/**
 * Syntax-check every JS file under js/ (including ui/).
 * Run: node scripts/check-js-syntax.js
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

const files = walk(JS_DIR).sort();
if (!files.length) {
  console.error('check-js-syntax: no JS files found');
  process.exit(1);
}

for (const file of files) {
  execSync(`node --check "${file}"`, { stdio: 'inherit' });
}

console.log(`check-js-syntax: OK (${files.length} files)`);
