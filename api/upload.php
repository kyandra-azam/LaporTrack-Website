<?php
/**
 * LaporTrack - Endpoint Upload Berkas Gambar Bukti
 */

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(['success' => false, 'message' => 'Hanya metode POST yang diizinkan.'], 405);
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    sendJsonResponse(['success' => false, 'message' => 'Tidak ada berkas yang diunggah atau terjadi kesalahan upload.'], 400);
}

$file = $_FILES['file'];
$allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];

if (!in_array(strtolower($file['type']), $allowedTypes)) {
    sendJsonResponse(['success' => false, 'message' => 'Tipe berkas tidak didukung. Harap unggah format JPG, PNG, atau WEBP.'], 400);
}

// Maksimal 5MB
if ($file['size'] > 5 * 1024 * 1024) {
    sendJsonResponse(['success' => false, 'message' => 'Ukuran berkas melebihi batas 5MB.'], 400);
}

$ext = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = 'upload_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . strtolower($ext);
$uploadDir = __DIR__ . '/uploads/';

if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

$destination = $uploadDir . $filename;

if (move_uploaded_file($file['tmp_name'], $destination)) {
    $relativeUrl = 'api/uploads/' . $filename;
    sendJsonResponse([
        'success' => true,
        'message' => 'Berkas berhasil diunggah.',
        'url' => $relativeUrl,
        'filename' => $filename
    ]);
} else {
    sendJsonResponse(['success' => false, 'message' => 'Gagal memindahkan berkas yang diunggah.'], 500);
}

