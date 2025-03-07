// Notes functionality for the highlighter extension
// This code is kept separate from the highlighter functionality

// Store for notes
let notesCache = {};

// Initialize note system
function initializeNotes() {
  loadNotesFromStorage();
  createNoteUI();
  setupNoteEventListeners();
}

// Flag to track if note listeners are already set up
let noteListenersInitialized = false;

// Load all saved notes
function loadNotesFromStorage() {
  chrome.storage.local.get(['notes'], function(result) {
    if (result.notes) {
      notesCache = result.notes;
      console.log('Notes loaded from storage:', Object.keys(notesCache).length);
    }
  });
}

// Save note to storage
function saveNote(note) {
  // Add to local cache
  notesCache[note.id] = note;
  
  // Save to Chrome storage
  chrome.storage.local.set({ 'notes': notesCache }, function() {
    console.log('Note saved:', note.id);
  });
}

// Remove note from storage
function removeNote(noteId) {
  // Remove from local cache
  if (notesCache[noteId]) {
    delete notesCache[noteId];
    
    // Update Chrome storage
    chrome.storage.local.set({ 'notes': notesCache }, function() {
      console.log('Note removed:', noteId);
    });
    return true;
  }
  return false;
}

// Create note UI elements
function createNoteUI() {
  // Remove existing UI elements first to avoid duplicates
  const existingButton = document.getElementById('note-button');
  if (existingButton) existingButton.remove();
  
  const existingPopup = document.getElementById('note-popup');
  if (existingPopup) existingPopup.remove();
  
  // Create note button for palette
  const noteButton = document.createElement('button');
  noteButton.id = 'note-button';
  noteButton.className = 'note-button';
  noteButton.title = 'Add a note';
  noteButton.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2M20 16H5.2L4 17.2V4H20V16Z"></path></svg> Add Note';
  // Make sure it's visible by default with fixed size
  noteButton.style.display = 'none'; // Initially hidden, shown when text is selected
  noteButton.style.zIndex = '10000';
  
  // Add direct click handler to the button
  noteButton.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('Note button clicked directly');
    addNoteToSelection();
  });
  
  // Create note popup
  const notePopup = document.createElement('div');
  notePopup.id = 'note-popup';
  notePopup.className = 'note-popup';
  notePopup.style.display = 'none';
  
  // Create textarea for note content
  const noteTextarea = document.createElement('textarea');
  noteTextarea.id = 'note-content';
  noteTextarea.className = 'note-content';
  noteTextarea.placeholder = 'Enter your note...';
  
  // Create buttons for the popup
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'note-buttons';
  
  const saveButton = document.createElement('button');
  saveButton.id = 'note-save';
  saveButton.className = 'note-save-button';
  saveButton.textContent = 'Save';
  
  const cancelButton = document.createElement('button');
  cancelButton.id = 'note-cancel';
  cancelButton.className = 'note-cancel-button';
  cancelButton.textContent = 'Cancel';
  
  // Assemble the UI
  buttonContainer.appendChild(saveButton);
  buttonContainer.appendChild(cancelButton);
  notePopup.appendChild(noteTextarea);
  notePopup.appendChild(buttonContainer);
  
  // Add to document
  document.body.appendChild(noteButton);
  document.body.appendChild(notePopup);
}

// Function to handle adding a note to selected text
function addNoteToSelection() {
  console.log('Add note to selection triggered');
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (!selectedText) {
    console.warn('No text selected for adding a note');
    return;
  }
  
  // Show note popup
  const notePopup = document.getElementById('note-popup');
  const noteTextarea = document.getElementById('note-content');
  
  // Make sure popup exists
  if (!notePopup || !noteTextarea) {
    console.error('Note popup elements not found');
    createNoteUI(); // Try to recreate UI
    return;
  }
  
  // Position the note popup near the selection
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  if (!rect.width || !rect.height) return;
  
  // Position centered note popup with fixed dimensions
  notePopup.style.position = 'fixed';
  notePopup.style.top = (window.innerHeight / 2 - 150) + 'px';
  notePopup.style.left = (window.innerWidth / 2 - 150) + 'px';
  notePopup.style.width = '300px';
  notePopup.style.zIndex = '10001'; // Higher than other elements
  
  // Store the selected text and range
  notePopup.dataset.selectedText = selectedText;
  
  // Clear previous note content
  noteTextarea.value = '';
  
  // Show the popup
  notePopup.style.display = 'block';
  
  // Focus the textarea
  noteTextarea.focus();
  
  console.log('Note popup displayed');
}

