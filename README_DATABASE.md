# Panduan Database & Backend LaporTrack

Platform Transparansi Layanan Publik kini telah terintegrasi penuh dengan **Database MySQL / MariaDB**.

---

## 1. Struktur Tabel Database (`laportrack_db`)

Sesuai kebutuhan sistem, data telah dipisahkan ke dalam 3 tabel utama:

### A. Tabel `users` (Pengguna & Peran)
Menyimpan akun pengguna, hak akses peran (*role*), dan kredensial aman yang telah di-hash menggunakan algoritma **Bcrypt** (`PASSWORD_BCRYPT`).
- `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `name` (VARCHAR 100) — Nama lengkap pengguna / petugas
- `email` (VARCHAR 150, UNIQUE) — Email akun untuk login
- `password` (VARCHAR 255) — Hash Bcrypt password
- `role` (ENUM: `'user'`, `'admin'`, `'field'`) — Peran akun
- `officer_id` (VARCHAR 50, NULL) — ID Petugas (khusus role `field`, misal: `FO-01`)
- `dept` (VARCHAR 150, NULL) — Instansi/Dinas petugas lapangan
- `created_at` (TIMESTAMP)

**Akun Demo Bawaan:**
| Peran (*Role*) | Nama | Email | Password Asli | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **Masyarakat (`user`)** | Warga Pelapor | `warga1@mail.com` | `lapor123` | Buat laporan & cek riwayat |
| **Admin Dispatcher (`admin`)** | Admin Central PUPR/Dishub | `admin@laportrack.id` | `lapor123` | Verifikasi, disposisi & ubah status |
| **Petugas Lapangan (`field`)** | Budi Santoso | `petugas@laportrack.id` | `lapor123` | ID `FO-01` (Dinas PUPR - Tim Jalan) |
| **Petugas Lapangan (`field`)** | Rahmat Hidayat | `petugas2@laportrack.id` | `lapor123` | ID `FO-02` (Dinas Perhubungan - PJU) |
| **Petugas Lapangan (`field`)** | Agus Pratama | `petugas3@laportrack.id` | `lapor123` | ID `FO-03` (Dinas LH - Kebersihan) |

---

### B. Tabel `reports` (Aduan Publik)
Menyimpan seluruh data aduan masyarakat secara permanen (menggantikan `localStorage`).
- `id` (VARCHAR 50, PRIMARY KEY) — ID referensi unik (contoh: `LPR-2026-X8B9`)
- `title` (VARCHAR 255) — Judul laporan
- `category` (VARCHAR 100) — Kategori fasilitas publik
- `agency` (VARCHAR 100) — Instansi penanggung jawab
- `location` (VARCHAR 255) — Alamat / titik lokasi kerusakan
- `date` (DATE) — Tanggal kejadian / laporan
- `status` (ENUM) — `'Menunggu Verifikasi'`, `'Diproses'`, `'Menunggu Informasi dari Pelapor'`, `'Selesai'`
- `description` (TEXT) — Rincian deskripsi aduan
- `image` (TEXT) — URL / path berkas foto bukti kerusakan
- `reporter_email` (VARCHAR 150) — Email pelapor (disembunyikan dari publik demi privasi)
- `assigned_officer_id` (VARCHAR 50, NULL) — ID Petugas yang ditugaskan
- `assigned_officer_name` (VARCHAR 100, NULL) — Nama Petugas
- `admin_response` (TEXT) — Tanggapan resmi dari Admin Web
- `resolution_notes` (TEXT) — Catatan perbaikan dari Petugas Lapangan
- `proof_image` (TEXT) — Foto bukti penyelesaian pekerjaan fisik
- `created_at` & `updated_at` (TIMESTAMP)

---

### C. Tabel `report_timelines` (Riwayat & Audit Trail Progres)
Mencatat setiap riwayat perubahan status, verifikasi admin, penugasan disposisi, dan progres teknisi lapangan secara *real-time* dengan relasi *Foreign Key* ke tabel `reports`.
- `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `report_id` (VARCHAR 50, FOREIGN KEY -> `reports.id` ON DELETE CASCADE)
- `status` (VARCHAR 100) — Status pada saat log dicatat
- `actor` (VARCHAR 100) — Pihak yang melakukan aksi (*Sistem*, *Admin Dispatcher*, *Petugas Lapangan*, atau nama pelapor)
- `note` (TEXT) — Catatan keterangan progres
- `created_at` (DATETIME) — Waktu pencatatan log

---

