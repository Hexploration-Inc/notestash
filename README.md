# Text Highlighter Chrome Extension

A simple Chrome extension that allows users to highlight text on web pages and automatically saves these highlights. The highlights persist across browser sessions and are automatically restored when you revisit the page.

## Features
- Highlight any text on web pages
- Automatic saving of highlights to local storage
- Persistent highlights across browser sessions
- View all your highlights in the popup window
- Clear all highlights with one click

## Installation
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the extension directory
4. The extension icon should appear in your Chrome toolbar

## Usage
1. Select any text on a webpage to highlight it
2. Click the extension icon to view all your saved highlights
3. Use the "Clear All Highlights" button to remove all saved highlights

## Files
- `manifest.json`: Extension configuration
- `popup.html`: Extension popup interface
- `popup.js`: Popup functionality
- `content.js`: Core highlighting functionality

## Technical Details
- Uses Chrome Storage API for persistence
- Highlights are stored per URL
- Each highlight has a unique ID and timestamp