// Function to create a visual note indicator
function createNoteIndicator(noteId, position) {
  const indicator = document.createElement('span');
  indicator.className = 'note-indicator';
  indicator.dataset.noteId = noteId;
  indicator.title = 'Click to view note';
  indicator.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"></path></svg>';
  
  // Set position if provided
  if (position) {
    indicator.style.top = (position.top + window.scrollY) + 'px';
    indicator.style.left = (position.left + window.scrollX) + 'px';
  }
  
  document.body.appendChild(indicator);
  return indicator;
}

// Function to show note content when indicator is clicked
function showNoteContent(noteId) {
  const note = notesCache[noteId];
  if (!note) return;
  
  // Create or get note content viewer
  let viewer = document.getElementById('note-viewer');
  if (!viewer) {
    viewer = document.createElement('div');
    viewer.id = 'note-viewer';
    viewer.className = 'note-viewer';
    
    // Create content area
    const content = document.createElement('div');
    content.className = 'note-viewer-content';
    viewer.appendChild(content);
    
    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'note-viewer-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      viewer.style.display = 'none';
    });
    viewer.appendChild(closeBtn);
    
    // Create delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'note-viewer-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      const noteId = viewer.dataset.noteId;
      if (noteId) {
        // Remove the note
        if (removeNote(noteId)) {
          // Also remove the indicator
          const indicator = document.querySelector(`.note-indicator[data-note-id="${noteId}"]`);
          if (indicator) {
            indicator.remove();
          }
          viewer.style.display = 'none';
        }
      }
    });
    viewer.appendChild(deleteBtn);
    
    document.body.appendChild(viewer);
  }
  
  // Update content and position
  const content = viewer.querySelector('.note-viewer-content');
  
  // Show the selected text with the note
  content.innerHTML = `
    <div class="note-viewer-text">"${note.text}"</div>
    <div class="note-viewer-note">${note.content}</div>
  `;
  
  // Store the note ID for delete operations
  viewer.dataset.noteId = noteId;
  
  // Position near the indicator
  const indicator = document.querySelector(`.note-indicator[data-note-id="${noteId}"]`);
  if (indicator) {
    const rect = indicator.getBoundingClientRect();
    viewer.style.top = (rect.bottom + window.scrollY + 5) + 'px';
    viewer.style.left = (rect.left + window.scrollX - 150) + 'px'; // Center it
  }
  
  // Show the viewer
  viewer.style.display = 'block';
}

