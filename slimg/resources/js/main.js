const inputDir = await Neutralino.os.showFolderDialog();
let currentDir = inputDir;
let currentPage = 1;
let filesPerPage = 10;
let currentImageIndex = 0;
let images = [];
let isFullscreen = false;
let slideshowInterval;

const galleryView = document.getElementById('gallery-view');
const fullscreenView = document.getElementById('fullscreen-view');
const imageGallery = document.getElementById('image-gallery');
const fullscreenImage = document.getElementById('fullscreen-image');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const filesPerPageInput = document.getElementById('files-per-page');
const prevImageBtn = document.getElementById('prev-image');
const nextImageBtn = document.getElementById('next-image');

async function loadImages(directory) {
    try {
        const entries = await Neutralino.filesystem.readDirectory(directory);
        images = entries.filter(entry => entry.type === 'FILE' && /\.(jpg|jpeg|png|gif)$/i.test(entry.entry));
        displayImages();
    } catch (error) {
        console.error('Error reading directory:', error);
    }
}

function displayImages() {
    imageGallery.innerHTML = '';
    const start = (currentPage - 1) * filesPerPage;
    const end = start + filesPerPage;
    const pageImages = images.slice(start, end);

    pageImages.forEach((image, index) => {
        const imgElement = document.createElement('img');
        imgElement.src = `${currentDir}/${image.entry}`;
        imgElement.classList.add('w-full', 'h-auto', 'border', 'border-gray-800', 'cursor-pointer');
        imgElement.addEventListener('click', () => selectImage(start + index));
        imageGallery.appendChild(imgElement);
    });
}

function selectImage(index) {
    currentImageIndex = index;
    const selectedImage = images[currentImageIndex];
    if (selectedImage) {
        fullscreenImage.src = `${currentDir}/${selectedImage.entry}`;
        fullscreenView.classList.remove('hidden');
        galleryView.classList.add('hidden');
    }
}

function showNextImage() {
    if (currentImageIndex < images.length - 1) {
        selectImage(currentImageIndex + 1);
    }
}

function showPrevImage() {
    if (currentImageIndex > 0) {
        selectImage(currentImageIndex - 1);
    }
}

function showNextPage() {
    if ((currentPage * filesPerPage) < images.length) {
        currentPage++;
        displayImages();
    }
}

function showPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        displayImages();
    }
}

function toggleFullscreen() {
    if (isFullscreen) {
        clearInterval(slideshowInterval);
        fullscreenView.classList.add('hidden');
        galleryView.classList.remove('hidden');
        isFullscreen = false;
    } else {
        selectImage(currentImageIndex);
        isFullscreen = true;
        slideshowInterval = setInterval(showNextImage, 5000);
    }
}

function deleteImage() {
    const selectedImage = images[currentImageIndex];
    if (selectedImage) {
        Neutralino.filesystem.deleteFile(`${currentDir}/${selectedImage.entry}`).then(() => {
            images.splice(currentImageIndex, 1);
            displayImages();
            fullscreenView.classList.add('hidden');
            galleryView.classList.remove('hidden');
        }).catch(error => console.error('Error deleting file:', error));
    }
}

document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'ArrowRight':
            showNextImage();
            break;
        case 'ArrowLeft':
            showPrevImage();
            break;
        case 'ArrowUp':
            showPrevPage();
            break;
        case 'ArrowDown':
            showNextPage();
            break;
        case 'F5':
        case 'f':
            toggleFullscreen();
            break;
        case 'Delete':
            deleteImage();
            break;
        case 'Enter':
        case ' ':
            toggleFullscreen();
            break;
        case 'Escape':
            Neutralino.app.exit();
            break;
    }
});

prevPageBtn.addEventListener('click', showPrevPage);
nextPageBtn.addEventListener('click', showNextPage);
filesPerPageInput.addEventListener('input', (event) => {
    filesPerPage = parseInt(event.target.value, 10);
    displayImages();
});
prevImageBtn.addEventListener('click', showPrevImage);
nextImageBtn.addEventListener('click', showNextImage);

Neutralino.events.on('ready', () => {
    const args = Neutralino.os.getArgv();
    console.log(NL_CWD);
    if (args.length > 1) {
        const path = args[1];
        Neutralino.filesystem.readDirectory(path).then(entries => {
            const isDirectory = entries.some(entry => entry.type === 'DIRECTORY');
            if (isDirectory) {
                currentDir = path;
                loadImages(currentDir);
            } else {
                const directory = path.substring(0, path.lastIndexOf('/'));
                currentDir = directory;
                loadImages(currentDir);
                selectImage(entries.findIndex(entry => entry.entry === path));
            }
        }).catch(() => {
            loadImages(currentDir);
        });
    } else {
        loadImages(currentDir);
    }
});
