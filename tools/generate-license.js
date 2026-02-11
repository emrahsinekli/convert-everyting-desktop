/**
 * LICENSE KEY GENERATOR
 * =====================
 * Bu script sadece geliştirici tarafından kullanılmalıdır!
 * Dağıtılan uygulamaya dahil ETMEYİN!
 *
 * Kullanım:
 *   node tools/generate-license.js [tip]
 *
 * Tipler:
 *   STDX - Standard
 *   PROX - Professional
 *   ENTX - Enterprise
 *   ULTX - Ultimate
 *
 * Örnek:
 *   node tools/generate-license.js PROX
 */

const crypto = require('crypto');

// SECRET KEY - Bu electron/license.js dosyasındaki ile AYNI olmalı!
const SECRET_KEY = 'ConvertEverything2024SecretKey!@#$%';

// License types
const LICENSE_TYPES = {
  'STDX': 'Standard',
  'PROX': 'Professional',
  'ENTX': 'Enterprise',
  'ULTX': 'Ultimate'
};

// Generate random alphanumeric string
function randomAlphanumeric(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate a valid license key
function generateLicenseKey(type = 'STDX') {
  // Validate license type
  if (!LICENSE_TYPES[type]) {
    console.error(`Geçersiz lisans tipi: ${type}`);
    console.error('Geçerli tipler:', Object.keys(LICENSE_TYPES).join(', '));
    process.exit(1);
  }

  // Part 1: License type identifier
  const part1 = type;

  // Part 2 & 3: Random data
  const part2 = randomAlphanumeric(4);
  const part3 = randomAlphanumeric(4);

  // Part 4: Checksum (first 4 chars of MD5 hash)
  const dataToHash = part1 + part2 + part3 + SECRET_KEY;
  const checksum = crypto
    .createHash('md5')
    .update(dataToHash)
    .digest('hex')
    .substring(0, 4)
    .toUpperCase();

  // Format: XXXX-XXXX-XXXX-XXXX
  const licenseKey = `${part1}-${part2}-${part3}-${checksum}`;

  return {
    key: licenseKey,
    type: LICENSE_TYPES[type],
    generatedAt: new Date().toISOString()
  };
}

// Validate a license key (for testing)
function validateLicenseKey(key) {
  const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  if (!pattern.test(key)) {
    return { valid: false, error: 'Geçersiz format' };
  }

  const cleanKey = key.replace(/-/g, '');
  const part1 = cleanKey.substring(0, 4);
  const part2 = cleanKey.substring(4, 8);
  const part3 = cleanKey.substring(8, 12);
  const checksum = cleanKey.substring(12, 16);

  const dataToHash = part1 + part2 + part3 + SECRET_KEY;
  const expectedChecksum = crypto
    .createHash('md5')
    .update(dataToHash)
    .digest('hex')
    .substring(0, 4)
    .toUpperCase();

  if (checksum !== expectedChecksum) {
    return { valid: false, error: 'Geçersiz checksum' };
  }

  return {
    valid: true,
    type: LICENSE_TYPES[part1] || 'Unknown'
  };
}

// Generate multiple keys
function generateMultipleKeys(type, count) {
  const keys = [];
  for (let i = 0; i < count; i++) {
    keys.push(generateLicenseKey(type));
  }
  return keys;
}

// Main execution
const args = process.argv.slice(2);
const licenseType = args[0] || 'STDX';
const count = parseInt(args[1]) || 1;

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║            LICENSE KEY GENERATOR                           ║');
console.log('║            Convert Everything to Everything                ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

if (count === 1) {
  const license = generateLicenseKey(licenseType);
  console.log(`Lisans Tipi: ${license.type}`);
  console.log(`Oluşturma Tarihi: ${license.generatedAt}`);
  console.log('');
  console.log('┌────────────────────────────────────────┐');
  console.log(`│  ${license.key}  │`);
  console.log('└────────────────────────────────────────┘');
  console.log('');

  // Validate to confirm
  const validation = validateLicenseKey(license.key);
  console.log(`Doğrulama: ${validation.valid ? '✓ Geçerli' : '✗ Geçersiz'}`);
} else {
  console.log(`${count} adet ${LICENSE_TYPES[licenseType]} lisansı oluşturuluyor...\n`);

  const keys = generateMultipleKeys(licenseType, count);
  keys.forEach((license, index) => {
    console.log(`${index + 1}. ${license.key}`);
  });

  console.log('\n--- CSV Format ---');
  console.log('Key,Type,GeneratedAt');
  keys.forEach(license => {
    console.log(`${license.key},${license.type},${license.generatedAt}`);
  });
}

console.log('');
console.log('⚠️  Bu anahtarları güvenli bir yerde saklayın!');
console.log('⚠️  Bu script\'i dağıtılan uygulamaya dahil ETMEYİN!');
console.log('');
