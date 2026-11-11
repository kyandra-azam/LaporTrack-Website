-- ========================================================
-- LAPORTRACK DATABASE SCHEMA
-- Platform Transparansi Pengaduan Layanan Publik
-- Compatible with MySQL / MariaDB (XAMPP)
-- ========================================================

CREATE DATABASE IF NOT EXISTS `laportrack_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `laportrack_db`;

-- --------------------------------------------------------
-- 1. TABEL: users
-- Menyimpan akun pengguna, peran (warga, admin, petugas),
-- dan kredensial dengan password yang di-hash (bcrypt).
-- --------------------------------------------------------
DROP TABLE IF EXISTS `report_timelines`;
DROP TABLE IF EXISTS `reports`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL COMMENT 'Bcrypt hash password',
    `role` ENUM('user', 'admin', 'field') NOT NULL DEFAULT 'user',
    `officer_id` VARCHAR(50) NULL COMMENT 'ID Petugas (khusus role field, contoh: FO-01)',
    `dept` VARCHAR(150) NULL COMMENT 'Instansi/Dinas petugas',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 2. TABEL: reports
-- Menyimpan seluruh aduan fasilitas publik dari warga
-- --------------------------------------------------------
CREATE TABLE `reports` (
    `id` VARCHAR(50) NOT NULL PRIMARY KEY COMMENT 'Contoh: LPR-2026-X8B9',
    `title` VARCHAR(255) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `agency` VARCHAR(100) NOT NULL DEFAULT 'Dinas Terkait',
    `location` VARCHAR(255) NOT NULL,
    `date` DATE NOT NULL,
    `status` ENUM('Menunggu Verifikasi', 'Diproses', 'Menunggu Informasi dari Pelapor', 'Selesai') NOT NULL DEFAULT 'Menunggu Verifikasi',
    `description` TEXT NOT NULL,
    `image` TEXT NULL COMMENT 'Foto aduan warga (URL / path file)',
    `reporter_email` VARCHAR(150) NOT NULL,
    `assigned_officer_id` VARCHAR(50) NULL,
    `assigned_officer_name` VARCHAR(100) NULL,
    `admin_response` TEXT NULL COMMENT 'Tanggapan resmi admin web',
    `resolution_notes` TEXT NULL COMMENT 'Catatan perbaikan petugas lapangan',
    `proof_image` TEXT NULL COMMENT 'Foto bukti hasil perbaikan lapangan',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_status` (`status`),
    INDEX `idx_reporter` (`reporter_email`),
    INDEX `idx_officer` (`assigned_officer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 3. TABEL: report_timelines
-- Riwayat log setiap perubahan status & tindak lanjut (audit trail)
-- --------------------------------------------------------
CREATE TABLE `report_timelines` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `report_id` VARCHAR(50) NOT NULL,
    `status` VARCHAR(100) NOT NULL,
    `actor` VARCHAR(100) NOT NULL COMMENT 'Sistem / Admin Dispatcher / Petugas Lapangan / Nama Pelapor',
    `note` TEXT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_timeline_report` (`report_id`),
    CONSTRAINT `fk_timeline_report` FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- DATA AWAL (SEED DATA)
-- Password untuk semua akun demo adalah: lapor123
-- Hash Bcrypt: $2y$12$GgmDm4wyhZFhGPPlCRSp9.0Tz25QZbvTzcOkHTV6eqKWyh7icoisa
-- ========================================================

-- Akun Pengguna & Petugas
INSERT INTO `users` (`name`, `email`, `password`, `role`, `officer_id`, `dept`) VALUES
('Warga Pelapor', 'warga1@mail.com', '$2y$12$GgmDm4wyhZFhGPPlCRSp9.0Tz25QZbvTzcOkHTV6eqKWyh7icoisa', 'user', NULL, NULL),
('Admin Central PUPR/Dishub', 'admin@laportrack.id', '$2y$12$GgmDm4wyhZFhGPPlCRSp9.0Tz25QZbvTzcOkHTV6eqKWyh7icoisa', 'admin', NULL, NULL),
('Budi Santoso', 'petugas@laportrack.id', '$2y$12$GgmDm4wyhZFhGPPlCRSp9.0Tz25QZbvTzcOkHTV6eqKWyh7icoisa', 'field', 'FO-01', 'Dinas PUPR - Tim Jalan'),
('Rahmat Hidayat', 'petugas2@laportrack.id', '$2y$12$GgmDm4wyhZFhGPPlCRSp9.0Tz25QZbvTzcOkHTV6eqKWyh7icoisa', 'field', 'FO-02', 'Dinas Perhubungan - PJU'),
('Agus Pratama', 'petugas3@laportrack.id', '$2y$12$GgmDm4wyhZFhGPPlCRSp9.0Tz25QZbvTzcOkHTV6eqKWyh7icoisa', 'field', 'FO-03', 'Dinas LH - Kebersihan');

-- Data Default Laporan
INSERT INTO `reports` (`id`, `title`, `category`, `agency`, `location`, `date`, `status`, `description`, `image`, `reporter_email`, `assigned_officer_id`, `assigned_officer_name`, `admin_response`, `resolution_notes`, `proof_image`) VALUES
('LPR-2026-X8B9', 'Jalan Berlubang dan Aspal Amblas', 'Fasilitas Jalan', 'Dinas PUPR', 'Jl. Sudirman No. 45, Jakarta Selatan', '2026-10-21', 'Diproses', 'Terdapat lubang sedalam kurang lebih 15cm di lajur kiri dekat shelter busway. Membahayakan pengendara motor.', 'https://placehold.co/600x400/1e3a8a/ffffff?text=Foto+Kerusakan+Jalan', 'warga1@mail.com', 'FO-01', 'Budi Santoso', 'Petugas lapangan Budi Santoso telah dijadwalkan membawa penambal aspal sore ini.', '', ''),
('LPR-2026-K72P', 'Lampu Penerangan PJU Padam Total', 'Lampu Penerangan', 'Dinas Perhubungan', 'Jl. Melati Raya Blok C3', '2026-10-20', 'Selesai', 'Dua titik lampu jalan pemukiman padam total sejak pekan lalu.', 'https://placehold.co/600x400/0284c7/ffffff?text=Lampu+PJU+Mati', 'warga2@mail.com', 'FO-02', 'Rahmat Hidayat', 'Perbaikan telah rampung dilaksanakan oleh tim Dishub.', 'Komponen trafo diganti dan 2 lampu LED PJU telah kembali menyala normal.', 'https://placehold.co/600x400/059669/ffffff?text=Bukti+Lampu+Jalan+Menyala'),
('LPR-2026-M41Q', 'Saluran Air Tersumbat Sampah Limbah Pasar', 'Saluran Air', 'Dinas Lingkungan Hidup', 'Jl. Mawar Raya No. 12', '2026-10-23', 'Menunggu Verifikasi', 'Drainase tersumbat penumpukan kantong plastik dan lumpur tebal.', 'https://placehold.co/600x400/4f46e5/ffffff?text=Got+Tersumbat', 'warga1@mail.com', NULL, '-', '', '', '');

-- Data Riwayat Timeline Penanganan
INSERT INTO `report_timelines` (`report_id`, `status`, `actor`, `note`, `created_at`) VALUES
('LPR-2026-X8B9', 'Menunggu Verifikasi', 'Sistem', 'Laporan diterima oleh portal LaporTrack.', '2026-10-21 08:30:00'),
('LPR-2026-X8B9', 'Diproses', 'Admin Dispatcher', 'Diverifikasi & ditugaskan ke Petugas Lapangan: Budi Santoso (Dinas PUPR).', '2026-10-21 11:15:00'),
('LPR-2026-K72P', 'Menunggu Verifikasi', 'Sistem', 'Laporan terdaftar.', '2026-10-20 09:10:00'),
('LPR-2026-K72P', 'Diproses', 'Admin Dispatcher', 'Penugasan ke Rahmat Hidayat (Dishub PJU).', '2026-10-20 13:00:00'),
('LPR-2026-K72P', 'Selesai', 'Petugas Lapangan', 'Pemasangan LED baru selesai dilaksanakan.', '2026-10-21 15:00:00'),
('LPR-2026-M41Q', 'Menunggu Verifikasi', 'Sistem', 'Laporan masuk dalam antrean verifikasi Admin.', '2026-10-23 07:45:00');

