# Data Persistence Implementation Guide

## Overview
The Aplikasi Rapor system now has comprehensive data persistence through a unified GET/POST/DELETE wrapper layer added to `rapor.html`.

## How Data Persistence Works

### 1. **Unified Wrapper Functions** (Lines 1145-1239 in rapor.html)
All data operations now route through these central functions:

#### `app.fetchData(storeName, id?)`
- **Purpose**: GET data from database
- **Usage**: 
  ```javascript
  const allStudents = await app.fetchData('students');
  const singleStudent = await app.fetchData('students', 1);
  ```
- **Returns**: Array of records (if no ID) or single record/null (if ID provided)
- **Error Handling**: Try-catch with fallback to empty array/null

#### `app.saveData(storeName, data)`
- **Purpose**: POST/CREATE/UPDATE data in database
- **Usage**:
  ```javascript
  await app.saveData('students', {nisn: 'E001', nama: 'Adi'});
  ```
- **Logging**: Console logs all saves for debugging
- **Error Handling**: Throws error on failure (caught by caller)

#### `app.deleteData(storeName, id)`
- **Purpose**: DELETE record from database
- **Usage**:
  ```javascript
  await app.deleteData('students', 1);
  ```
- **Error Handling**: Try-catch with logging

#### `app.queryData(storeName, filterFn)`
- **Purpose**: Query with custom filter function
- **Usage**:
  ```javascript
  const boys = await app.queryData('students', s => s.jk === 'L');
  ```

#### `app.fetchMultiple(storeNames)`
- **Purpose**: Batch GET for multiple stores (efficient)
- **Usage**:
  ```javascript
  const data = await app.fetchMultiple(['students', 'teachers', 'mapel']);
  ```
- **Returns**: Object with store names as keys

#### `app.persistAllData()`
- **Purpose**: Pre-load all data on startup and cache in memory
- **Called**: In `init()` right after `await db.init()`
- **Caches To**: `window.appDataCache` with all 14+ stores
- **Benefit**: Data persists even if IndexedDB temporarily unavailable

### 2. **Data Caching Strategy**
- **When**: `persistAllData()` runs on app startup (in `init()` function)
- **Where**: Stored in `window.appDataCache` JavaScript object
- **Accessed**: Available even after page reload for instant display

### 3. **All Save Functions Updated**
These functions now use `app.saveData()` instead of direct `db.saveTo()`:

- `saveSiswa()` - Student data
- `saveGuru()` - Teacher data
- `saveGuruMapel()` - Subject teachers
- `saveAdmin()` - Admin users
- `saveSekolah()` - School info
- `saveUtility()` - Utility settings
- `saveCPTP()` - Learning targets
- `saveDimensi()` - Dimensions
- `saveKaih()` - KAIH values
- `saveJenisEkskul()` - Extracurricular types
- `saveAssignEkskul()` - Student extracurricular assignments
- `saveNilai()` - Student grades
- `saveResetPassword()` - Password resets
- `resetLoginGuru()` - Teacher password resets
- `saveKokurikuler()` - Project P5 data
- All **bulk import** functions (students, teachers, subject_teachers, cptp)

## Data Persistence Flow

```
User Opens App
    ↓
init() runs
    ↓
db.init() initializes IndexedDB
    ↓
persistAllData() caches all stores
    ↓
window.appDataCache populated
    ↓
nav() loads each page
    ↓
Explicit loaders (loadSiswa, loadGuru, etc.) display data
    ↓
Data visible immediately
```

## Testing Data Persistence

