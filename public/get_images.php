<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$imageDir = 'images';
$validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
$images = [];

if (!is_dir($imageDir)) {
    echo json_encode([]);
    exit;
}

$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($imageDir));

foreach ($iterator as $file) {
    if ($file->isFile()) {
        $ext = strtolower($file->getExtension());
        if (in_array($ext, $validExtensions)) {
            $path = $file->getPathname();
            $size = @getimagesize($path);
            if ($size) {
                // Ensure web-safe paths (forward slashes)
                $webPath = str_replace('\\', '/', $path);
                $images[] = [
                    'id' => md5($webPath),
                    'src' => $webPath,
                    'title' => $file->getFilename(),
                    'width' => $size[0],
                    'height' => $size[1]
                ];
            }
        }
    }
}

echo json_encode($images);
?>
