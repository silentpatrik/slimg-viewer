<?php

// SERTUP IN PUT DIRECTORY
if (getenv('GALLERY_DIR') && is_dir(getenv('GALLERY_DIR'))) {
    $inputDir = getenv('GALLERY_DIR');
} else if (isset($_GET['dir']) && is_dir($_GET['dir'])) {
    $inputDir = $_GET['dir'];
} else if (isset($argv[1]) && is_dir($argv[1])) {
    $inputDir = $argv[1];
} else {
    $inputDir = __DIR__;
}
define('GALLERY_DIR', $inputDir);


function scanForImages($dir)
{
    $images = [];
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
    foreach ($files as $file) {
        if (in_array(strtolower(pathinfo($file, PATHINFO_EXTENSION)), ['jpg', 'jpeg', 'png', 'gif'])) {
            $images[] = $file->getPathname();
        }
    }
    return $images;
}

function getImageContent($imagePath)
{
    $fileInfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $fileInfo->file($imagePath);
    header('Content-Type: ' . $mimeType);
    readfile($imagePath);
    exit;
}

function paginateImages($images, $currentPage, $perPage)
{
    $totalImages = count($images);
    $totalPages = ceil($totalImages / $perPage);
    $offset = ($currentPage - 1) * $perPage;
    return array_slice($images, $offset, $perPage);
}

if (isset($_GET['image'])) {
    $imagePath = base64_decode($_GET['image']);
    if (file_exists($imagePath)) {
        getImageContent($imagePath);
    } else {
        http_response_code(404);
        echo 'Image not found.';
        exit;
    }
}

if (isset($_GET['page']) && isset($_GET['per_page'])) {
    $images = scanForImages(GALLERY_DIR);
    $currentPage = intval($_GET['page']);
    $perPage = intval($_GET['per_page']);
    $pagedImages = paginateImages($images, $currentPage, $perPage);
    echo json_encode(array_map('base64_encode', $pagedImages));
    exit;
}

$images = scanForImages(GALLERY_DIR);
?>

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>Gallery</title>
    <script src="https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio"></script>
    <style>
        .hidden {
            display: none;
        }

        .checked {
            border: 2px solid blue;
            filter: grayscale();
        }
    </style>
</head>

