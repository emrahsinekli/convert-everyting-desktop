/**
 * Firebase License Key Generator
 *
 * Bu araç Firestore'a lisans anahtarları ekler.
 *
 * Kullanım:
 * 1. Firebase Admin SDK'yı kurun: npm install firebase-admin
 * 2. Firebase konsolundan service account key indirin
 * 3. Bu dosyayı çalıştırın: node tools/firebase-license-generator.js
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const readline = require('readline');

// Firebase Admin SDK initialization
// Service account key dosyanızın yolunu buraya girin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Generate a random license key (XXXX-XXXX-XXXX-XXXX format)
function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Karışıklığı önlemek için I, O, 0, 1 yok
  let key = '';

  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) {
      key += '-';
    }
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return key;
}

// Add license to Firestore
async function addLicense(options = {}) {
  const {
    licenseType = 'Standard',
    maxActivations = 1,
    expiresIn = null, // null = lifetime, or number of days
    customKey = null
  } = options;

  const licenseKey = customKey || generateLicenseKey();

  const licenseData = {
    licenseType,
    maxActivations,
    status: 'active',
    activatedMachines: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastActivatedAt: null
  };

  // Add expiration if specified
  if (expiresIn) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + expiresIn);
    licenseData.expiresAt = admin.firestore.Timestamp.fromDate(expirationDate);
  }

  try {
    await db.collection('licenses').doc(licenseKey).set(licenseData);
    console.log('\n✅ Lisans oluşturuldu!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔑 Anahtar: ${licenseKey}`);
    console.log(`📋 Tip: ${licenseType}`);
    console.log(`💻 Max Aktivasyon: ${maxActivations}`);
    console.log(`📅 Süre: ${expiresIn ? `${expiresIn} gün` : 'Ömür boyu'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return licenseKey;
  } catch (error) {
    console.error('❌ Hata:', error.message);
    return null;
  }
}

// List all licenses
async function listLicenses() {
  try {
    const snapshot = await db.collection('licenses').get();

    console.log('\n📋 Tüm Lisanslar:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    snapshot.forEach(doc => {
      const data = doc.data();
      const activations = data.activatedMachines?.length || 0;
      const maxAct = data.maxActivations || 1;
      const status = data.status;

      console.log(`🔑 ${doc.id}`);
      console.log(`   Tip: ${data.licenseType} | Durum: ${status} | Aktivasyon: ${activations}/${maxAct}`);
      console.log('');
    });

    console.log(`Toplam: ${snapshot.size} lisans`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Hata:', error.message);
  }
}

// Deactivate a license
async function deactivateLicense(licenseKey) {
  try {
    await db.collection('licenses').doc(licenseKey).update({
      status: 'deactivated'
    });
    console.log(`✅ Lisans devre dışı bırakıldı: ${licenseKey}`);
  } catch (error) {
    console.error('❌ Hata:', error.message);
  }
}

// Reset activations for a license
async function resetActivations(licenseKey) {
  try {
    await db.collection('licenses').doc(licenseKey).update({
      activatedMachines: []
    });
    console.log(`✅ Aktivasyonlar sıfırlandı: ${licenseKey}`);
  } catch (error) {
    console.error('❌ Hata:', error.message);
  }
}

// Interactive CLI
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (q) => new Promise(resolve => rl.question(q, resolve));

  console.log('\n🔐 Firebase Lisans Yönetimi');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  while (true) {
    console.log('1. Yeni lisans oluştur');
    console.log('2. Tüm lisansları listele');
    console.log('3. Lisansı devre dışı bırak');
    console.log('4. Aktivasyonları sıfırla');
    console.log('5. Toplu lisans oluştur');
    console.log('0. Çıkış\n');

    const choice = await question('Seçim: ');

    switch (choice) {
      case '1':
        const type = await question('Lisans tipi (Standard/Professional/Enterprise) [Standard]: ') || 'Standard';
        const maxAct = parseInt(await question('Max aktivasyon [1]: ')) || 1;
        const days = await question('Geçerlilik süresi (gün, boş bırak = ömür boyu): ');
        await addLicense({
          licenseType: type,
          maxActivations: maxAct,
          expiresIn: days ? parseInt(days) : null
        });
        break;

      case '2':
        await listLicenses();
        break;

      case '3':
        const keyToDeactivate = await question('Devre dışı bırakılacak lisans anahtarı: ');
        await deactivateLicense(keyToDeactivate.toUpperCase());
        break;

      case '4':
        const keyToReset = await question('Sıfırlanacak lisans anahtarı: ');
        await resetActivations(keyToReset.toUpperCase());
        break;

      case '5':
        const count = parseInt(await question('Kaç lisans oluşturulsun? ')) || 1;
        const batchType = await question('Lisans tipi [Standard]: ') || 'Standard';
        const batchMaxAct = parseInt(await question('Max aktivasyon [1]: ')) || 1;

        console.log(`\n${count} lisans oluşturuluyor...\n`);

        for (let i = 0; i < count; i++) {
          await addLicense({
            licenseType: batchType,
            maxActivations: batchMaxAct
          });
        }
        break;

      case '0':
        console.log('\n👋 Görüşürüz!\n');
        rl.close();
        process.exit(0);

      default:
        console.log('Geçersiz seçim!\n');
    }
  }
}

// Run
main().catch(console.error);
