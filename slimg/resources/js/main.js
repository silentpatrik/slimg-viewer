// This is just a sample app. You can structure your Neutralinojs app code as you wish.
// This example app is written with vanilla JavaScript and HTML.
// Feel free to use any frontend framework you like :)
// See more details: https://neutralino.js.org/docs/how-to/use-a-frontend-library


/*
    Function to set up a system tray menu with options specific to the window mode.
    This function checks if the application is running in window mode, and if so,
    it defines the tray menu items and sets up the tray accordingly.
*/
function setTray() {
    // Tray menu is only available in window mode
    if (NL_MODE != "window") {
        console.log("INFO: Tray menu is only available in the window mode.");
        return;
    }

    // Define tray menu items
    let tray = {
        icon: "/resources/icons/trayIcon.png",
        menuItems: [
            { id: "VERSION", text: "Get version" },
            { id: "SEP", text: "-" },
            { id: "QUIT", text: "Quit" }
        ]
    };

    // Set the tray menu
    Neutralino.os.setTray(tray);
}

/*
    Function to handle click events on the tray menu items.
    This function performs different actions based on the clicked item's ID,
    such as displaying version information or exiting the application.
*/
function onTrayMenuItemClicked(event) {
    switch (event.detail.id) {
        case "VERSION":
            // Display version information
            Neutralino.os.showMessageBox("Version information",
                `Neutralinojs server: v${NL_VERSION} | Neutralinojs client: v${NL_CVERSION}`);
            break;
        case "QUIT":
            // Exit the application
            Neutralino.app.exit();
            break;
    }
}

/*
    Function to handle the window close event by gracefully exiting the Neutralino application.
*/
function onWindowClose() {
    Neutralino.app.exit();
}

// Initialize Neutralino
Neutralino.init();

