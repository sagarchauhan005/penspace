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

// Get buttons
const newBtn = document.getElementById('new-btn');
const saveBtn = document.getElementById('save-btn');
const openBtn = document.getElementById('open-btn');
const filesBtn = document.getElementById('files-top-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');

// Track current open file
let currentOpenFile = null;

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
    if (!editor.value.trim()) { // Only change if editor is empty
        currentPlaceholder = (currentPlaceholder + 1) % placeholders.length;
        editor.setAttribute('placeholder', placeholders[currentPlaceholder]);
    }
}

// Start cycling placeholders
const placeholderInterval = setInterval(cyclePlaceholders, 3000);

// Update word and character counts
function updateCounts() {
    const text = editor.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;

    wordCount.textContent = `${words} words`;
    charCount.textContent = `${chars} chars`;

    // Reset auto-save timer
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        if (currentOpenFile) {
            ipcRenderer.send('save-content', editor.value);
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

// Handle the typing state to move text to top left
editor.addEventListener('input', function() {
    if (editor.value.trim().length > 0) {
        editor.classList.add('typing');
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
    if (editor.value.trim() !== '') {
        // Ask to save current file if there's content
        const shouldSave = confirm('Do you want to save the current file?');
        if (shouldSave) {
            saveFile();
        }
    }

    editor.value = '';
    currentOpenFile = null;
    filePath.textContent = 'Untitled';
    updateCounts();
    editor.focus();
    editor.classList.remove('typing');
}

// Save file function - opens a dialog over the editor
function saveFile() {
    console.log('Saving file');
    // Always show save dialog
    ipcRenderer.send('save-file-dialog');
}

// Toggle distraction-free mode
let isDistractFreeMode = false;
function toggleDistractionFree() {
    isDistractFreeMode = !isDistractFreeMode;
    console.log('Toggling distraction-free mode:', isDistractFreeMode);

    // Update button text based on current state
    if (fullscreenBtn) {
        fullscreenBtn.textContent = isDistractFreeMode ? "Normal" : "Distraction Free";
    }

    // Send to main process to toggle fullscreen
    ipcRenderer.send('toggle-fullscreen');
}

// Add event listeners for buttons
if (newBtn) newBtn.addEventListener('click', function() {
    console.log('New button clicked');
    newFile();
});

if (saveBtn) saveBtn.addEventListener('click', function() {
    console.log('Save button clicked');
    saveFile();
});

if (openBtn) openBtn.addEventListener('click', function() {
    console.log('Open button clicked');
    ipcRenderer.send('open-file-dialog');
});

if (filesBtn) filesBtn.addEventListener('click', function() {
    console.log('Files button clicked');
    toggleSidebar();
});

if (fullscreenBtn) fullscreenBtn.addEventListener('click', function() {
    console.log('Distraction Free button clicked');
    toggleDistractionFree();
});

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
    editor.value = content;
    currentOpenFile = fullPath;
    filePath.textContent = fullPath ? path.basename(fullPath) : 'Untitled';
    updateCounts();
    editor.focus();
    editor.classList.add('typing');

    // Show file indicator
    showCurrentFileIndicator();

    // Update active file in the sidebar
    updateActiveFileInTree(fullPath);
});

// Listen for save request
ipcRenderer.on('save-requested', () => {
    ipcRenderer.send('save-content', editor.value);
});

// File saved confirmation
ipcRenderer.on('file-saved', (event, savedPath) => {
    currentOpenFile = savedPath;
    filePath.textContent = path.basename(savedPath);
    showCurrentFileIndicator();
});

// Handle file tree updates
ipcRenderer.on('update-file-tree', (event, fileStructure) => {
    console.log('Received file tree update:', fileStructure);
    renderFileTree(fileStructure);
});

// Render the file tree from the provided structure
function renderFileTree(items) {
    console.log('Rendering file tree with items:', items);
    fileTree.innerHTML = '';

    if (!items || items.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.textContent = 'No files found in the Penspace folder on desktop';
        emptyMessage.style.padding = '10px';
        emptyMessage.style.color = '#aaa';
        fileTree.appendChild(emptyMessage);

        console.log('No files found in the Penspace folder');
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

    // Add toggle for directories
    if (item.isDirectory) {
        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle';
        toggle.textContent = '▶ ';
        itemElement.appendChild(toggle);

        // Folder name
        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.name;
        itemElement.appendChild(nameSpan);

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
                toggle.textContent = isOpen ? '▶ ' : '▼ ';
                childrenContainer.style.display = isOpen ? 'none' : 'block';
            }
        });

        // Add the children container
        itemElement.appendChild(childrenContainer);
    } else {
        // File item
        itemElement.setAttribute('data-path', item.path);
        itemElement.textContent = item.name;

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
                    toggle.textContent = '▼ ';
                }
                parent = parent.parentElement.parentElement;
            }
        }
    }
}

// Debug initial state
console.log('Initial setup complete');
console.log('Editor element:', editor);
console.log('Sidebar element:', sidebar);
console.log('New button:', newBtn);
console.log('Save button:', saveBtn);
console.log('Open button:', openBtn);
console.log('Files button:', filesBtn);
console.log('Fullscreen button:', fullscreenBtn);

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