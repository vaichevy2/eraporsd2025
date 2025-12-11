# TODO: Implementasi Privilege Super Admin Tidak Terlihat oleh Admin

## Status: Completed ✅

### Tugas Utama
- [x] Membuat level "Super Admin" tersembunyi dari admin biasa
- [x] Hanya Super Admin yang bisa melihat dan mengatur level Super Admin
- [x] Admin biasa hanya bisa melihat level "Admin"

### Perubahan Kode
- [x] Modifikasi fungsi `modalAdminUser` di `app.js` untuk:
  - Mengambil level pengguna saat ini dari localStorage
  - Dinamis mengisi opsi level berdasarkan level pengguna saat ini
  - Hanya tampilkan "Super Admin" jika pengguna saat ini adalah Super Admin
- [x] Hapus opsi level hardcoded dari HTML modal admin
- [x] Opsi level sekarang diisi secara dinamis oleh JavaScript

### Testing
- [ ] Test sebagai Super Admin: Harus bisa melihat dan memilih "Super Admin"
- [ ] Test sebagai Admin biasa: Hanya bisa melihat "Admin"
- [ ] Test pembuatan user baru dengan level yang sesuai

### Dokumentasi
- [x] Update TODO.md dengan progress
- [x] Dokumentasi perubahan yang dilakukan

---

# TODO: Perbaiki Fungsi Reset Password pada Tab Admin Menu Data Pengguna

## Status: Completed ✅

### Tugas Utama
- [x] Perbaiki fungsi "reset password" pada tab "admin" menu halaman "data pengguna"
- [x] Implementasi modal reset password yang berfungsi
- [x] Validasi input password baru
- [x] Update password pengguna di database
- [x] Refresh tampilan tabel setelah reset password

### Perubahan Kode
- [x] Modifikasi fungsi `modalResetPass` di `app.js` untuk:
  - Mengatur nilai hidden fields (id dan type)
  - Membersihkan field password baru
  - Menampilkan modal reset password
- [x] Modifikasi fungsi `saveResetPassword` di `app.js` untuk:
  - Validasi input password baru
  - Mengambil data pengguna dari database
  - Update password pengguna
  - Menyimpan perubahan ke database
  - Menampilkan pesan sukses/error
  - Menutup modal dan refresh tabel

### Testing
- [ ] Test klik tombol "Reset Password" pada tabel admin
- [ ] Test klik tombol "Reset Password" pada tabel guru
- [ ] Test input password kosong (harus muncul validasi)
- [ ] Test input password valid (harus berhasil reset)
- [ ] Test refresh tabel setelah reset password

### Dokumentasi
- [x] Update TODO.md dengan progress implementasi reset password
- [x] Dokumentasi perubahan yang dilakukan pada fungsi reset password
