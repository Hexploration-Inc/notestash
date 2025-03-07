// Notes functionality for the highlighter extension
// This code is kept separate from the highlighter functionality

// Store for notes
let notesCache = {};

// Flag to track if storage is initialized
let storageInitialized = false;

// Force direct writing to storage for debugging
function forceStorageSave() {
  console.log('Force saving notes to storage');
  const testNote = {
    id: 'test-' + Date.now(),
    text: 'Test note',
    content: 'This is a test note to verify storage is working',
    url: window.location.href,
    timestamp: Date.now()
  };
  
  // Try direct storage API call
  chrome.storage.local.set({ 'test_note': testNote }, function() {
    if (chrome.runtime.lastError) {
      console.error('Storage API test failed:', chrome.runtime.lastError);
    } else {
      console.log('Storage API test passed');
      // Now read it back
      chrome.storage.local.get(['test_note'], function(result) {
        if (result.test_note) {
          console.log('Successfully read back test note:', result.test_note);
        } else {
          console.error('Failed to read back test note');
        }
      });
    }
  });
}

// Initialize note system
function initializeNotes() {
  console.log('Initializing notes system at:', new Date().toISOString());
  // If already initialized, don't do it again
  if (storageInitialized) {
    console.log('Notes system already initialized, skipping initialization');
    return;
  }
  
  // Ensure we have storage permissions
  chrome.storage.local.get(null, function() {
    if (chrome.runtime.lastError) {
      console.error('Storage permission error:', chrome.runtime.lastError);
    } else {
      storageInitialized = true;
      console.log('Storage access confirmed');
      
      // Test storage explicitly
      forceStorageSave();
    }
    
    // Set up the notes system in the correct order
    loadNotesFromStorage();
    createNoteUI();
    setupNoteEventListeners();
    
    // Log that initialization is complete
    console.log('Notes system initialization complete');
  });
}

// Flag to track if note listeners are already set up
let noteListenersInitialized = false;

// Load all saved notes
function loadNotesFromStorage() {
  console.log('Loading notes from storage...');
  chrome.storage.local.get(['notes'], function(result) {
    if (chrome.runtime.lastError) {
      console.error('Error loading notes:', chrome.runtime.lastError);
      return;
    }
    
    if (result.notes && Object.keys(result.notes).length > 0) {
      notesCache = result.notes;
      console.log('Notes loaded from storage:', Object.keys(notesCache).length);
      console.log('Sample note IDs:', Object.keys(notesCache).slice(0, 3));
      
      // Verify notes structure
      let validNotes = 0;
      for (const [id, note] of Object.entries(notesCache)) {
        if (note && note.id && note.text && note.content) {
          validNotes++;
        }
      }
      console.log('Valid notes structure count:', validNotes);
    } else {
      // Initialize empty notes object if none exists
      notesCache = {};
      console.log('No notes found in storage, initialized empty cache');
    }
  });
}

