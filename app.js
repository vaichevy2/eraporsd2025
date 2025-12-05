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

// ======================== SQLITE INTEGRATION ==========================

// SQLite database instances (in-memory)
let sqliteDBs = {};

// Test connection to SQLite files
async function testSQLiteConnection() {
    try {
        const response = await fetch('sqlite/students.sqlite');
        if (!response.ok) {
            console.warn('SQLite file not found or not accessible');
            return false;
        }
        const buffer = await response.arrayBuffer();
        const SQL = await initSqlJs({ locateFile: file => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/sql-wasm.wasm' });
        const db = new SQL.Database(new Uint8Array(buffer));
        console.log('SQLite connection test successful');
        return true;
    } catch (e) {
        console.error('SQLite connection test failed:', e);
        return false;
    }
}

// Load SQLite file into memory
async function loadSQLiteFile(filename) {
    try {
        const response = await fetch(`sqlite/${filename}`);
        if (!response.ok) {
            console.warn(`SQLite file ${filename} not found`);
            return null;
        }
        const buffer = await response.arrayBuffer();
        const SQL = await initSqlJs({ locateFile: file => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/sql-wasm.wasm' });
        const db = new SQL.Database(new Uint8Array(buffer));
        sqliteDBs[filename] = db;
        console.log(`Loaded SQLite file: ${filename}`);
        return db;
    } catch (e) {
        console.error(`Failed to load SQLite file ${filename}:`, e);
        return null;
    }
}

// Save SQLite database back to server
async function saveSQLiteFile(filename, db) {
    try {
        const binaryArray = db.export();
        const blob = new Blob([binaryArray], { type: 'application/x-sqlite3' });

        const formData = new FormData();
        formData.append('file', blob, filename);
        formData.append('filename', filename);

        const response = await fetch('save_sqlite_to_folder.php', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (result.success) {
            console.log(`Saved SQLite file: ${filename}`);
            return true;
        } else {
            console.error('Failed to save SQLite file:', result.error);
            return false;
        }
    } catch (e) {
        console.error(`Failed to save SQLite file ${filename}:`, e);
        return false;
    }
}

// Execute SQL query on SQLite database
function executeSQLiteQuery(filename, sql, params = []) {
    const db = sqliteDBs[filename];
    if (!db) {
        console.error(`SQLite database ${filename} not loaded`);
        return null;
    }
    try {
        const result = db.exec(sql, params);
        return result;
    } catch (e) {
        console.error(`SQL execution error on ${filename}:`, e);
        return null;
    }
}

// Get all data from SQLite table
function getSQLiteData(filename, tableName) {
    const sql = `SELECT * FROM ${tableName}`;
    const result = executeSQLiteQuery(filename, sql);
    if (result && result.length > 0 && result[0].values) {
        const columns = result[0].columns;
        return result[0].values.map(row => {
            const obj = {};
            columns.forEach((col, i) => {
                obj[col] = row[i];
            });
            return obj;
        });
    }
    return [];
}

// Insert or update data in SQLite table
function saveSQLiteData(filename, tableName, data) {
    const db = sqliteDBs[filename];
    if (!db) {
        console.error(`SQLite database ${filename} not loaded`);
        return false;
    }

    try {
        // Get column names from data
        const columns = Object.keys(data);
        const values = columns.map(col => data[col]);
        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

        db.run(sql, values);
        return true;
    } catch (e) {
        console.error(`Failed to save data to ${filename}.${tableName}:`, e);
        return false;
    }
}

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