## 2. Cara Menjalankan & Menghubungkan ke MySQL

Sistem ini dirancang dengan fitur **Auto-Migration**:
Begitu MySQL di XAMPP Anda aktif, backend API akan **secara otomatis membuat database `laportrack_db` dan tabel-tabelnya beserta data awal (seed)** jika belum ada di database Anda!

### Opsi A (Paling Cepat & Praktis — Menggunakan `start-server.bat`):
1. Buka **XAMPP Control Panel** di komputer Anda, lalu klik tombol **Start** pada modul **MySQL**.
2. Masuk ke folder proyek `Lapor_Track`, lalu klik dua kali file **`start-server.bat`**.
3. Browser akan otomatis membuka `http://localhost:8000`.
4. Indikator di bagian atas akan langsung berwarna hijau: **`MySQL: Terhubung (laportrack_db)`**.

---

### Opsi B (Menggunakan Apache XAMPP):
1. Buka **XAMPP Control Panel**, lalu klik **Start** pada modul **Apache** dan **MySQL**.
2. Klik dua kali file **`copy-to-xampp.bat`** (atau salin folder proyek ini ke `C:\xamppNew\htdocs\Lapor_Track`).
3. Buka browser dan kunjungi:
   `http://localhost/Lapor_Track/`
4. Jika ingin mengimpor database secara manual lewat phpMyAdmin:
   - Buka `http://localhost/phpmyadmin`
   - Buat database baru bernama `laportrack_db`
   - Klik tab **Import**, pilih berkas `database.sql`, lalu klik **Import**.

---

## 3. Dokumentasi REST API

Semua endpoint terletak di direktori `/api/` dan mendukung *Cross-Origin Resource Sharing (CORS)*:

| Endpoint | Method | Parameter / Body | Deskripsi |
| :--- | :--- | :--- | :--- |
| `api/auth.php?action=status` | `GET` | - | Cek status koneksi database MySQL |
| `api/auth.php?action=officers` | `GET` | - | Ambil daftar petugas lapangan aktif dari tabel `users` |
| `api/auth.php?action=login` | `POST` | `email`, `password`, `role` | Verifikasi kredensial login dengan hash Bcrypt tabel `users` |
| `api/auth.php?action=register` | `POST` | `name`, `email`, `password`, `role` | Pendaftaran akun baru dengan hashing otomatis |
| `api/reports.php` | `GET` | `search`, `category`, `status`, `officerId`, `reporterEmail` | Ambil daftar laporan beserta timelinenya |
| `api/reports.php?id={ID}` | `GET` | `id` | Ambil rincian satu laporan dan seluruh riwayat `report_timelines` |
| `api/reports.php?action=create` | `POST` | `id`, `title`, `category`, `agency`, `location`, `description`, `reporterEmail`, `image_file` | Simpan aduan warga baru & catat log timeline awal |
| `api/reports.php?action=admin_update` | `POST` | `id`, `status`, `assignedOfficerId`, `assignedOfficerName`, `adminResponse` | Update disposisi status admin & simpan ke `report_timelines` |
| `api/reports.php?action=field_update` | `POST` | `id`, `status`, `resolutionNotes`, `proof_file` | Update penyelesaian lapangan & simpan ke `report_timelines` |
| `api/reports.php?action=reset` | `POST` | - | Reset data laporan dan timeline ke kondisi awal default |
| `api/upload.php` | `POST` | `file` (multipart) | Upload berkas gambar bukti ke folder `api/uploads/` |

---

## 4. Keunggulan Integrasi Ini

1. **Penyimpanan Permanen & Multi-Perangkat:** Data aduan dan riwayat tidak lagi hilang saat browser dibersihkan atau dibuka dari perangkat lain.
2. **Keamanan Kredensial:** Password tidak lagi disimpan dalam bentuk teks terbuka di JavaScript; semua diverifikasi lewat server menggunakan hash Bcrypt standar industri (`$2y$12$...`).
3. **Audit Trail Real-Time:** Setiap aksi admin maupun petugas lapangan secara otomatis tercatat ke tabel `report_timelines` lengkap dengan nama aktor, status, dan catatan tindak lanjut.
4. **Zero-Setup Auto Initialization:** Tidak wajib impor manual ke phpMyAdmin; script PHP akan otomatis menginisialisasi database dan tabel saat pertama kali dijalankan.
5. **Fallback Cerdas:** Jika MySQL belum di-start, sistem tetap dapat beroperasi dalam mode simulasi lokal tanpa error layar putih (blank screen).

