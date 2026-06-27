const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { app } = require('electron');

// License management backed by Polar (https://polar.sh) License Keys API.
// Endpoints used:
//   POST /v1/license-keys/activate    -> create an activation instance for a key
//   POST /v1/license-keys/validate    -> verify a key (+ activation) is still valid
//   POST /v1/license-keys/deactivate  -> free up an activation seat
//
// Credentials are loaded from polar.config.json (bundled via extraResources)
// or from POLAR_* environment variables. The access token must be a Polar
// Organization Access Token scoped to license_keys (read + write).
class LicenseManager {
  constructor() {
    this.LICENSE_FILE = 'license.dat';
    this.SECRET_KEY = 'ConvertEverything2024SecretKey!@#$%';
    this.licenseData = null;
    this.config = this.loadPolarConfig();
  }

  // ============ CONFIG ============

  loadPolarConfig() {
    // Environment variables take precedence (handy for local testing)
    let cfg = {
      accessToken: process.env.POLAR_ACCESS_TOKEN || '',
      organizationId: process.env.POLAR_ORGANIZATION_ID || '',
      server: process.env.POLAR_SERVER || 'production'
    };

    const candidates = [
      path.join(process.resourcesPath || '', 'resources', 'polar.config.json'),
      path.join(process.resourcesPath || '', 'polar.config.json'),
      path.join(__dirname, '..', 'resources', 'polar.config.json')
    ];

    for (const p of candidates) {
      try {
        if (p && fs.existsSync(p)) {
          const file = JSON.parse(fs.readFileSync(p, 'utf8'));
          cfg = { ...cfg, ...file };
          break;
        }
      } catch (e) {
        // ignore malformed config, fall back to env
      }
    }

    return cfg;
  }

  isConfigured() {
    // Secure mode: the public customer-portal endpoints only need the org id
    // (no secret token shipped in the app).
    return Boolean(this.config.organizationId);
  }

  apiBase() {
    return this.config.server === 'sandbox'
      ? 'https://sandbox-api.polar.sh'
      : 'https://api.polar.sh';
  }

