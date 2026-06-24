const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function makeIco() {
  const pngToIcoModule = await import('png-to-ico');
  const pngToIco = pngToIcoModule.default;

  const src = 'C:/Users/emrah/Downloads/Gemini_Generated_Image_t8n9rvt8n9rvt8n9.png';

  if (!fs.existsSync(src)) {
    console.error('Source not found:', src);
    return;
  }

  console.log('Creating 256x256 PNG first...');

  // Create a clean 256x256 PNG
  const tempPng = path.join(__dirname, 'temp-icon-256.png');
  await sharp(src)
    .resize(256, 256, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(tempPng);

  console.log('Converting to ICO...');

  // Convert PNG to ICO
  const icoBuffer = await pngToIco(tempPng);
  fs.writeFileSync('public/icon.ico', icoBuffer);

  // Clean up temp file
  fs.unlinkSync(tempPng);

  console.log('ICO created successfully!');

  // Verify the ICO file
  const stats = fs.statSync('public/icon.ico');
  console.log('ICO file size:', stats.size, 'bytes');
}

makeIco().catch(console.error);
