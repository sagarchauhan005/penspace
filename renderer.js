const { ipcRenderer } = require('electron');
const path = require('path');

// Get DOM elements
const editor = document.getElementById('editor');
const wordCount = document.getElementById('word-count');
const charCount = document.getElementById('char-count');
const sidebar = document.getElementById('sidebar');
const fileTree = document.getElementById('file-tree');
const filePath = document.getElementById('file-path');
const currentFileIndicator = document.getElementById('current-file-indicator');

// Get buttons - FIXED: Use files-top-btn instead of files-btn
const newBtn = document.getElementById('new-btn');
const saveBtn = document.getElementById('save-btn');
const openBtn = document.getElementById('open-btn');
const filesTopBtn = document.getElementById('files-top-btn'); // FIXED: Correct ID
const fullscreenBtn = document.getElementById('fullscreen-btn');

// Track current open file and autosave file
let currentOpenFile = null;
let autoSaveFilename = '';

// Auto-save timer
let autoSaveTimer;
const AUTO_SAVE_DELAY = 3000; // 3 seconds

// Handle placeholder text cycling
const placeholders = [
    "Start typing...",
    "What's on your mind?",
    "Write something amazing...",
    "Once upon a time...",
    "Dear diary...",
    "Ideas go here...",
    "Begin your masterpiece...",
    "Just write."
];

let currentPlaceholder = 0;

// Cycle through placeholders every few seconds
function cyclePlaceholders() {
    if (!editor.innerText.trim()) { // Only change if editor is empty
        currentPlaceholder = (currentPlaceholder + 1) % placeholders.length;
        editor.setAttribute('data-placeholder', placeholders[currentPlaceholder]);
    }
}

// Start cycling placeholders
const placeholderInterval = setInterval(cyclePlaceholders, 2000);

// Auto-save content function
function autoSaveContent() {
    console.log('Auto-saving content...');

    // If no file is open yet, create a new one with timestamp
    if (!currentOpenFile) {
        const now = new Date();
        const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const uniqueId = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const content = editor.innerText.trim();
        let baseName = 'Pen';

        autoSaveFilename = `${baseName} - ${date} ${uniqueId}.txt`;

        console.log('Creating new auto-save file:', autoSaveFilename);

        // Show the filename in the top-left
        filePath.textContent = autoSaveFilename;
        filePath.classList.add('editable');
    }

    // Send content to be saved
    ipcRenderer.send('auto-save-content', currentOpenFile || autoSaveFilename, editor.innerText.trim());
}

// Update word and character counts
function updateCounts() {
    const text = editor.innerText.trim();
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;

    wordCount.textContent = `${words} words`;
    charCount.textContent = `${chars} chars`;

    // Reset auto-save timer
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        // FIXED: Call autosave if there's content but no current file
        if (text.trim().length > 0) {
            if (currentOpenFile) {
                ipcRenderer.send('save-content', editor.innerText.trim());
            } else {
                autoSaveContent();
            }
        }
    }, AUTO_SAVE_DELAY);
}

// Show current file indicator temporarily
function showCurrentFileIndicator() {
    currentFileIndicator.classList.add('visible');
    setTimeout(() => {
        currentFileIndicator.classList.remove('visible');
    }, 2000);
}

// Handle the typing state to move text to top left and trigger autosave
editor.addEventListener('input', function() {
    // Check if this is the first input and no file is open
    const isFirstInput = !editor.classList.contains('typing') && editor.innerText.trim().length > 0;

    if (editor.innerText.trim().length > 0) {
        editor.classList.add('typing');

        // If this is the first input and no file exists yet, create one immediately
        if (isFirstInput && !currentOpenFile) {
            console.log('First input detected, creating auto-save file');
            autoSaveContent();
        }
    } else {
        editor.classList.remove('typing');
    }

    updateCounts();
});

// Toggle sidebar visibility
function toggleSidebar() {
    console.log('Toggling sidebar');
    sidebar.classList.toggle('visible');
    console.log('Sidebar visible:', sidebar.classList.contains('visible'));

    // If opening the sidebar, request fresh file tree data
    if (sidebar.classList.contains('visible')) {
        console.log('Requesting updated file tree');
        ipcRenderer.send('request-file-tree');
    }
}

// Close sidebar when close button is clicked
const closeSidebarBtn = document.getElementById('close-sidebar');
if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent event bubbling
        toggleSidebar();
    });
}