  // Minimal JSON POST helper (no extra dependencies)
  polarRequest(endpoint, body) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const url = new URL(this.apiBase() + endpoint);
      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      };
      // Public customer-portal endpoints need no auth; only attach a token if
      // one is explicitly configured (legacy/org-scoped mode).
      if (this.config.accessToken) headers['Authorization'] = `Bearer ${this.config.accessToken}`;
      const options = {
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname,
        headers
      };

      const req = https.request(options, (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let parsed = {};
          try { parsed = raw ? JSON.parse(raw) : {}; } catch (e) { parsed = {}; }
          resolve({ status: res.statusCode, body: parsed });
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  // ============ MACHINE FINGERPRINT ============

  getMachineId() {
    const os = require('os');
    const cpus = os.cpus();
    const networkInterfaces = os.networkInterfaces();

    let fingerprint = '';
    fingerprint += os.hostname();
    fingerprint += os.platform();
    fingerprint += os.arch();
    fingerprint += cpus[0]?.model || '';
    fingerprint += os.totalmem().toString();

    for (const iface of Object.values(networkInterfaces)) {
      for (const config of iface) {
        if (!config.internal && config.mac !== '00:00:00:00:00:00') {
          fingerprint += config.mac;
          break;
        }
      }
    }

    return crypto.createHash('sha256').update(fingerprint).digest('hex').substring(0, 16);
  }

  getSystemInfo() {
    const os = require('os');
    return {
      platform: os.platform(),
      osVersion: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      username: os.userInfo().username,
      language: app.getLocale()
    };
  }

  // ============ LOCAL ENCRYPTED STORAGE ============

  getLicenseFilePath() {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, this.LICENSE_FILE);
  }

  // Encryption key is derived from the secret AND this machine's fingerprint,
  // so an encrypted blob (license.dat / trial file) cannot be copied to another
  // Mac, and forging requires per-machine derivation. Online validation remains
  // the source of truth for whether a key is genuinely paid.
  cryptoKey() {
    const mid = this.getMachineId();
    return crypto.scryptSync(this.SECRET_KEY + ':' + mid, 'ce-' + mid, 32);
  }

  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.cryptoKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedText) {
    try {
      const [ivHex, encrypted] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.cryptoKey(), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      return null;
    }
  }

  saveLocalLicense(licenseKey, activationId) {
    const machineId = this.getMachineId();
    const data = {
      key: licenseKey,
      activationId: activationId || null,
      machineId,
      activatedAt: new Date().toISOString(),
      version: app.getVersion()
    };

    const encrypted = this.encrypt(JSON.stringify(data));
    const filePath = this.getLicenseFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, encrypted, 'utf8');
    this.licenseData = data;
    return true;
  }

  loadLicense() {
    const filePath = this.getLicenseFilePath();

    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'License not found' };
    }

    try {
      const encrypted = fs.readFileSync(filePath, 'utf8');
      const decrypted = this.decrypt(encrypted);

      if (!decrypted) {
        return { valid: false, error: 'License file is corrupted' };
      }

      const data = JSON.parse(decrypted);
      const currentMachineId = this.getMachineId();

      if (data.machineId !== currentMachineId) {
        return { valid: false, error: 'License is not valid for this computer' };
      }

      this.licenseData = data;
      return {
        valid: true,
        key: data.key,
        activationId: data.activationId,
        activatedAt: data.activatedAt
      };
    } catch (error) {
      return { valid: false, error: 'License verification error' };
    }
  }

  // ============ POLAR: ACTIVATION ============

  async activateLicenseOnline(key) {
    if (!this.isConfigured()) {
      return { valid: false, error: 'License system is not configured' };
    }

    const licenseKey = (key || '').trim().toUpperCase();
    const machineId = this.getMachineId();
    const sys = this.getSystemInfo();

    try {
      const res = await this.polarRequest('/v1/customer-portal/license-keys/activate', {
        key: licenseKey,
        organization_id: this.config.organizationId,
        label: `${sys.hostname} (${machineId})`,
        meta: {
          machineId,
          platform: sys.platform,
          arch: sys.arch,
          hostname: sys.hostname
        }
      });

      if (res.status === 200 || res.status === 201) {
        const activationId = res.body && res.body.id;
        this.saveLocalLicense(licenseKey, activationId);
        return {
          valid: true,
          licenseType: 'Standard',
          message: 'License activated successfully!'
        };
      }

      if (res.status === 404) {
        return { valid: false, error: 'Invalid license key' };
      }

      if (res.status === 403) {
        return { valid: false, error: 'This license has already been used on the maximum number of devices.' };
      }

      const detail = this.extractError(res.body);
      return { valid: false, error: detail || 'Activation failed' };
    } catch (error) {
      console.error('Polar activation error:', error);
      return { valid: false, error: 'Activation failed: could not reach the license server.' };
    }
  }

  // ============ POLAR: VALIDATION ============

  async verifyLicenseOnline(key, activationId) {
    if (!this.isConfigured()) {
      // If not configured, do not lock out an already-activated user
      return { valid: true, offline: true };
    }

    try {
      const body = {
        key: (key || '').trim().toUpperCase(),
        organization_id: this.config.organizationId
      };
      if (activationId) body.activation_id = activationId;

      const res = await this.polarRequest('/v1/customer-portal/license-keys/validate', body);

      if (res.status === 200) {
        const status = res.body && res.body.status;
        if (status && status !== 'granted') {
          return { valid: false, error: `License ${status}` };
        }
        return { valid: true, licenseType: 'Standard' };
      }

      if (res.status === 404 || res.status === 403) {
        return { valid: false, error: 'License is no longer valid for this device' };
      }

      // Unexpected status -> do not punish the user, keep them running
      return { valid: true, offline: true };
    } catch (error) {
      // Network error -> trust the local license (offline support)
      return { valid: true, offline: true };
    }
  }

  // ============ POLAR: DEACTIVATION ============

  async deactivateLicenseOnline() {
    const local = this.licenseData || (this.loadLicense().valid ? this.licenseData : null);
    if (!this.isConfigured() || !local || !local.activationId) {
      return { success: false };
    }

    try {
      await this.polarRequest('/v1/customer-portal/license-keys/deactivate', {
        key: local.key,
        organization_id: this.config.organizationId,
        activation_id: local.activationId
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============ LOCAL OPERATIONS ============

  removeLicense() {
    const filePath = this.getLicenseFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    this.licenseData = null;
    return true;
  }

  getLicenseInfo() {
    if (this.licenseData) {
      return {
        valid: true,
        key: this.maskKey(this.licenseData.key),
        activatedAt: this.licenseData.activatedAt
      };
    }
    return { valid: false };
  }

  extractError(body) {
    if (!body) return null;
    if (typeof body.detail === 'string') return body.detail;
    if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg;
    if (typeof body.error === 'string') return body.error;
    return null;
  }

  maskKey(key) {
    if (!key || key.length < 8) return '****';
    return `${key.slice(0, 4)}-****-${key.slice(-4)}`;
  }
}

module.exports = LicenseManager;
