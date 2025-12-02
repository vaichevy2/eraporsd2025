# Data Persistence Architecture Diagram

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERFACE LAYER                         │
│  (HTML Forms, Buttons, Modals in rapor.html)                   │
│  - Save Siswa Button → saveSiswa()                             │
│  - Save Guru Button → saveGuru()                               │
│  - Import File → processImport()                               │
│  - etc.                                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│               UNIFIED PERSISTENCE LAYER (NEW)                   │
│         (Lines 1145-1239 in rapor.html - app object)           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ app.saveData(storeName, data)                          │  │
│  │ ├─ Error handling (try-catch)                          │  │
│  │ ├─ Console logging                                     │  │
│  │ ├─ Timestamp tracking                                  │  │
│  │ └─ Throws error on failure                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ app.fetchData(storeName, id?)                          │  │
│  │ ├─ Single record: app.fetchData('students', 1)         │  │
│  │ ├─ All records: app.fetchData('students')              │  │
│  │ ├─ Error handling (try-catch)                          │  │
│  │ └─ Fallback: [] or null                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ app.queryData(storeName, filterFn)                     │  │
│  │ └─ const boys = app.queryData('students', s=>s.jk==='L')   │
│  └──────────────────────────────────────────────────────────┘  │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ app.deleteData(storeName, id)                          │  │
│  │ ├─ Error handling (try-catch)                          │  │
│  │ └─ Logging on console                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ app.fetchMultiple(storeNames[])                        │  │
│  │ └─ Batch GET: ['students', 'teachers', 'mapel']       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ app.persistAllData()                                   │  │
│  │ ├─ Loads all 14+ stores                                │  │
│  │ ├─ Caches in window.appDataCache                       │  │
│  │ └─ Called on app startup in init()                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              INDEXEDDB LAYER (db object)                        │
│  - db.saveTo()  - Stores data                                  │
│  - db.get()     - Retrieves data                               │
│  - db.delete()  - Deletes data                                 │
│  - db.clear()   - Clears store                                 │
│  - db.batchSave() - Bulk insert                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│        BROWSER STORAGE (IndexedDB v6)                          │
│  Database: RaporDeepLearningDB                                 │
│  Stores:                                                        │
│  ├─ students                                                   │
│  ├─ teachers                                                   │
│  ├─ admins                                                     │
│  ├─ mapel                                                      │
│  ├─ cptp                                                       │
│  ├─ subject_teachers                                           │
│  ├─ utility                                                    │
│  ├─ sekolah                                                    │
│  ├─ dimensi                                                    │
│  ├─ kaih                                                       │
│  ├─ ekskul                                                     │
│  ├─ student_ekskul                                             │
│  ├─ nilai                                                      │
│  └─ kokurikuler                                                │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow: Save Operation

```
USER CLICKS "SIMPAN"
    │
    ▼
saveSiswa() function executes
    │
    ├─ Collects form data: {nisn, nama, jk, ...}
    │
    ├─ Validates input
    │
    ├─ Calls: await app.saveData('students', data)
    │
    ▼
app.saveData() executes:
    │
    ├─ try {
    │   ├─ Calls: db.saveTo('students', data)
    │   ├─ Logs: console.log('Data saved to students:', data)
    │   └─ Returns: result
    │ }
    ├─ catch (e) {
    │   ├─ Logs: console.error('Error saving...', e)
    │   └─ Throws: error
    │ }
    │
    ▼
db.saveTo() stores in IndexedDB
    │
    ▼
✓ DATA SAVED SUCCESSFULLY
    │
    ├─ User sees: Alert "Tersimpan!"
    ├─ Modal closes
    └─ Table reloads with new data
        (via db.subscribe callback)
```

## Data Flow: Load on Page Reload