<body class="bg-gray-950">
    <div id="gallery" class="container  p-4">
        <div class="flex justify-between items-center mb-4">
            <div>
                <label for="itemsPerPage" class="mr-2">Items per page:</label>
                <input type="number" id="itemsPerPage" class="px-2 py-1 border rounded" value="10" min="1">
            </div>
            <div>
                <button id="prevPage" class="px-4 py-2 bg-blue-500 text-white">Previous</button>
                <button id="nextPage" class="px-4 py-2 bg-blue-500 text-white">Next</button>
            </div>
        </div>
        <div id="thumbnails" class="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-9 gap-4"></div>

    </div>

    <div id="fullscreen" class="hidden fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center">
        <img id="fullscreenImage" src="" class="max-h-screen max-w-screen aspect-auto   h-full contain">
        <button id="closeFullscreen" class="absolute top-4 right-4 text-white text-2xl">X</button>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const gallery = document.getElementById('gallery');
            const fullscreen = document.getElementById('fullscreen');
            const fullscreenImage = document.getElementById('fullscreenImage');
            const closeFullscreen = document.getElementById('closeFullscreen');
            const itemsPerPageInput = document.getElementById('itemsPerPage');
            const thumbnailsContainer = document.getElementById('thumbnails');
            let perPage = parseInt(itemsPerPageInput.value);
            let currentPage = 1;
            let selectedIndex = 0;
            let selectedThumbnail = null;
            let touchstartX = 0;
            let touchendX = 0;
            let images = [];

            const fetchImages = (page, perPage) => {
                fetch(`?page=${page}&per_page=${perPage}`)
                    .then(response => response.json())
                    .then(data => {
                        images = data;
                        displayThumbnails();
                    });
            };

            const displayThumbnails = () => {
                thumbnailsContainer.innerHTML = '';
                images.forEach((image, index) => {
                    const imgElement = document.createElement('img');
                    imgElement.src = `?image=${image}`;
                    imgElement.dataset.index = index;
                    imgElement.classList.add('thumbnail', 'w-full', 'h-32', 'object-cover', 'lazy');
                    imgElement.addEventListener('click', () => selectThumbnail(index));
                    thumbnailsContainer.appendChild(imgElement);
                });
                selectThumbnail(0);
            };

            const updatePagination = () => {
                fetchImages(currentPage, perPage);
            };

            const selectThumbnail = (index) => {
                if (selectedThumbnail) {
                    selectedThumbnail.classList.remove('border', 'border-blue-500');
                }
                selectedThumbnail = thumbnailsContainer.children[index];
                selectedThumbnail.classList.add('border', 'border-blue-500');
                selectedIndex = index;
            };

            const toggleCheck = () => {
                selectedThumbnail.classList.toggle('checked');
            };

            document.getElementById('nextPage').addEventListener('click', () => {
                currentPage++;
                updatePagination();
            });

            document.getElementById('prevPage').addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    updatePagination();
                }
            });

            itemsPerPageInput.addEventListener('change', () => {
                perPage = parseInt(itemsPerPageInput.value);
                currentPage = 1;
                updatePagination();
            });

            const openFullscreen = () => {
                fullscreenImage.src = selectedThumbnail.src;
                fullscreen.classList.remove('hidden');
            };

            const closeFullscreenMode = () => {
                fullscreen.classList.add('hidden');
            };

            const handleSwipe = () => {
                if (fullscreen.classList.contains('hidden')) {
                    if (touchendX < touchstartX) {
                        // Swipe left (next page)
                        document.getElementById('nextPage').click();
                    } else if (touchendX > touchstartX) {
                        // Swipe right (previous page)
                        document.getElementById('prevPage').click();
                    }
                } else {
                    if (touchendX < touchstartX) {
                        // Swipe left (next image)
                        selectThumbnail(Math.min(selectedIndex + 1, images.length - 1));
                    } else if (touchendX > touchstartX) {
                        // Swipe right (previous image)
                        selectThumbnail(Math.max(selectedIndex - 1, 0));
                    }
                    fullscreenImage.src = selectedThumbnail.src;
                }
            };

            document.addEventListener('keydown', (event) => {
                if (!selectedThumbnail) return;

                if (fullscreen.classList.contains('hidden')) {
                    switch (event.key) {
                        case 'ArrowRight':
                            if (event.ctrlKey) {
                                selectThumbnail(Math.min(selectedIndex + 10, images.length - 1));
                            } else {
                                selectThumbnail(Math.min(selectedIndex + 1, images.length - 1));
                            }
                            break;
                        case 'ArrowLeft':
                            if (event.ctrlKey) {
                                selectThumbnail(Math.max(selectedIndex - 10, 0));
                            } else {
                                selectThumbnail(Math.max(selectedIndex - 1, 0));
                            }
                            break;
                        case 'Enter':
                            openFullscreen();
                            break;
                        case ' ':
                            event.preventDefault();
                            toggleCheck();
                            break;
                    }
                } else {
                    switch (event.key) {
                        case 'Escape':
                            closeFullscreenMode();
                            break;
                        case 'ArrowRight':
                            if (event.ctrlKey) {
                                selectThumbnail(Math.min(selectedIndex + 10, images.length - 1));
                            } else {
                                selectThumbnail(Math.min(selectedIndex + 1, images.length - 1));
                            }
                            fullscreenImage.src = selectedThumbnail.src;
                            break;
                        case 'ArrowLeft':
                            if (event.ctrlKey) {
                                selectThumbnail(Math.max(selectedIndex - 10, 0));
                            } else {
                                selectThumbnail(Math.max(selectedIndex - 1, 0));
                            }
                            fullscreenImage.src = selectedThumbnail.src;
                            break;
                        case ' ':
                            event.preventDefault();
                            toggleCheck();
                            break;
                    }
                }
            });

            closeFullscreen.addEventListener('click', () => {
                closeFullscreenMode();
            });

            // Touch event listeners
            document.addEventListener('touchstart', (event) => {
                touchstartX = event.changedTouches[0].screenX;
            });

            document.addEventListener('touchend', (event) => {
                touchendX = event.changedTouches[0].screenX;
                handleSwipe();
            });

            updatePagination();
            document.body.focus();
        });
    </script>
</body>

</html>