// Import modules first - must be at the top of the file
const electron = require('electron');
const { app, BrowserWindow, Menu, dialog } = electron;
const ipcMain = electron.ipcMain; // Critical: Explicitly initialize ipcMain this way
const fs = require('fs');
const path = require('path');
const os = require('os');
const chokidar = require('chokidar');

// Declare variables
let mainWindow = null;
let currentFile = null;
let watcher = null;
const freewriteFolder = path.join(os.homedir(), 'Desktop', 'Penspace');

// Create Quill folder if it doesn't exist
function ensureFolderExists() {
    try {
        if (!fs.existsSync(freewriteFolder)) {
            fs.mkdirSync(freewriteFolder, { recursive: true });
            console.log(`Created folder at: ${freewriteFolder}`);
        }
    } catch (err) {
        console.error('Error creating folder:', err);
    }
}

// Get files from the folder
function getFilesInFolder() {
    try {
        console.log('Reading files from folder:', freewriteFolder);

        if (!fs.existsSync(freewriteFolder)) {
            console.log('Folder does not exist, creating it');
            ensureFolderExists();
            return [];
        }

        const items = fs.readdirSync(freewriteFolder, { withFileTypes: true });
        console.log('Found items in folder:', items.length);

        const fileStructure = items.map(item => {
            const itemPath = path.join(freewriteFolder, item.name);
            return {
                name: item.name,
                path: itemPath,
                isDirectory: item.isDirectory(),
                children: item.isDirectory() ? getFilesInDirectory(itemPath) : null
            };
        });

        console.log('Processed file structure:', fileStructure);
        return fileStructure;
    } catch (err) {
        console.error('Error reading folder:', err);
        return [];
    }
}

// Get files in a directory recursively
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
    ensureFolderExists();

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

    // Create menu template
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => mainWindow.webContents.send('new-file')
                },
                {
                    label: 'Open',
                    accelerator: 'CmdOrCtrl+O',
                    click: openFile
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
                    click: () => mainWindow.webContents.send('toggle-sidebar')
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => app.quit()
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

    // Send files to renderer
    mainWindow.webContents.on('did-finish-load', () => {
        const fileStructure = getFilesInFolder();
        mainWindow.webContents.send('update-file-tree', fileStructure);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Set up file watching
function setupFileWatcher() {
    if (watcher) {
        watcher.close();
    }

    watcher = chokidar.watch(freewriteFolder, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 300,
            pollInterval: 100
        }
    });

    let debounceTimeout;
    const updateFileTree = () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            if (mainWindow) {
                const fileStructure = getFilesInFolder();
                mainWindow.webContents.send('update-file-tree', fileStructure);
            }
        }, 300);
    };

    watcher
        .on('add', updateFileTree)
        .on('unlink', updateFileTree)
        .on('addDir', updateFileTree)
        .on('unlinkDir', updateFileTree)
        .on('change', updateFileTree)
        .on('error', error => console.log(`Watcher error: ${error}`));
}

// File handling functions
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

// IPC Handlers - set up after all functions are defined
ipcMain.on('save-content', (event, content) => {
    if (currentFile) {
        console.log('Saving content to file:', currentFile);
        fs.writeFileSync(currentFile, content);

        const fileStructure = getFilesInFolder();
        mainWindow.webContents.send('update-file-tree', fileStructure);
        mainWindow.webContents.send('file-saved', currentFile);
    }
});

ipcMain.on('open-file', (event, filePath) => {
    console.log('Opening file:', filePath);
    if (fs.existsSync(filePath)) {
        currentFile = filePath;
        const content = fs.readFileSync(filePath, 'utf8');
        mainWindow.webContents.send('file-opened', content, filePath);
    }
});

ipcMain.on('create-folder', (event, folderName) => {
    console.log('Creating folder:', folderName);
    if (folderName) {
        const newFolderPath = path.join(freewriteFolder, folderName);
        if (!fs.existsSync(newFolderPath)) {
            fs.mkdirSync(newFolderPath);

            const fileStructure = getFilesInFolder();
            mainWindow.webContents.send('update-file-tree', fileStructure);
        }
    }
});

ipcMain.on('open-file-dialog', () => {
    console.log('Opening file dialog');
    openFile();
});

ipcMain.on('save-file-dialog', () => {
    console.log('Opening save file dialog');
    saveFileAs();
});

ipcMain.on('toggle-fullscreen', () => {
    if (mainWindow) {
        const isFullscreen = mainWindow.isFullScreen();
        console.log('Toggling fullscreen mode, current state:', isFullscreen);
        mainWindow.setFullScreen(!isFullscreen);
    }
});

ipcMain.on('request-file-tree', () => {
    console.log('Received request for file tree');
    // Force creating the folder if it doesn't exist
    ensureFolderExists();
    const fileStructure = getFilesInFolder();
    console.log('Sending file structure to renderer:', fileStructure);
    if (mainWindow) {
        mainWindow.webContents.send('update-file-tree', fileStructure);
    }
});