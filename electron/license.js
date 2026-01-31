const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class LicenseManager {
  constructor() {
    // Secret key for license validation - CHANGE THIS TO YOUR OWN SECRET!
    this.SECRET_KEY = 'ConvertEverything2024SecretKey!@#$%';
    this.LICENSE_FILE = 'license.dat';
    this.licenseData = null;
  }

  // Get license file path
  getLicenseFilePath() {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, this.LICENSE_FILE);
  }

  // Generate machine ID (hardware fingerprint)
  getMachineId() {
    const os = require('os');
    const cpus = os.cpus();
    const networkInterfaces = os.networkInterfaces();

    // Create a fingerprint from hardware info
    let fingerprint = '';
    fingerprint += os.hostname();
    fingerprint += os.platform();
    fingerprint += os.arch();
    fingerprint += cpus[0]?.model || '';
    fingerprint += os.totalmem().toString();

    // Add first MAC address
    for (const iface of Object.values(networkInterfaces)) {
      for (const config of iface) {
        if (!config.internal && config.mac !== '00:00:00:00:00:00') {
          fingerprint += config.mac;
          break;
        }
      }
    }

    // Hash the fingerprint
    return crypto.createHash('sha256').update(fingerprint).digest('hex').substring(0, 16);
  }

  // Validate license key format (XXXX-XXXX-XXXX-XXXX)
  isValidFormat(key) {
    const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return pattern.test(key);
  }

  // Validate license key algorithm
  validateLicenseKey(key) {
    if (!this.isValidFormat(key)) {
      return { valid: false, error: 'Geçersiz lisans formatı' };
    }

    // Remove dashes
    const cleanKey = key.replace(/-/g, '');

    // Extract parts
    const part1 = cleanKey.substring(0, 4);
    const part2 = cleanKey.substring(4, 8);
    const part3 = cleanKey.substring(8, 12);
    const checksum = cleanKey.substring(12, 16);

    // Validate checksum
    const dataToHash = part1 + part2 + part3 + this.SECRET_KEY;
    const expectedChecksum = crypto
      .createHash('md5')
      .update(dataToHash)
      .digest('hex')
      .substring(0, 4)
      .toUpperCase();

    if (checksum !== expectedChecksum) {
      return { valid: false, error: 'Geçersiz lisans anahtarı' };
    }

    // Decode license type from part1
    const licenseTypes = {
      'STDX': 'Standard',
      'PROX': 'Professional',
      'ENTX': 'Enterprise',
      'ULTX': 'Ultimate'
    };

    const licenseType = licenseTypes[part1] || 'Standard';

    return {
      valid: true,
      licenseType,
      key
    };
  }

  // Encrypt data for storage
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.SECRET_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  // Decrypt stored data
  decrypt(encryptedText) {
    try {
      const [ivHex, encrypted] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const key = crypto.scryptSync(this.SECRET_KEY, 'salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      return null;
    }
  }

  // Save license to file
  saveLicense(licenseKey) {
    const machineId = this.getMachineId();
    const data = {
      key: licenseKey,
      machineId,
      activatedAt: new Date().toISOString(),
      version: app.getVersion()
    };

    const encrypted = this.encrypt(JSON.stringify(data));
    const filePath = this.getLicenseFilePath();

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, encrypted, 'utf8');
    this.licenseData = data;

    return true;
  }

  // Load and verify saved license
  loadLicense() {
    const filePath = this.getLicenseFilePath();

    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'Lisans bulunamadı' };
    }

    try {
      const encrypted = fs.readFileSync(filePath, 'utf8');
      const decrypted = this.decrypt(encrypted);

      if (!decrypted) {
        return { valid: false, error: 'License file is corrupted' };
      }

      const data = JSON.parse(decrypted);

      // Verify machine ID (optional - remove this check if you don't want machine-locked licenses)
      const currentMachineId = this.getMachineId();
      if (data.machineId !== currentMachineId) {
        return { valid: false, error: 'License is not valid for this computer' };
      }

      // Verify the key is still valid
      const validation = this.validateLicenseKey(data.key);
      if (!validation.valid) {
        return validation;
      }

      this.licenseData = data;
      return {
        valid: true,
        licenseType: validation.licenseType,
        key: data.key,
        activatedAt: data.activatedAt
      };
    } catch (error) {
      return { valid: false, error: 'License verification error' };
    }
  }

  // Activate license with a new key
  activateLicense(key) {
    // Validate the key
    const validation = this.validateLicenseKey(key);

    if (!validation.valid) {
      return validation;
    }

    // Save the license
    try {
      this.saveLicense(key);
      return {
        valid: true,
        licenseType: validation.licenseType,
        message: 'Lisans başarıyla etkinleştirildi!'
      };
    } catch (error) {
      return { valid: false, error: 'Lisans kaydedilemedi: ' + error.message };
    }
  }

  // Remove license (for deactivation)
  removeLicense() {
    const filePath = this.getLicenseFilePath();

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    this.licenseData = null;
    return true;
  }

  // Get current license info
  getLicenseInfo() {
    if (this.licenseData) {
      const validation = this.validateLicenseKey(this.licenseData.key);
      return {
        valid: true,
        licenseType: validation.licenseType,
        key: this.maskKey(this.licenseData.key),
        activatedAt: this.licenseData.activatedAt
      };
    }
    return { valid: false };
  }

  // Mask license key for display (XXXX-****-****-XXXX)
  maskKey(key) {
    const parts = key.split('-');
    return `${parts[0]}-****-****-${parts[3]}`;
  }
}

module.exports = LicenseManager;