```
USER PRESSES F5 (RELOAD)
    │
    ▼
init() function executes:
    │
    ├─ await db.init()          [Initialize IndexedDB]
    │
    ├─ await app.persistAllData()  [NEW - Pre-load all stores]
    │
    ▼
app.persistAllData() executes:
    │
    ├─ Loops through all 14+ stores
    │
    ├─ For each store:
    │   ├─ Calls: app.fetchData(storeName)
    │   │
    │   ▼
    │   app.fetchData() executes:
    │   │
    │   ├─ try {
    │   │   ├─ Calls: db.get(storeName)
    │   │   ├─ Returns: data || []
    │   │ }
    │   ├─ catch (e) {
    │   │   ├─ Logs: console.error(...)
    │   │   └─ Returns: []  [Fallback]
    │   │ }
    │
    ├─ Stores all results in: window.appDataCache = {
    │                           students: [...],
    │                           teachers: [...],
    │                           mapel: [...],
    │                           ... all stores
    │                         }
    │
    ├─ Logs: "All data cached and persisted:" + cache
    │
    ▼
init() continues with subscriptions...
    │
    ▼
User navigates: nav('dataSiswa')
    │
    ▼
nav() executes:
    │
    ├─ Shows: #dataSiswa page
    │
    ├─ Calls: loadSiswa()  [Explicit loader]
    │
    ▼
loadSiswa() executes:
    │
    ├─ Calls: await app.fetchData('students')
    │
    ├─ Gets: All students from IndexedDB
    │
    ├─ Renders: Table with student data
    │
    ▼
✓ DATA DISPLAYS IMMEDIATELY
    │
    └─ User sees: All saved students!
```

## Memory Architecture: Cache Strategy

```
┌─────────────────────────────────────────────────────┐
│   window (Global Browser Object)                   │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ window.appDataCache (NEW)                    │ │
│  │                                               │ │
│  │ {                                             │ │
│  │   students: [                                 │ │
│  │     {id: 1, nisn: 'E001', nama: 'Adi'},     │ │
│  │     {id: 2, nisn: 'E002', nama: 'Siti'},    │ │
│  │     ...                                       │ │
│  │   ],                                          │ │
│  │   teachers: [...],                            │ │
│  │   admins: [...],                              │ │
│  │   mapel: [...],                               │ │
│  │   cptp: [...],                                │ │
│  │   utility: [...],                             │ │
│  │   sekolah: [...],                             │ │
│  │   dimensi: [...],                             │ │
│  │   kaih: [...],                                │ │
│  │   ekskul: [...],                              │ │
│  │   student_ekskul: [...],                      │ │
│  │   nilai: [...],                               │ │
│  │   kokurikuler: [...],                         │ │
│  │   subject_teachers: [...]                     │ │
│  │ }                                             │ │
│  │                                               │ │
│  │ Populated: app startup in init()              │ │
│  │ Updated: When user saves data                 │ │
│  │ Used For: Fast access fallback                │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Function Call Chain: Example Save Flow

```
User Clicks "Simpan Siswa"
        ▼
saveSiswa()
├─ Get form data
├─ Validate data
├─ Call: await app.saveData('students', data)
│     ▼
│     app.saveData('students', data)
│     ├─ try {
│     │  ├─ if (!data) throw Error
│     │  ├─ Call: db.saveTo('students', data)
│     │  │    ▼
│     │  │    IndexedDB storage
│     │  │    ▼ (success)
│     │  ├─ Log: 'Data saved to students:' + data
│     │  └─ return result
│     │ }
│     ├─ catch (e) {
│     │  ├─ Log: 'Error saving to students:' + e
│     │  └─ throw e
│     │ }
│
├─ Hide modal
├─ Show alert "Tersimpan!"
└─ loadSiswa() [refresh table]
     ▼
     Gets data: app.fetchData('students')
     ├─ try {
     │  ├─ db.get('students')
     │  └─ return students || []
     │ }
     ├─ catch (e) {
     │  ├─ Log error
     │  └─ return []
     │ }
```

## Performance Impact

```
BEFORE (Direct db.saveTo calls):
User Click
    ↓ [Wait for save]
    ▼
Manual table refresh
    ↓ [Wait for query]
    ▼
Table shows new data

AFTER (Using app.saveData wrapper):
User Click
    ↓ [Unified save with logging]
    ▼
Auto refresh via db.subscribe
    ↓ [Instant via cache]
    ▼
Table shows new data (+ console logs for debugging)
    
BENEFITS:
✓ Centralized error handling
✓ Consistent logging for debugging  
✓ Cached data for fallback
✓ Batch operations support
✓ Single point to modify behavior
```

---

**Legend**:
- `▼` = Flow direction
- `├─` = Sub-operation
- `│` = Continuation
- `└─` = End of branch
- `[Notes]` = Additional context