// Set up event listeners for note functionality
function setupNoteEventListeners() {
  // Prevent duplicate initialization of event listeners
  if (noteListenersInitialized) {
    console.log('Note event listeners already initialized, skipping');
    return;
  }
  
  // Set flag to prevent recursive calls
  noteListenersInitialized = true;
  // Direct event handlers for note elements
  
  // Handle note indicator clicks
  document.addEventListener('click', function(e) {
    // We already have a direct handler for the note-button, so we only need to handle indicators here
    if (e.target.closest('.note-indicator')) {
      const indicator = e.target.closest('.note-indicator');
      const noteId = indicator.dataset.noteId;
      if (noteId) {
        showNoteContent(noteId);
      }
    }
    
    // Handle click outside note popup to close it
    if (!e.target.closest('#note-popup') && !e.target.closest('#note-button')) {
      const notePopup = document.getElementById('note-popup');
      if (notePopup && notePopup.style.display === 'block') {
        // Don't close if clicking on a note indicator or viewer
        if (e.target.closest('.note-indicator') || e.target.closest('#note-viewer')) {
          return;
        }
        notePopup.style.display = 'none';
      }
    }
  });
  
  // Create save and cancel buttons for the popup
  const saveButton = document.getElementById('note-save');
  if (saveButton) {
    // Remove existing listener if present
    const newSaveButton = saveButton.cloneNode(true);
    saveButton.parentNode.replaceChild(newSaveButton, saveButton);
    
    // Add new listener
    newSaveButton.addEventListener('click', function() {
      console.log('Save button clicked');
      const notePopup = document.getElementById('note-popup');
      const selectedText = notePopup.dataset.selectedText;
      const noteContent = document.getElementById('note-content').value.trim();
      
      console.log('Saving note for text:', selectedText);
      console.log('Note content:', noteContent);
      
      if (selectedText && noteContent) {
        // Create a unique ID for the note
        const noteId = `note-${Date.now()}`;
        
        // Get the position for the note indicator
        const selection = window.getSelection();
        let position = null;
        
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          position = {
            left: rect.right,
            top: rect.top
          };
        }
      
      // Create the note object
      const note = {
        id: noteId,
        text: selectedText,
        content: noteContent,
        url: window.location.href,
        timestamp: Date.now()
      };
      
      // Save the note
      saveNote(note);
      
      // Create visual indicator
      if (position) {
        const indicator = createNoteIndicator(noteId, position);
      }
      
      // Hide the popup
      notePopup.style.display = 'none';
    }
  });
  
  // Cancel button for the popup
  const cancelButton = document.getElementById('note-cancel');
  if (cancelButton) {
    // Remove existing listener if present
    const newCancelButton = cancelButton.cloneNode(true);
    cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);
    
    // Add new listener
    newCancelButton.addEventListener('click', function() {
      console.log('Cancel button clicked');
      const notePopup = document.getElementById('note-popup');
      notePopup.style.display = 'none';
    });
  }
  
  // Handle text selection to show the note button
  document.addEventListener('mouseup', function(e) {
    console.log('Mouse up event triggered');
    
    // Skip if clicking within our UI elements
    if (e.target.closest('#note-popup') || e.target.closest('#note-button') || 
        e.target.closest('.note-indicator') || e.target.closest('#note-viewer') ||
        e.target.closest('.highlighter-color-palette')) {
      console.log('Clicked on UI element, ignoring');
      return;
    }

    // Wait briefly to ensure selection is complete
    setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      const noteButton = document.getElementById('note-button');
      
      if (!noteButton) {
        console.error('Note button not found, recreating UI');
        createNoteUI();
        // Don't call initializeNotes here to avoid recursion
        return;
      }
      
      if (selectedText) {
        console.log('Text selected:', selectedText);
        // Get the selection coordinates
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          // Make button bigger and more visible
          // Position button below the selection with fixed position
          noteButton.style.position = 'absolute';
          noteButton.style.top = (rect.bottom + window.scrollY + 10) + 'px';
          noteButton.style.left = (rect.left + window.scrollX) + 'px';
          noteButton.style.display = 'flex';
          noteButton.style.padding = '8px 16px';
          noteButton.style.fontSize = '16px';
          
          console.log('Note button displayed at position:', noteButton.style.top, noteButton.style.left);
        }
      } else {
        // Hide button when no text is selected
        noteButton.style.display = 'none';
      }
    }, 50);
  }, true);
  
  // Update note button when selection changes
  document.addEventListener('selectionchange', function() {
    // Only handle this if we're not in the middle of interaction with our UI
    if (document.activeElement && 
        (document.activeElement.id === 'note-content' || 
         document.activeElement.closest('#note-popup') ||
         document.activeElement.closest('#note-viewer'))) {
      return;
    }
    
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    const noteButton = document.getElementById('note-button');
    
    if (!selectedText && noteButton) {
      noteButton.style.display = 'none';
    }
  });
  
  // Listen for messages from background/popup
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === 'getNotes') {
      sendResponse({ notes: notesCache });
    }
  });
}

// Restore notes when page loads
function restoreNotes() {
  chrome.storage.local.get(['notes'], function(result) {
    if (result.notes) {
      const notes = result.notes;
      
      // Only process notes for current URL
      const currentUrl = window.location.href;
      
      Object.values(notes).forEach(note => {
        if (note.url === currentUrl) {
          // Find the text occurrence on the page
          const text = note.text;
          
          // For simplicity, just place the indicator at the first occurrence
          const occurrence = findTextInDocument(text, 1);
          if (occurrence) {
            createNoteIndicator(note.id, {
              left: occurrence.right,
              top: occurrence.top
            });
          }
        }
      });
    }
  });
}

// Helper function to find text on the page
function findTextInDocument(searchText, occurrenceIndex = 1) {
  if (!searchText) return null;
  
  // Create a text node walker to find all text nodes in the document
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let currentOccurrence = 0;
  let node;
  
  // Iterate through text nodes
  while (node = walker.nextNode()) {
    const nodeText = node.textContent;
    let pos = -1;
    
    // Find all occurrences in this text node
    while ((pos = nodeText.indexOf(searchText, pos + 1)) !== -1) {
      currentOccurrence++;
      
      // If this is the occurrence we're looking for
      if (currentOccurrence === occurrenceIndex) {
        // Get the range for this text
        const range = document.createRange();
        range.setStart(node, pos);
        range.setEnd(node, pos + searchText.length);
        
        // Return the position
        return range.getBoundingClientRect();
      }
    }
  }
  
  return null;
}

// Initialize when the page is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    initializeNotes();
    // Wait a bit for page to render and other scripts to run
    setTimeout(restoreNotes, 1000);
  });
} else {
  initializeNotes();
  // Wait a bit for page to render and other scripts to run
  setTimeout(restoreNotes, 1000);
}

// Also try when page is fully loaded with all resources
window.addEventListener('load', function() {
  initializeNotes();
  setTimeout(restoreNotes, 1000);
})};
