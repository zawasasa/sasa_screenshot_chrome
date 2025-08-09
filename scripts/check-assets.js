'use strict';

const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(projectRoot, 'manifest.json');

if (!fs.existsSync(manifestPath)) fail('manifest.json not found');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Check icons referenced in manifest
const iconMap = (manifest.icons) || {};
const expectedSizes = [16, 32, 48, 128];
for (const size of expectedSizes) {
  const rel = iconMap[String(size)];
  if (!rel) fail(`manifest.icons missing size ${size}`);
  const full = path.join(projectRoot, rel);
  if (!fs.existsSync(full)) fail(`icon file missing: ${rel}`);
}

// Check action default_icon presence
if (!manifest.action || !manifest.action.default_icon) {
  fail('manifest.action.default_icon is missing');
} else {
  for (const key of Object.keys(manifest.action.default_icon)) {
    const rel = manifest.action.default_icon[key];
    const full = path.join(projectRoot, rel);
    if (!fs.existsSync(full)) fail(`action default_icon missing: ${rel}`);
  }
}

console.log('Assets check OK');


