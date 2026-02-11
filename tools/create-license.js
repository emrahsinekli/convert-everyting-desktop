/**
 * Bulk License Generator
 * Creates 1000 licenses in Firebase Firestore using Firebase Client SDK
 *
 * Usage: node tools/create-license.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, writeBatch, Timestamp } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDfxjpRE05LyLtb9bfs0kazYP648lfyMxQ",
  authDomain: "convert-everyting.firebaseapp.com",
  projectId: "convert-everyting",
  storageBucket: "convert-everyting.firebasestorage.app",
  messagingSenderId: "716931296951",
  appId: "1:716931296951:web:64c38f4a31869fe9edea72"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Generate license key (XXXX-XXXX-XXXX-XXXX format)
function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let key = '';

  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) {
      key += '-';
    }
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return key;
}

// Create bulk licenses
async function createBulkLicenses(count = 1000) {
  console.log(`\nCreating ${count} licenses...\n`);

  const licenses = [];
  const createdAt = Timestamp.now();

  // Batch write (Firestore max 500 per batch)
  const batchSize = 500;
  let successCount = 0;

  for (let batchStart = 0; batchStart < count; batchStart += batchSize) {
    const batch = writeBatch(db);
    const currentBatchSize = Math.min(batchSize, count - batchStart);

    for (let i = 0; i < currentBatchSize; i++) {
      const licenseKey = generateLicenseKey();

      const licenseData = {
        isUsed: false,           // Not used
        usedBy: null,            // Who used it (machine ID)
        usedAt: null,            // When it was used
        createdAt: createdAt
      };

      const docRef = doc(db, 'licenses', licenseKey);
      batch.set(docRef, licenseData);
      licenses.push(licenseKey);
    }

    try {
      await batch.commit();
      successCount += currentBatchSize;
      console.log(`Progress: ${successCount}/${count} licenses created`);
    } catch (error) {
      console.error(`Batch error (${batchStart}-${batchStart + currentBatchSize}):`, error.message);
    }
  }

  return licenses;
}

// Main function
async function main() {
  console.log('\n========================================');
  console.log('   BULK LICENSE GENERATOR');
  console.log('========================================\n');

  const startTime = Date.now();

  // Create 1000 licenses
  const licenses = await createBulkLicenses(1000);

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Save licenses to file
  const outputFile = path.join(__dirname, 'licenses.txt');
  fs.writeFileSync(outputFile, licenses.join('\n'), 'utf8');

  console.log('\n========================================');
  console.log('   COMPLETED!');
  console.log('========================================');
  console.log(`   Total: ${licenses.length} licenses`);
  console.log(`   Duration: ${duration} seconds`);
  console.log(`   File: ${outputFile}`);
  console.log('========================================\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
