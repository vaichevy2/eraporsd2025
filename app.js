/* --- JAVASCRIPT LOGIC --- */
const DB_NAME = "RaporDeepLearningDB";
const DB_VERSION = 7;

// STATE MANAGEMENT
const appState = {
    siswa: {
        currentPage: 1,
        rowsPerPage: 10
    },
    guru: {
        currentPage: 1,
        rowsPerPage: 10
    }
};

// ======================== FIXED INDEXEDDB STORAGE ==========================

// Daftar tabel yang hanya boleh punya 1 baris data (single entry)
const SINGLE_ENTRY_STORES = ['sekolah', 'utility', 'dimensi', 'kaih'];

// Variabel internal untuk menyimpan instance koneksi
let dbInstance = null;

const db = {
    listeners: {},

    // Initialize Database
    init: () => {
        return new Promise((resolve, reject) => {
            // 1. Cek apakah sudah terkoneksi sebelumnya (Idempotency check)
            if (dbInstance) {
                resolve(dbInstance);
                return;
            }

            // 2. Cek dukungan browser
            if (!window.indexedDB) {
                reject("Browser tidak mendukung IndexedDB");
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const upgradeDb = e.target.result;

                const stores = [
                    'sekolah', 'utility', 'students', 'teachers', 'subject_teachers',
                    'mapel', 'cptp', 'dimensi', 'kaih', 'nilai', 'ekskul',
                    'student_ekskul', 'kokurikuler', 'tema_ekskul', 'tema_kokurikuler', 'admins',
                    'kelompok_kokurikuler', 'siswa_kelompok_kokurikuler'
                ];

                stores.forEach(s => {
                    // Cek apakah store sudah ada menggunakan objectStoreNames
                    if (!upgradeDb.objectStoreNames.contains(s)){
                        // Tentukan apakah autoIncrement aktif atau tidak
                        // Jika termasuk single entry, autoIncrement false (kita set ID manual jadi 1)
                        const isSingleEntry = SINGLE_ENTRY_STORES.includes(s);
                        const auto = !isSingleEntry;

                        upgradeDb.createObjectStore(s, { keyPath: 'id', autoIncrement: auto });
                    }
                });
            };

            request.onsuccess = (e) => {
                dbInstance = e.target.result;
                resolve(dbInstance);
            };

            request.onerror = (e) => reject("DB Error: " + e.target.error);
        });
    },

    // Subscribe listener
    // Mengembalikan fungsi unsubscribe untuk pembersihan memori
    subscribe: (storeName, callback) => {
        if (!db.listeners[storeName]) db.listeners[storeName] = [];
        db.listeners[storeName].push(callback);

        // Return unsubscribe function
        return () => {
            db.listeners[storeName] = db.listeners[storeName].filter(cb => cb !== callback);
        };
    },

    notify: (storeName) => {
        if (db.listeners[storeName]) {
            db.listeners[storeName].forEach(cb => cb());
        }
    },

    // Save data
    saveTo: (storeName, data) => {
        return new Promise((resolve, reject) => {
            if (!dbInstance) return reject("Database belum di-init!");

            try {
                const tx = dbInstance.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);

                // Logic ID statis untuk tabel single entry (sekolah, utility, dll)
                // Menggunakan konstanta SINGLE_ENTRY_STORES yang sudah didefinisikan di atas
                if (SINGLE_ENTRY_STORES.includes(storeName) && !data.id) {
                    data.id = 1;
                }

                const req = store.put(data);

                req.onerror = (e) => reject("Save error: " + e.target.error);
                req.onsuccess = () => resolve(true);

                // Notifikasi dijalankan setelah transaksi benar-benar selesai (committed)
                tx.oncomplete = () => db.notify(storeName);
            } catch (err) {
                reject(err.message);
            }
        });
    },

    // Get data
    get: (storeName, id) => {
        return new Promise((resolve, reject) => {
            if (!dbInstance) return reject("Database belum di-init!");

            try {
                const tx = dbInstance.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);

                // Ambil satu data jika ID ada, atau ambil semua jika tidak
                const req = (id !== undefined && id !== null) ? store.get(id) : store.getAll();

                req.onerror = (e) => reject("DB Read Error: " + e.target.error);
                req.onsuccess = () => resolve(req.result);
            } catch (err) {
                reject(err.message);
            }
        });
    },

    // Delete
    delete: (storeName, id) => {
        return new Promise((resolve, reject) => {
            if (!dbInstance) return reject("Database belum di-init!");

            try {
                const tx = dbInstance.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const req = store.delete(id);

                req.onerror = (e) => reject("Delete error: " + e.target.error);
                req.onsuccess = () => resolve(true);
                tx.oncomplete = () => db.notify(storeName);
            } catch (err) {
                reject(err.message);
            }
        });
    },

    // Clear store
    clear: (storeName) => {
        return new Promise((resolve, reject) => {
            if (!dbInstance) return reject("Database belum di-init!");

            try {
                const tx = dbInstance.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const req = store.clear();

                req.onerror = (e) => reject("Clear error: " + e.target.error);
                req.onsuccess = () => resolve(true);
                tx.oncomplete = () => db.notify(storeName);
            } catch (err) {
                reject(err.message);
            }
        });
    }
};

const app = {
    currentUser: null,
    // Date helpers: format to "dd mmmm yyyy" and normalize various inputs to ISO (yyyy-mm-dd)
    formatDateLong: (isoOrVal) => {
        if (!isoOrVal) return '';
        try {
            let d = isoOrVal;
            if (typeof d === 'string') {
                // If it's already ISO-like (yyyy-mm-dd), parse directly
                if (/^\d{4}-\d{2}-\d{2}$/.test(d)) d = new Date(d + 'T00:00:00');
                else {
                    const parsed = Date.parse(d);
                    if (!isNaN(parsed)) d = new Date(parsed);
                    else return isoOrVal; // return original if cannot parse
                }
            }
            if (d instanceof Date && !isNaN(d)) {
                const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                const day = d.getDate().toString().padStart(2, '0');
                const month = months[d.getMonth()];
                const year = d.getFullYear();
                return `${day} ${month} ${year}`;
            }
            return isoOrVal;
        } catch (err) {
            return isoOrVal;
        }
    },
    normalizeToISO: (dateInput) => {
        if (!dateInput) return '';
        try {
            let d = dateInput;
            if (typeof d === 'string') {
                if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
                const parsed = Date.parse(d);
                if (!isNaN(parsed)) d = new Date(parsed);
                else return dateInput;
            }
            if (d instanceof Date && !isNaN(d)) {
                const year = d.getFullYear();
                const month = (d.getMonth() + 1).toString().padStart(2, '0');
                const day = d.getDate().toString().padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            return dateInput;
        } catch (err) {
            return dateInput;
        }
    }
}
