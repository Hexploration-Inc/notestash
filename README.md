# NoteStash Chrome Extension

A powerful Chrome extension that allows users to highlight text on web pages and attach notes to these highlights. All highlights and notes persist across browser sessions and are automatically restored when you revisit the page, creating your personal knowledge repository as you browse.

## Features
- Highlight any text on web pages with a simple selection
- Add detailed notes to any highlighted text
- Multiple highlight colors for visual organization
- Notes appear as indicators that expand on hover/click
- Edit and delete individual notes
- Automatic saving of all content to local storage
- Persistent highlights and notes across browser sessions
- View and manage all your saved content in the popup window
- Export and import your data for backup

## Installation
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the extension directory
4. The extension icon should appear in your Chrome toolbar

## Usage

### Basic Highlighting
1. Select any text on a webpage
2. Choose a highlight color from the popup palette
3. Click the highlight button or use keyboard shortcuts

### Adding Notes
1. Select text you want to annotate
2. Click the "Add Note" button in the selection palette
3. Enter your note in the popup editor and save
4. Note indicators will appear next to your highlighted text

### Managing Notes
1. Hover over note indicators to preview content
2. Click indicators to fully expand notes
3. Use edit and delete buttons within expanded notes
4. Access all notes via the extension popup

### Organization
1. Click the extension icon to view all saved content
2. Filter by page, date, or content
3. Search through all your highlights and notes
4. Export data for backup or sharing

## Files
- `manifest.json`: Extension configuration
- `popup.html`: Extension popup interface
- `popup.js`: Popup functionality
- `content.js`: Core highlighting functionality
- `notes.js`: Note-taking functionality
- `notes.css`: Styling for notes interface
- `styles.css`: Styling for highlight interface
- `background.js`: Background service worker
- `icons/`: Directory containing extension icons

## Technical Details
- Built on Manifest V3 for improved security and performance
- Uses Chrome Storage API for reliable data persistence
- Content is stored with URL-based organization
- Each highlight and note has a unique ID and timestamp
- Event-driven architecture for seamless user interaction
- Background script for cross-page functionality
- Modular code structure for maintainability
