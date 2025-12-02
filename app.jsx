// firebase.js
// Konfigurasi Firebase diambil dari environment variable __firebase_config
// Pastikan environment diset sebelum menjalankan aplikasi

import { initializeApp } from "firebase/app";

// Ambil config dari environment
const firebaseConfig = window.__firebase_config || {};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Tambahan layanan Firebase\ nimport { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";


// Inisialisasi layanan
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);


export default app;
