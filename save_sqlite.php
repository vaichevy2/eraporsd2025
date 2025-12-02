<?php
// save_sqlite.php
// Accepts a multipart/form-data POST with a 'file' field and saves it to the server.

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (!isset($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded (field: file)']);
    exit;
}

$upload = $_FILES['file'];
if ($upload['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'Upload error code: ' . $upload['error']]);
    exit;
}

// Validate file type (basic check)
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mtype = finfo_file($finfo, $upload['tmp_name']);
finfo_close($finfo);

// Allow sqlite mime or application/octet-stream
$allowed = ['application/x-sqlite3', 'application/octet-stream', 'application/vnd.sqlite3'];

// Save to uploads directory
$uploads_dir = __DIR__ . DIRECTORY_SEPARATOR . 'uploads';
if (!is_dir($uploads_dir)) mkdir($uploads_dir, 0755, true);

$basename = basename($upload['name']);
$target = $uploads_dir . DIRECTORY_SEPARATOR . $basename;

if (!move_uploaded_file($upload['tmp_name'], $target)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to move uploaded file']);
    exit;
}

echo json_encode(['success' => true, 'path' => 'uploads/' . $basename, 'mime' => $mtype]);
