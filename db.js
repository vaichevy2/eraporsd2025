// db.js - Shared database module for login.html and rapor.html
const DB_NAME = "RaporDeepLearningDB";
const DB_VERSION = 9;
let dbInstance = null;

// Daftar tabel yang hanya boleh punya 1 baris data (single entry)
const SINGLE_ENTRY_STORES = ['sekolah', 'utility', 'dimensi', 'kaih'];

// Initialize IndexedDB
async function initDB() {
    return new Promise((resolve, reject) => {
        // Cek dukungan browser
        if (!window.indexedDB) {
            reject("Browser tidak mendukung IndexedDB");
            return;
        }

        // If already initialized, return existing instance
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            const stores = [
                'sekolah', 'utility', 'students', 'teachers', 'subject_teachers',
                'mapel', 'cptp', 'dimensi', 'kaih', 'nilai', 'ekskul',
                'student_ekskul', 'kokurikuler', 'tema_ekskul', 'tema_kokurikuler', 'admins',
                'kelompok_kokurikuler', 'siswa_kelompok_kokurikuler'
            ];
            stores.forEach(s => {
                if (!db.objectStoreNames.contains(s)) {
                    const isSingleEntry = SINGLE_ENTRY_STORES.includes(s);
                    const auto = !isSingleEntry;
                    db.createObjectStore(s, { keyPath: 'id', autoIncrement: auto });
                }
            });
        };
        request.onsuccess = (e) => {
            dbInstance = e.target.result;
            resolve(dbInstance);
        };
        request.onerror = (e) => reject("Database Error: " + e.target.error);
    });
}

// Get data from IndexedDB
async function getFromDB(storeName, id) {
    if (!dbInstance) await initDB();
    return new Promise((resolve) => {
        const tx = dbInstance.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = id ? store.get(id) : store.getAll();
        req.onsuccess = () => resolve(req.result);
    });
}

// Save data to IndexedDB
async function saveToDB(storeName, data) {
    if (!dbInstance) await initDB();
    return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(data);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Delete data from IndexedDB
async function deleteFromDB(storeName, id) {
    if (!dbInstance) await initDB();
    return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
}

// Query data with filter function
async function queryData(storeName, filterFn) {
    const allData = await getFromDB(storeName);
    if (!Array.isArray(allData)) return [];
    return allData.filter(filterFn);
}

// Export functions for use in other files
window.DB = {
    init: initDB,
    get: getFromDB,
    save: saveToDB,
    delete: deleteFromDB,
    query: queryData
};