// Create new file function
function newFile() {
    console.log('Creating new file');
    if (editor.innerText.trim() !== '') {
        // Ask to save current file if there's content
        const shouldSave = confirm('Do you want to save the current file?');
        if (shouldSave) {
            saveFile();
        }
    }

    editor.innerText = '';
    currentOpenFile = null;
    autoSaveFilename = '';
    filePath.textContent = 'Untitled';
    updateCounts();
    editor.focus();
    editor.classList.remove('typing');
}

// Handle save dialog
const saveDialogOverlay = document.getElementById('save-dialog-overlay');
const saveFilenameInput = document.getElementById('save-filename');
const saveDialogCancelBtn = document.getElementById('save-dialog-cancel');
const saveDialogSaveBtn = document.getElementById('save-dialog-save');

// Save file function - opens a dialog over the editor
function saveFile() {
    console.log('Saving file');
    // Show custom save dialog
    saveDialogOverlay.classList.add('visible');
    saveFilenameInput.focus();

    // Pre-fill with current filename if exists
    if (currentOpenFile) {
        saveFilenameInput.value = path.basename(currentOpenFile);
    } else if (autoSaveFilename) {
        saveFilenameInput.value = autoSaveFilename;
    }
}

// Handle save dialog buttons
if (saveDialogCancelBtn) {
    saveDialogCancelBtn.addEventListener('click', function() {
        saveDialogOverlay.classList.remove('visible');
    });
}

if (saveDialogSaveBtn) {
    saveDialogSaveBtn.addEventListener('click', function() {
        const filename = saveFilenameInput.value.trim();
        if (filename) {
            // Send filename to main process to save
            ipcRenderer.send('save-file-with-name', filename, editor.innerText.trim());
            saveDialogOverlay.classList.remove('visible');
        }
    });
}

// Close dialog on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && saveDialogOverlay.classList.contains('visible')) {
        saveDialogOverlay.classList.remove('visible');
    }
});

// Toggle distraction-free mode
let isDistractFreeMode = false;
function toggleDistractionFree() {
    isDistractFreeMode = !isDistractFreeMode;
    console.log('Toggling distraction-free mode:', isDistractFreeMode);

    // Update button text based on current state
    if (fullscreenBtn) {
        fullscreenBtn.textContent = isDistractFreeMode ? "Normal Mode" : "Focus Mode";
    }

    // Send to main process to toggle fullscreen
    ipcRenderer.send('toggle-fullscreen');
}

// Add event listeners for buttons
if (newBtn) {
    newBtn.addEventListener('click', function() {
        console.log('New button clicked');
        newFile();
    });
}

if (saveBtn) {
    saveBtn.addEventListener('click', function() {
        console.log('Save button clicked');
        saveFile();
    });
}

if (openBtn) {
    openBtn.addEventListener('click', function() {
        console.log('Open button clicked');
        ipcRenderer.send('open-file-dialog');
    });
}

// FIXED: Use filesTopBtn instead of filesBtn
if (filesTopBtn) {
    filesTopBtn.addEventListener('click', function() {
        console.log('Files top button clicked');
        toggleSidebar();
    });
} else {
    console.error('Files top button not found in the DOM!');
}

if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', function() {
        console.log('Distraction Free button clicked');
        toggleDistractionFree();
    });
}

// Handle key commands
document.addEventListener('keydown', (e) => {
    // Ctrl+S or Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
    }

    // Ctrl+O or Cmd+O to open
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        ipcRenderer.send('open-file-dialog');
    }

    // Ctrl+N or Cmd+N for new file
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        newFile();
    }

    // Escape to hide sidebar
    if (e.key === 'Escape' && sidebar.classList.contains('visible')) {
        toggleSidebar();
    }
});

// Listen for new file request
ipcRenderer.on('new-file', () => {
    newFile();
});

// Listen for file opened
ipcRenderer.on('file-opened', (event, content, fullPath) => {
    editor.innerText = content;
    currentOpenFile = fullPath;
    filePath.textContent = fullPath ? path.basename(fullPath) : 'Untitled';
    filePath.classList.add('editable');
    updateCounts();
    editor.focus();
    editor.classList.add('typing');

    // Update active file in the sidebar
    updateActiveFileInTree(fullPath);
});

// Listen for save request
ipcRenderer.on('save-requested', () => {
    ipcRenderer.send('save-content', editor.innerText.trim());
});

// File saved confirmation
ipcRenderer.on('file-saved', (event, savedPath) => {
    currentOpenFile = savedPath;
    filePath.textContent = path.basename(savedPath);
    filePath.classList.add('editable');
});

