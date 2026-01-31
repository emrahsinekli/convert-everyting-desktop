// Firebase Configuration
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDfxjpRE05LyLtb9bfs0kazYP648lfyMxQ",
  authDomain: "convert-everyting.firebaseapp.com",
  projectId: "convert-everyting",
  storageBucket: "convert-everyting.firebasestorage.app",
  messagingSenderId: "675614118265",
  appId: "1:675614118265:web:4ce84a44a1ccc8e8bcdfa8",
  measurementId: "G-74VBSSPFJ5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

export { app, db };
