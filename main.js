// First, import all required modules
const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const chokidar = require('chokidar');

// Define variables
let mainWindow;
let currentFile = null;
let watcher;

// Define the dedicated folder path on desktop
const freewriteFolder = path.join(os.homedir(), 'Desktop', 'Freewrite');

// Ensure the Freewrite folder exists
function ensureFreewriteFolderExists() {
    if (!fs.existsSync(freewriteFolder)) {
        try {
            fs.mkdirSync(freewriteFolder, { recursive: true });
            console.log(`Created Freewrite folder at: ${freewriteFolder}`);
        } catch (err) {
            console.error('Error creating Freewrite folder:', err);
        }
    }
}

// Get files in the Freewrite folder
function getFilesInFreewriteFolder() {
    try {
        const items = fs.readdirSync(freewriteFolder, { withFileTypes: true });

        const fileStructure = items.map(item => {
            const itemPath = path.join(freewriteFolder, item.name);
            return {
                name: item.name,
                path: itemPath,
                isDirectory: item.isDirectory(),
                children: item.isDirectory() ? getFilesInDirectory(itemPath) : null
            };
        });

        return fileStructure;
    } catch (err) {
        console.error('Error reading Freewrite folder:', err);
        return [];
    }
}

// Get files in a specific directory
function getFilesInDirectory(directoryPath) {
    try {
        const items = fs.readdirSync(directoryPath, { withFileTypes: true });

        return items.map(item => {
            const itemPath = path.join(directoryPath, item.name);
            return {
                name: item.name,
                path: itemPath,
                isDirectory: item.isDirectory(),
                children: item.isDirectory() ? getFilesInDirectory(itemPath) : null
            };
        });
    } catch (err) {
        console.error(`Error reading directory ${directoryPath}:`, err);
        return [];
    }
}

// Create the main window
function createWindow() {
    ensureFreewriteFolderExists();

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        backgroundColor: '#ffffff',
        icon: path.join(__dirname, 'assets/icon.png'),
        frame: false,
        fullscreen: true
    });

    mainWindow.loadFile('index.html');
    mainWindow.setMenuBarVisibility(false);

    // Create custom menu
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow.webContents.send('new-file');
                    }
                },
                {
                    label: 'Open',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => {
                        openFile();
                    }
                },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: saveFile
                },
                {
                    label: 'Save As',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: saveFileAs
                },
                { type: 'separator' },
                {
                    label: 'Toggle Sidebar',
                    accelerator: 'Escape',
                    click: () => {
                        mainWindow.webContents.send('toggle-sidebar');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'delete' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { type: 'separator' },
                {
                    label: 'Toggle Menu Bar',
                    accelerator: 'Alt',
                    click: () => {
                        const visible = mainWindow.isMenuBarVisible();
                        mainWindow.setMenuBarVisibility(!visible);
                    }
                },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Send the file structure to the renderer
    const fileStructure = getFilesInFreewriteFolder();
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('update-file-tree', fileStructure);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// File operations functions
function openFile() {
    const files = dialog.showOpenDialogSync(mainWindow, {
        properties: ['openFile'],
        defaultPath: freewriteFolder,
        filters: [
            { name: 'Text Files', extensions: ['txt', 'md'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    if (files) {
        currentFile = files[0];
        const content = fs.readFileSync(currentFile, 'utf8');
        mainWindow.webContents.send('file-opened', content, currentFile);
    }
}

function saveFile() {
    if (!currentFile) {
        saveFileAs();
        return;
    }

    mainWindow.webContents.send('save-requested');
}

function saveFileAs() {
    const file = dialog.showSaveDialogSync(mainWindow, {
        defaultPath: freewriteFolder,
        filters: [
            { name: 'Text Files', extensions: ['txt'] },
            { name: 'Markdown Files', extensions: ['md'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (file) {
        currentFile = file;
        mainWindow.webContents.send('save-requested');
    }
}

// Set up file watcher with chokidar
function setupFileWatcher() {
    // Close existing watcher if it exists
    if (watcher) {
        watcher.close();
    }

    // Initialize watcher with proper options
    watcher = chokidar.watch(freewriteFolder, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true, // don't fire events for existing files
        awaitWriteFinish: {
            stabilityThreshold: 300,
            pollInterval: 100
        }
    });

    // Debounce function to avoid excessive updates
    let debounceTimeout;
    const updateFileTree = () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            const fileStructure = getFilesInFreewriteFolder();
            if (mainWindow) {
                mainWindow.webContents.send('update-file-tree', fileStructure);
            }
        }, 300);
    };

    // Set up event listeners
    watcher
        .on('add', updateFileTree)
        .on('unlink', updateFileTree)
        .on('addDir', updateFileTree)
        .on('unlinkDir', updateFileTree)
        .on('change', updateFileTree)
        .on('error', error => console.log(`Watcher error: ${error}`));
}

// App event handlers
app.whenReady().then(() => {
    createWindow();
    setupFileWatcher();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    if (watcher) {
        watcher.close();
    }
});

// IPC handlers
ipcMain.on('save-content', (event, content) => {
    if (currentFile) {
        fs.writeFileSync(currentFile, content);

        // After saving, refresh the file tree and notify renderer
        const fileStructure = getFilesInFreewriteFolder();
        mainWindow.webContents.send('update-file-tree', fileStructure);
        mainWindow.webContents.send('file-saved', currentFile);
    }
});

ipcMain.on('open-file', (event, filePath) => {
    if (fs.existsSync(filePath)) {
        currentFile = filePath;
        const content = fs.readFileSync(filePath, 'utf8');
        mainWindow.webContents.send('file-opened', content, filePath);
    }
});

ipcMain.on('create-folder', (event, folderName) => {
    if (folderName) {
        const newFolderPath = path.join(freewriteFolder, folderName);
        if (!fs.existsSync(newFolderPath)) {
            fs.mkdirSync(newFolderPath);

            // Update file tree
            const fileStructure = getFilesInFreewriteFolder();
            mainWindow.webContents.send('update-file-tree', fileStructure);
        }
    }
});

ipcMain.on('open-file-dialog', () => {
    openFile();
});

// Add handler for fullscreen toggle
ipcMain.on('toggle-fullscreen', () => {
    if (mainWindow) {
        const isFullscreen = mainWindow.isFullScreen();
        mainWindow.setFullScreen(!isFullscreen);
    }
});