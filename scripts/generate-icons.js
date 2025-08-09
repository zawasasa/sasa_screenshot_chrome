'use strict';

// Node.js script to generate Chrome extension icons from assets/icon.svg
// Requires: sharp

const fs = require('fs');
const path = require('path');

async function main() {
  const sharp = require('sharp');

  const projectRoot = path.resolve(__dirname, '..');
  const srcSvg = path.join(projectRoot, 'assets', 'icon.svg');
  const outDir = path.join(projectRoot, 'icons');

  if (!fs.existsSync(srcSvg)) {
    console.error('Missing assets/icon.svg');
    process.exit(1);
  }
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const sizes = [16, 32, 48, 128];
  await Promise.all(
    sizes.map(size =>
      sharp(srcSvg)
        .resize(size, size, { fit: 'cover' })
        .png({ compressionLevel: 9 })
        .toFile(path.join(outDir, `icon${size}.png`))
    )
  );

  console.log('Generated icons:', sizes.map(s => `icons/icon${s}.png`).join(', '));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