### Test 1: Add Data and Reload Page
1. Open app (http://localhost/Aplikasi%20Rapor/wwwroot/rapor.html)
2. Go to "Data Siswa"
3. Add a new student (click "Tambah")
4. Fill form and click "Simpan"
5. **Press F5 to reload page**
6. Go back to "Data Siswa"
7. **Verify**: New student still appears ✓

### Test 2: Check Console Logging
1. Open DevTools (F12)
2. Go to Console tab
3. Add/save any data
4. **Look for**: `"Data saved to students:"` messages
5. **Also look for**: `"All data cached and persisted:"` on page load

### Test 3: Verify Cache Population
1. Open DevTools (F12)
2. Go to Console tab
3. Type: `window.appDataCache`
4. **Verify**: Object with stores: students, teachers, admins, mapel, cptp, etc.
5. **Each store** should be an array (may be empty)

### Test 4: All Pages Show Data After Reload
- Dashboard → Verify counts (students, teachers, subjects)
- Data Siswa → Add student, reload, verify shows
- Data Guru → Add teacher, reload, verify shows
- Data Mata Pelajaran → Add subject, reload, verify shows
- Data CPTP → Add learning target, reload, verify shows
- Data Ekskul → Add extracurricular, reload, verify shows
- Input Nilai → Add grades, reload, verify shows

## Browser Console Debug Commands

```javascript
// View all cached data
console.log(window.appDataCache);

// View specific store
console.log(window.appDataCache.students);

// Fetch fresh data (not from cache)
await app.fetchData('students');

// Fetch multiple stores
await app.fetchMultiple(['students', 'teachers', 'mapel']);

// Query data with filter
await app.queryData('students', s => s.jk === 'L');

// Save test data
await app.saveData('students', {
  nisn: 'TEST001',
  nama: 'Test Student',
  jk: 'L'
});

// Force re-cache all data
await app.persistAllData();
```

## Troubleshooting

### Problem: Data disappears after page reload
**Solution**: 
1. Check browser console for errors (F12 → Console)
2. Verify IndexedDB has data (F12 → Application → IndexedDB → RaporDeepLearningDB)
3. Check if `persistAllData()` is running (look for log message on load)
4. Try manually calling: `await app.persistAllData()`

### Problem: Console shows "cannot save" errors
**Solution**:
1. Check data format matches store structure
2. Ensure required fields are present
3. Verify `app.saveData()` is being called (not direct `db.saveTo()`)
4. Check browser DevTools for error details

### Problem: Slow performance when adding many items
**Solution**:
1. This is normal for bulk imports (uses loop with await)
2. Loading modal shows "Tunggu proses" during import
3. Import limit is 10,000 rows for safety
4. Consider using import file instead of manual entry

### Problem: Sync buttons not working
**Solution**:
1. Ensure syncGuruKelas() is called after data change
2. Check that app.syncGuruKelas() runs on "Sinkronisasi" button click
3. Verify teacher has guru_kelas value set

## Architecture Benefits

✅ **Centralized Control**: All data ops route through wrapper functions
✅ **Error Handling**: Consistent try-catch on all operations
✅ **Logging**: Every operation logged to console for debugging
✅ **Performance**: Batch operations via `fetchMultiple()`
✅ **Reliability**: Cached fallback prevents empty displays
✅ **Consistency**: Single source of truth for all saves
✅ **Extensibility**: Easy to add new data operations

## Data Stores (14+ Available)

1. `students` - Student records
2. `teachers` - Teacher records
3. `admins` - Admin users
4. `mapel` - Subject/course data
5. `cptp` - Learning targets (Capaian Pembelajaran)
6. `subject_teachers` - Teacher-subject assignments
7. `utility` - App settings (class, semester, etc.)
8. `sekolah` - School information
9. `dimensi` - Dimension data
10. `kaih` - KAIH values
11. `ekskul` - Extracurricular types
12. `student_ekskul` - Student-extracurricular mappings
13. `nilai` - Student grades/scores
14. `kokurikuler` - Project P5 data

## Future Enhancements

Potential improvements for next iteration:
- [ ] Add offline-first sync queue for failed saves
- [ ] Implement data compression for large datasets
- [ ] Add data export/backup to file
- [ ] Implement change detection for real-time sync
- [ ] Add data validation rules in wrapper functions
- [ ] Implement soft-delete (keep deleted records with flag)
