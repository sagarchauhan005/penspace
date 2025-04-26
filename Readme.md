# Penspace

A simple, distraction-free writing application for focused writing sessions.

## See it in action
![penspace](https://github.com/user-attachments/assets/b299ca04-cb2e-459d-9f3a-5870b8c78f0c)

## Features

- **Clean, Distraction-Free Interface**: Focus on your writing without clutter
- **Auto-Saving**: Never lose your work with automatic saving
- **Multiple Themes**: Choose from light, dark, sepia, blue, green, or create your own custom theme
- **Word & Character Counts**: Keep track of your writing progress
- **File Management**: Organize your documents with a simple file system
- **Text Formatting**: Basic formatting options appear when you select text
- **Focus Mode**: Enter fullscreen mode for maximum concentration
- **Keyboard Shortcuts**: Quickly perform common actions`_**

## Installation

### Ubuntu and other Debian-based Linux distributions

#### Option 1: Download the .deb package

1. Download the latest .deb file from dist folder of this repo.
2. Install the package with:
   ```bash
   sudo dpkg -i penspace_1.0.0_amd64.deb
   ```
3. If you encounter dependency errors, run:
   ```bash
   sudo apt-get install -f
   ```

#### Option 2: Install via Snap (Coming Soon)

```bash
sudo snap install penspace
```

### Windows & Mac (Coming Soon)

## Usage

### Basic Controls

- **New Document**: Ctrl+N or click the "+" button
- **Save Document**: Ctrl+S or click the save icon
- **Open File Browser**: Click "Files" in the top-right corner
- **Focus Mode**: Click the focus icon in the bottom toolbar
- **Exit Application**: Click the X button or press Alt+F4/Cmd+Q

### Text Formatting

Select text to reveal the formatting toolbar, which allows you to:
- Bold, italic, and underline text
- Create ordered (numbered) and unordered (bullet) lists
- Add headings
- Remove formatting

### Themes

Click any color circle in the bottom-right corner to change themes. The "+" option allows you to select a custom color for your theme.

## Building from Source

### Prerequisites

- Node.js (v16 or newer)
- npm

### Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/username/penspace.git
   cd penspace
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the application in development mode:
   ```bash
   npm start
   ```

4. Build packages for your platform:
   ```bash
   # For Linux
   npm run build-linux
   
   # For Windows
   npm run build-win
   
   # For macOS
   npm run build-mac
   
   # For all platforms
   npm run build-all
   ```

Built packages will be available in the `dist` directory.

## Troubleshooting

### Application doesn't appear in menu after installation

Create or fix the desktop entry file:

```bash
sudo nano /usr/share/applications/penspace-minimal.desktop
```

Add the following content:

```
[Desktop Entry]
Name=Penspace Minimal
Comment=A simple, distraction-free writing app
Exec=/opt/Penspace\ -\ Minimal/penspace-minimal
Icon=/opt/Penspace\ -\ Minimal/resources/app/assets/icons/linux/icon.png
Terminal=false
Type=Application
Categories=Utility;TextEditor;
StartupWMClass=penspace-minimal
```

Then update the desktop database:

```bash
sudo update-desktop-database
```

### Windows: Missing ffmpeg.dll error

If you encounter an error about missing ffmpeg.dll, reinstall the application using the latest installer from the releases page, which includes all required dependencies.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