// Listen for auto-save completion
ipcRenderer.on('auto-save-complete', (event, filePath) => {
    console.log('Auto-save complete:', filePath);
    currentOpenFile = filePath;

    // Update the filename in UI
    if (this.filePath) {
        this.filePath.textContent = path.basename(filePath);
        this.filePath.classList.add('editable');
    }
});

ipcRenderer.on('auto-save-error', (event, errorMessage) => {
    console.error('Auto-save error:', errorMessage);
    alert(`Error saving file: ${errorMessage}`);
});

// Handle file tree updates
ipcRenderer.on('update-file-tree', (event, fileStructure) => {
    console.log('Received file tree update:', fileStructure);
    renderFileTree(fileStructure);
});

// Listen for file events
ipcRenderer.on('file-renamed', (event, newPath) => {
    currentOpenFile = newPath;
    filePath.textContent = path.basename(newPath);
});

ipcRenderer.on('file-deleted', () => {
    // Current file was deleted
    currentOpenFile = null;
    filePath.textContent = 'Untitled';

    // Create a new autosave file if there's content
    if (editor.innerText.trim().length > 0) {
        autoSaveContent();
    }
});

ipcRenderer.on('rename-error', (event, errorMessage) => {
    alert(`Error renaming file: ${errorMessage}`);
});

ipcRenderer.on('delete-error', (event, errorMessage) => {
    alert(`Error deleting item: ${errorMessage}`);
});

// Render the file tree from the provided structure
function renderFileTree(items) {
    console.log('Rendering file tree with items:', items);
    fileTree.innerHTML = '';

    if (!items || items.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.textContent = 'No files found in the folder';
        emptyMessage.style.padding = '10px';
        emptyMessage.style.color = '#aaa';
        fileTree.appendChild(emptyMessage);

        console.log('No files found in the folder');
        return;
    }

    items.forEach(item => {
        const itemElement = createFileTreeItem(item);
        fileTree.appendChild(itemElement);
    });

    // If a file is currently open, highlight it
    if (currentOpenFile) {
        updateActiveFileInTree(currentOpenFile);
    }
}

// Create a file tree item (file or folder)
function createFileTreeItem(item) {
    const itemElement = document.createElement('div');
    itemElement.className = item.isDirectory ? 'tree-item tree-folder' : 'tree-item tree-file';

    // Create delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-item';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent opening the file/folder

        // Ask for confirmation
        const itemType = item.isDirectory ? 'folder' : 'file';
        const confirmMessage = `Are you sure you want to delete this ${itemType}?\n${item.name}`;

        if (confirm(confirmMessage)) {
            console.log(`Deleting ${itemType}:`, item.path);
            ipcRenderer.send('delete-item', item.path, item.isDirectory);
        }
    });

    // Add toggle for directories
    if (item.isDirectory) {
        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle';
        toggle.textContent = '▶';
        itemElement.appendChild(toggle);

        // Folder name
        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.name;
        itemElement.appendChild(nameSpan);

        // Add delete button
        itemElement.appendChild(deleteBtn);

        // Container for subfolder/files
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-folder-contents';
        childrenContainer.style.display = 'none';

        // Add children if they exist
        if (item.children && item.children.length > 0) {
            item.children.forEach(child => {
                const childElement = createFileTreeItem(child);
                childrenContainer.appendChild(childElement);
            });
        }

        // Toggle folder open/closed
        itemElement.addEventListener('click', (e) => {
            if (e.target === toggle || e.target === nameSpan) {
                e.stopPropagation();
                const isOpen = childrenContainer.style.display !== 'none';
                toggle.textContent = isOpen ? '▶' : '▼';
                childrenContainer.style.display = isOpen ? 'none' : 'block';
            }
        });

        // Add the children container
        itemElement.appendChild(childrenContainer);
    } else {
        // File item
        itemElement.setAttribute('data-path', item.path);
        itemElement.textContent = item.name;

        // Add delete button
        itemElement.appendChild(deleteBtn);

        // Open file on click
        itemElement.addEventListener('click', () => {
            ipcRenderer.send('open-file', item.path);
        });
    }

    return itemElement;
}