// Register event listeners
Neutralino.events.on("trayMenuItemClicked", onTrayMenuItemClicked);
Neutralino.events.on("windowClose", onWindowClose);
Neutralino.events.on("ready", () => {
    const openFolderBtn = document.getElementById('openFolderBtn');
    const folderTree = document.getElementById('folderTree');
    const imageContainer = document.getElementById('imageContainer');

    const sortNameAscBtn = document.getElementById('sortNameAscBtn');
    const sortNameDescBtn = document.getElementById('sortNameDescBtn');
    const sortModifiedAscBtn = document.getElementById('sortModifiedAscBtn');
    const sortModifiedDescBtn = document.getElementById('sortModifiedDescBtn');
    const groupByTypeBtn = document.getElementById('groupByTypeBtn');

    let currentFolder = '';
    const MAX_THREADS = 10;
    const MAX_QUEUE_SIZE = 10;
    let currentThreads = 0;
    const imageQueue = [];
    const CACHE_FILE = 'file_tree_cache.json';
    const CACHE_TTL = 86400000; // 24 hours in milliseconds

    // Debounce variables
    let scrollTimeout;

    const processQueue = async () => {
        if (currentThreads < MAX_THREADS && imageQueue.length > 0) {
            const imgElement = imageQueue.shift();
            currentThreads++;
            try {
                await loadImage(imgElement);
            } catch (error) {
                console.error('Error loading image:', error);
            } finally {
                currentThreads--;
                processQueue();
            }
        }
    };

    const loadImage = async (imgElement) => {
        const spinner = imgElement.parentElement.querySelector('.spinner');
        if (spinner) spinner.style.display = 'inline-block'; // Show spinner

        const data = await Neutralino.filesystem.readBinaryFile(imgElement.dataset.src);
        const blob = new Blob([new Uint8Array(data)], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        imgElement.src = url;
        imgElement.style.display = 'block';

        if (spinner) spinner.style.display = 'none'; // Hide spinner
        console.log(`Loaded image: ${imgElement.dataset.src}`);
    };

    const loadImagesInView = async () => {
        const windowSize = await Neutralino.window.getSize();
        const windowPos = await Neutralino.window.getPosition();

        const images = document.querySelectorAll('.image-box img');
        console.log('Checking images in view...');
        images.forEach(img => {
            const rect = img.getBoundingClientRect();
            const imgTop = rect.top + windowPos.y;
            const imgBottom = rect.bottom + windowPos.y;

            if ((imgTop < windowSize.height && imgBottom > 0) && !img.src && !imageQueue.includes(img)) {
                console.log(`Image in view: ${img.dataset.src}`);
                if (imageQueue.length >= MAX_QUEUE_SIZE) {
                    imageQueue.shift(); // Remove the oldest item if the queue exceeds the limit
                }
                imageQueue.push(img);
                processQueue();
            } else if ((imgTop >= windowSize.height || imgBottom <= 0) && img.src) {
                console.log(`Image out of view: ${img.dataset.src}`);
                URL.revokeObjectURL(img.src);
                img.src = '';
                img.style.display = 'none';
            }
        });
    };

    const readCache = async () => {
        try {
            const data = await Neutralino.filesystem.readFile(CACHE_FILE);
            const cache = JSON.parse(data);
            if (Date.now() - cache.timestamp < CACHE_TTL) {
                return cache.data;
            }
        } catch (error) {
            console.log('No valid cache found or cache is expired.');
        }
        return null;
    };

    const writeCache = async (data) => {
        const cache = {
            timestamp: Date.now(),
            data: data
        };
        await Neutralino.filesystem.writeFile(CACHE_FILE, JSON.stringify(cache));
        console.log('Cache updated.');
    };

    const loadFolderTree = async (path, container) => {
        const files = await Neutralino.filesystem.readDirectory(path);
        const folders = files.filter(file => file.type === 'DIRECTORY');
        folders.sort((a, b) => a.entry.localeCompare(b.entry));

        const ul = document.createElement('ul');
        folders.forEach(folder => {
            const li = document.createElement('li');
            li.textContent = folder.entry;
            li.addEventListener('click', async () => {
                currentFolder = `${path}/${folder.entry}`;
                await loadImages(currentFolder);
                loadFolderTree(currentFolder, li);
            });
            ul.appendChild(li);
        });
        container.appendChild(ul);

        // Update cache
        const data = { path, folders };
        await writeCache(data);
    };

    const loadImages = async (path) => {
        const files = await Neutralino.filesystem.readDirectory(path);
        const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file.entry));

        imageContainer.innerHTML = ''; // Clear current images
        imageFiles.forEach(file => {
            const imgBox = document.createElement('div');
            imgBox.classList.add('image-box');

            const img = document.createElement('img');
            img.dataset.src = `${path}/${file.entry}`;
            imgBox.appendChild(img);

            const spinner = document.createElement('div');
            spinner.classList.add('spinner');
            imgBox.appendChild(spinner);

            const info = document.createElement('div');
            info.classList.add('info');
            info.innerHTML = `<p>${file.entry}</p><p>${new Date(file.modified * 1000).toLocaleString()}</p>`;
            imgBox.appendChild(info);

            imageContainer.appendChild(imgBox);
        });

        console.log(`Loaded ${imageFiles.length} images from ${path}`);
        await loadImagesInView();
    };

    const sortFiles = (files, criteria) => {
        switch (criteria) {
            case 'nameAsc':
                return files.sort((a, b) => a.entry.localeCompare(b.entry));
            case 'nameDesc':
                return files.sort((a, b) => b.entry.localeCompare(a.entry));
            case 'modifiedAsc':
                return files.sort((a, b) => a.modified - b.modified);
            case 'modifiedDesc':
                return files.sort((a, b) => b.modified - a.modified);
            default:
                return files;
        }
    };

    const groupFilesByType = (files) => {
        const grouped = {};
        files.forEach(file => {
            const ext = file.entry.split('.').pop();
            if (!grouped[ext]) grouped[ext] = [];
            grouped[ext].push(file);
        });
        return Object.values(grouped).flat();
    };

    openFolderBtn.addEventListener('click', async () => {
        const folderPath = await Neutralino.os.showFolderDialog('Select a folder');
        if (!folderPath) return;

        currentFolder = folderPath;
        folderTree.innerHTML = ''; // Clear current folder tree
        const cacheData = await readCache();
        if (cacheData && cacheData.path === folderPath) {
            // Load from cache
            loadCachedFolderTree(cacheData.folders, folderTree);
        } else {
            // Load from file system
            loadFolderTree(folderPath, folderTree);
        }
        await loadImages(folderPath);
    });

    const loadCachedFolderTree = (folders, container) => {
        const ul = document.createElement('ul');
        folders.forEach(folder => {
            const li = document.createElement('li');
            li.textContent = folder.entry;
            li.addEventListener('click', async () => {
                currentFolder = `${currentFolder}/${folder.entry}`;
                await loadImages(currentFolder);
                loadFolderTree(currentFolder, li);
            });
            ul.appendChild(li);
        });
        container.appendChild(ul);
    };

    sortNameAscBtn.addEventListener('click', async () => {
        const files = await Neutralino.filesystem.readDirectory(currentFolder);
        const sortedFiles = sortFiles(files, 'nameAsc');
        await loadImages(currentFolder, sortedFiles);
    });

    sortNameDescBtn.addEventListener('click', async () => {
        const files = await Neutralino.filesystem.readDirectory(currentFolder);
        const sortedFiles = sortFiles(files, 'nameDesc');
        await loadImages(currentFolder, sortedFiles);
    });

    sortModifiedAscBtn.addEventListener('click', async () => {
        const files = await Neutralino.filesystem.readDirectory(currentFolder);
        const sortedFiles = sortFiles(files, 'modifiedAsc');
        await loadImages(currentFolder, sortedFiles);
    });

    sortModifiedDescBtn.addEventListener('click', async () => {
        const files = await Neutralino.filesystem.readDirectory(currentFolder);
        const sortedFiles = sortFiles(files, 'modifiedDesc');
        await loadImages(currentFolder, sortedFiles);
    });

    groupByTypeBtn.addEventListener('click', async () => {
        const files = await Neutralino.filesystem.readDirectory(currentFolder);
        const groupedFiles = groupFilesByType(files);
        await loadImages(currentFolder, groupedFiles);
    });

    const debounce = (func, wait) => {
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(scrollTimeout);
                func(...args);
            };

            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(later, wait);
        };
    };

    const handleScroll = debounce(() => {
        imageQueue.length = 0; // Clear the download queue
        loadImagesInView();
    }, 100);

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
});

// Conditional initialization: Set up system tray if not running on macOS
if (NL_OS != "Darwin") { // TODO: Fix https://github.com/neutralinojs/neutralinojs/issues/615
    setTray();
}
