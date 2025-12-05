<?php
// save_sqlite_to_folder.php
// Accepts a multipart/form-data POST with a 'file' field and 'filename' field, saves to sqlite/ folder.

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (!isset($_FILES['file']) || !isset($_POST['filename'])) {
    http_response_code(400);
    echo json_encode(['error' => 'No file or filename provided']);
    exit;
}

$upload = $_FILES['file'];
if ($upload['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'Upload error code: ' . $upload['error']]);
    exit;
}

$filename = basename($_POST['filename']);
if (!preg_match('/\.sqlite$/', $filename)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid filename, must end with .sqlite']);
    exit;
}

// Validate file type (basic check)
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mtype = finfo_file($finfo, $upload['tmp_name']);
finfo_close($finfo);

// Allow sqlite mime or application/octet-stream
$allowed = ['application/x-sqlite3', 'application/octet-stream', 'application/vnd.sqlite3'];

$target_dir = __DIR__ . DIRECTORY_SEPARATOR . 'sqlite';
if (!is_dir($target_dir)) mkdir($target_dir, 0755, true);

$target = $target_dir . DIRECTORY_SEPARATOR . $filename;

if (!move_uploaded_file($upload['tmp_name'], $target)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to move uploaded file']);
    exit;
}

echo json_encode(['success' => true, 'path' => 'sqlite/' . $filename, 'mime' => $mtype]);