// Update active file highlight in the file tree
function updateActiveFileInTree(activePath) {
    // Remove active class from all items
    document.querySelectorAll('.tree-item').forEach(item => {
        item.classList.remove('active');
    });

    // Add active class to the current file
    if (activePath) {
        const activeItem = document.querySelector(`.tree-item[data-path="${activePath}"]`);
        if (activeItem) {
            activeItem.classList.add('active');

            // Expand parent folders if needed
            let parent = activeItem.parentElement;
            while (parent && parent.classList.contains('tree-folder-contents')) {
                parent.style.display = 'block';
                const toggle = parent.previousSibling.querySelector('.tree-toggle');
                if (toggle) {
                    toggle.textContent = '▼';
                }
                parent = parent.parentElement.parentElement;
            }
        }
    }
}

// Make the filename editable
filePath.addEventListener('click', function() {
    if (filePath.classList.contains('editable')) {
        // Make the filename editable
        const currentName = filePath.textContent;
        filePath.contentEditable = true;
        filePath.classList.add('editing');
        filePath.focus();

        // Select the filename part before the extension
        const dotIndex = currentName.lastIndexOf('.');
        if (dotIndex > 0) {
            const range = document.createRange();
            const sel = window.getSelection();
            range.setStart(filePath.firstChild, 0);
            range.setEnd(filePath.firstChild, dotIndex);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
});

// Handle editing completion
filePath.addEventListener('blur', function() {
    if (filePath.contentEditable === 'true') {
        finishFileNameEditing();
    }
});

filePath.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        finishFileNameEditing();
    }
});

// Finish editing the filename
function finishFileNameEditing() {
    filePath.contentEditable = false;
    filePath.classList.remove('editing');

    const newName = filePath.textContent.trim();
    if (newName && currentOpenFile && newName !== path.basename(currentOpenFile)) {
        // Send a request to rename the file
        ipcRenderer.send('rename-file', currentOpenFile, newName);
    }
}

// Debug initial state
console.log('Initial setup complete');
console.log('Editor element:', editor);
console.log('Sidebar element:', sidebar);
console.log('Files top button:', filesTopBtn);

// Initialize the sidebar as hidden
if (sidebar && !sidebar.classList.contains('visible')) {
    console.log('Sidebar initialized as hidden');
}

// Force placeholder to show on startup
if (editor) {
    editor.setAttribute('placeholder', placeholders[currentPlaceholder]);
    console.log('Placeholder set to:', placeholders[currentPlaceholder]);
}

// Initialize counts and file list
updateCounts();

// Force initial file tree loading
ipcRenderer.send('request-file-tree');

// Put focus on editor when the app loads
window.addEventListener('load', () => {
    editor.focus();
});

// Theme handling
const themeOptions = document.querySelectorAll('.theme-option');
const customColorPicker = document.getElementById('custom-color-picker');
let currentTheme = 'light';