// Save note to storage
function saveNote(note) {
  if (!note || !note.id) {
    console.error('Invalid note object:', note);
    return;
  }

  // Add to local cache
  notesCache[note.id] = note;
  
  // More detailed debugging
  console.log('Attempting to save note:', JSON.stringify(note));
  console.log('Current cache state before save:', Object.keys(notesCache).length, 'notes');
  
  // Get existing notes to ensure we're not overwriting anything
  chrome.storage.local.get(['notes'], function(result) {
    let existingNotes = result.notes || {};
    console.log('Retrieved from storage:', Object.keys(existingNotes).length, 'existing notes');
    
    // Add our new note
    existingNotes[note.id] = note;
    
    // Update our cache with any other notes we might not have had
    notesCache = existingNotes;
    
    // DEBUG: Verify what's about to be saved
    console.log('About to save notes object with', Object.keys(existingNotes).length, 'notes');
    console.log('Sample note IDs:', Object.keys(existingNotes).slice(0, 3));
    
    // Save back to storage with explicit error handling
    chrome.storage.local.set({ 'notes': existingNotes }, function() {
      // Check if there was an error
      if (chrome.runtime.lastError) {
        console.error('Error saving note:', chrome.runtime.lastError);
      } else {
        console.log('Note saved successfully:', note.id);
        console.log('Total notes in storage:', Object.keys(existingNotes).length);
        
        // Verify storage was updated by reading it back
        chrome.storage.local.get(['notes'], function(verifyResult) {
          if (verifyResult.notes && verifyResult.notes[note.id]) {
            console.log('Storage verification: Note found in storage ✓');
          } else {
            console.error('Storage verification FAILED: Note not found in storage after save!');
          }
        });
      }
    });
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
  noteTextarea.style.width = '100%';
  noteTextarea.style.height = '100px';
  noteTextarea.style.padding = '8px';
  noteTextarea.style.border = '1px solid #ddd';
  noteTextarea.style.borderRadius = '4px';
  noteTextarea.style.margin = '8px 0 16px 0';
  noteTextarea.style.resize = 'vertical';
  
  // Create buttons for the popup
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'note-buttons';
  
  const saveButton = document.createElement('button');
  saveButton.id = 'note-save';
  saveButton.className = 'note-save-button';
  saveButton.textContent = 'Save';
  saveButton.style.cursor = 'pointer';
  saveButton.style.padding = '8px 16px';
  saveButton.style.margin = '0 5px';
  saveButton.style.backgroundColor = '#4CAF50';
  saveButton.style.color = 'white';
  saveButton.style.border = 'none';
  saveButton.style.borderRadius = '4px';
  
  const cancelButton = document.createElement('button');
  cancelButton.id = 'note-cancel';
  cancelButton.className = 'note-cancel-button';
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cursor = 'pointer';
  cancelButton.style.padding = '8px 16px';
  cancelButton.style.margin = '0 5px';
  cancelButton.style.backgroundColor = '#f44336';
  cancelButton.style.color = 'white';
  cancelButton.style.border = 'none';
  cancelButton.style.borderRadius = '4px';
  
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
  
  // Store the selection coordinates for later use when creating the note indicator
  notePopup.dataset.selectionLeft = (rect.right + window.scrollX);
  notePopup.dataset.selectionTop = (rect.top + window.scrollY);
  
  // Position centered note popup with fixed dimensions
  notePopup.style.position = 'fixed';
  notePopup.style.top = (window.innerHeight / 2 - 150) + 'px';
  notePopup.style.left = (window.innerWidth / 2 - 150) + 'px';
  notePopup.style.width = '300px';
  notePopup.style.backgroundColor = '#f9f9f9';
  notePopup.style.border = '1px solid #ccc';
  notePopup.style.borderRadius = '8px';
  notePopup.style.padding = '16px';
  notePopup.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
  notePopup.style.zIndex = '10001'; // Higher than other elementsborder = '1px solid #ccc';
  notePopup.style.borderRadius = '8px';
  notePopup.style.padding = '16px';
  notePopup.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
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
  
  // Always set position to absolute for proper positioning
  indicator.style.position = 'absolute';
  
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
    console.log('Found save button, attaching event listener');
    
    // Clear existing event listeners by cloning
    const newSaveButton = saveButton.cloneNode(true);
    saveButton.parentNode.replaceChild(newSaveButton, saveButton);
    
    // Add a more reliable direct click handler
    newSaveButton.onclick = function(event) {
      console.log('Save button clicked via onclick property');
      event.preventDefault();
      event.stopPropagation();

      console.log('Save button clicked at:', new Date().toISOString());
      const notePopup = document.getElementById('note-popup');
      const selectedText = notePopup.dataset.selectedText;
      const noteContent = document.getElementById('note-content').value.trim();
      
      // Validate inputs
      if (!selectedText) {
        console.error('No selected text found in dataset');
        return;
      }
      
      if (!noteContent) {
        console.warn('Note content is empty, not saving empty note');
        return;
      }
      
      console.log('Saving note for text:', selectedText);
      console.log('Note content:', noteContent);
      
      // Create a unique ID for the note with timestamp and random component to ensure uniqueness
      const noteId = `note-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      
      // Store the position information from the original text selection
      // This ensures we have the correct position even if selection changes
      // notePopup = document.getElementById('note-popup');
      let position = null;
      
      // Get position from stored data (if available)
      if (notePopup.dataset.selectionLeft && notePopup.dataset.selectionTop) {
        position = {
          left: parseInt(notePopup.dataset.selectionLeft),
          top: parseInt(notePopup.dataset.selectionTop)
        };
        console.log('Using stored note indicator position:', position);
      } else {
        // Fallback to current selection if data isn't available
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          position = {
            left: rect.right,
            top: rect.top
          };
          console.log('Note indicator position from current selection:', position);
        } else {
          console.warn('No position information available for note indicator');
        }
      }
    
      // Create the note object
      const note = {
        id: noteId,
        text: selectedText,
        content: noteContent,
        url: window.location.href,
        timestamp: Date.now()
      };
      
      // Ensure storage is initialized before saving
      if (!storageInitialized) {
        console.warn('Storage not initialized yet, initializing now...');
        chrome.storage.local.get(null, function() {
          if (chrome.runtime.lastError) {
            console.error('Failed to initialize storage:', chrome.runtime.lastError);
            return;
          }
          
          storageInitialized = true;
          console.log('Storage initialized before save');
          
          // Now save the note
          saveNote(note);
          
          // Create visual indicator
          if (position) {
            const indicator = createNoteIndicator(noteId, position);
            console.log('Note indicator created:', indicator ? 'success' : 'failed');
          }
          
          // Hide both the popup and the note button
          notePopup.style.display = 'none';
          const noteButton = document.getElementById('note-button');
          if (noteButton) {
            noteButton.style.display = 'none';
          }
        });
      } else {
        // Storage is already initialized, proceed with save
        console.log('Storage already initialized, saving note directly');
        saveNote(note);
        
        // Create visual indicator
        if (position) {
          const indicator = createNoteIndicator(noteId, position);
          console.log('Note indicator created:', indicator ? 'success' : 'failed');
        } else {
          console.warn('No position for indicator, skipping visual indicator');
        }
        
        // Hide both the popup and the note button
        notePopup.style.display = 'none';
        const noteButton = document.getElementById('note-button');
        if (noteButton) {
          noteButton.style.display = 'none';
        }
      }
    };
  }
  
  // Cancel button for the popup
  const cancelButton = document.getElementById('note-cancel');
  if (cancelButton) {
    console.log('Found cancel button, attaching event listener');
    
    // Remove existing listener if present
    const newCancelButton = cancelButton.cloneNode(true);
    cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);
    
    // Add direct click handler with debug
    newCancelButton.onclick = function(event) {
      console.log('Cancel button clicked via onclick property');
      event.preventDefault();
      event.stopPropagation();
      
      console.log('Cancel button clicked');
      const notePopup = document.getElementById('note-popup');
      notePopup.style.display = 'none';
    };
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
});