// Set active theme indicator
function updateActiveTheme(themeName) {
    themeOptions.forEach(option => {
        if (option.dataset.theme === themeName) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

// Apply theme to document
function applyTheme(themeName, customColor = null) {
    // Remove all theme classes
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-sepia', 'theme-blue', 'theme-green', 'theme-custom');

    if (themeName === 'custom' && customColor) {
        // Apply custom theme with the selected color
        document.documentElement.style.setProperty('--bg-color', adjustBrightness(customColor, 0.95));
        document.documentElement.style.setProperty('--text-color', getContrastColor(customColor));
        document.documentElement.style.setProperty('--placeholder-color', adjustBrightness(customColor, 0.7));
        document.documentElement.style.setProperty('--ui-color', adjustBrightness(customColor, 0.5));
        document.documentElement.style.setProperty('--ui-hover-color', adjustBrightness(customColor, 0.3));
        document.documentElement.style.setProperty('--border-color', adjustBrightness(customColor, 0.85));
        document.documentElement.style.setProperty('--sidebar-bg', adjustBrightness(customColor, 0.95));
        document.documentElement.style.setProperty('--sidebar-border', adjustBrightness(customColor, 0.85));
        document.documentElement.style.setProperty('--ui-bg-hover', adjustBrightness(customColor, 0.9));
        document.documentElement.style.setProperty('--file-indicator-bg', `${adjustBrightness(customColor, 0.95, 0.8)}`);
        document.documentElement.style.setProperty('--tree-item-active', adjustBrightness(customColor, 0.85));

        document.body.classList.add('theme-custom');
    } else {
        // Apply predefined theme
        document.body.classList.add(`theme-${themeName}`);
        // Reset any custom CSS variables
        document.documentElement.style.removeProperty('--bg-color');
        document.documentElement.style.removeProperty('--text-color');
        document.documentElement.style.removeProperty('--placeholder-color');
        document.documentElement.style.removeProperty('--ui-color');
        document.documentElement.style.removeProperty('--ui-hover-color');
        document.documentElement.style.removeProperty('--border-color');
        document.documentElement.style.removeProperty('--sidebar-bg');
        document.documentElement.style.removeProperty('--sidebar-border');
        document.documentElement.style.removeProperty('--ui-bg-hover');
        document.documentElement.style.removeProperty('--file-indicator-bg');
        document.documentElement.style.removeProperty('--tree-item-active');
    }

    // Update active theme indicator
    updateActiveTheme(themeName);
    currentTheme = themeName;

    // Save user preference
    localStorage.setItem('penspace-theme', themeName);
    if (customColor) {
        localStorage.setItem('penspace-custom-color', customColor);
    }
}

// Helper function to adjust color brightness
function adjustBrightness(hex, factor, alpha = 1) {
    // Convert hex to RGB
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    // Adjust brightness
    r = Math.min(255, Math.max(0, Math.round(r * factor)));
    g = Math.min(255, Math.max(0, Math.round(g * factor)));
    b = Math.min(255, Math.max(0, Math.round(b * factor)));

    // Convert back to hex
    const hexResult = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);

    if (alpha < 1) {
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    return hexResult;
}

// Function to determine if a color is light or dark
function getContrastColor(hex) {
    // Convert hex to RGB
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    // Calculate perceived brightness using the formula: (0.299*R + 0.587*G + 0.114*B)
    const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // If the color is light, return dark text; otherwise, return light text
    return brightness > 0.7 ? '#333333' : '#ffffff';
}

// Set up event listeners for theme options
themeOptions.forEach(option => {
    option.addEventListener('click', function() {
        const themeName = this.dataset.theme;

        if (themeName === 'custom') {
            // Show color picker when custom theme is clicked
            customColorPicker.click();
        } else {
            applyTheme(themeName);
        }
    });
});

// Handle custom color picker changes
customColorPicker.addEventListener('input', function() {
    const customColor = this.value;
    applyTheme('custom', customColor);

    // Update the custom theme button style
    const customButton = document.querySelector('.theme-option[data-theme="custom"]');
    customButton.style.background = customColor;

    // Adjust text color based on brightness
    customButton.style.color = getContrastColor(customColor);
});

// Load saved theme on startup
window.addEventListener('load', function() {
    const savedTheme = localStorage.getItem('penspace-theme') || 'light';
    const savedCustomColor = localStorage.getItem('penspace-custom-color');

    if (savedTheme === 'custom' && savedCustomColor) {
        applyTheme('custom', savedCustomColor);
        customColorPicker.value = savedCustomColor;

        // Update the custom theme button style
        const customButton = document.querySelector('.theme-option[data-theme="custom"]');
        customButton.style.background = savedCustomColor;
        customButton.style.color = getContrastColor(savedCustomColor);
    } else {
        applyTheme(savedTheme);
    }
});

// Footer behavior management
const appContainer = document.getElementById('app-container');
let footerUsed = false;

// Hide footer after it's been used
function manageFooterVisibility() {
    const footerMenu = document.getElementById('footer-menu');

    // Listen for any button click in the footer
    footerMenu.addEventListener('click', () => {
        // Mark that the footer has been used
        footerUsed = true;

        // Add class to keep footer hidden until hover
        appContainer.classList.add('footer-always-hidden');

        // Save this preference
        localStorage.setItem('penspace-footer-hidden', 'true');
    });

    // Load saved preference
    if (localStorage.getItem('penspace-footer-hidden') === 'true') {
        appContainer.classList.add('footer-always-hidden');
    }
}

// Initialize footer behavior
manageFooterVisibility();

// Update fullscreen button icon based on state
function updateFullscreenIcon() {
    if (fullscreenBtn) {
        if (isDistractFreeMode) {
            fullscreenBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>`;
            fullscreenBtn.title = "Normal Mode";
        } else {
            fullscreenBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>`;
            fullscreenBtn.title = "Focus Mode";
        }
    }
}

// Update the toggle distraction-free mode function
function toggleDistractionFree() {
    isDistractFreeMode = !isDistractFreeMode;
    console.log('Toggling distraction-free mode:', isDistractFreeMode);

    // Update button icon based on current state
    updateFullscreenIcon();

    // Send to main process to toggle fullscreen
    ipcRenderer.send('toggle-fullscreen');
}