// Notes functionality for the popup
document.addEventListener('DOMContentLoaded', function() {
  // Get UI elements
  const notesTab = document.querySelector('.tab[data-tab="notes"]');
  const highlightsTab = document.querySelector('.tab[data-tab="highlights"]');
  const notesTabContent = document.getElementById('notesTab');
  const highlightsTabContent = document.getElementById('highlightsTab');
  const notesList = document.getElementById('notesList');
  const clearNotesButton = document.getElementById('clearNotes');
  const exportNotesButton = document.getElementById('exportNotes');
  const importNotesButton = document.getElementById('importNotes');
  const importNotesInput = document.getElementById('importNotesInput');
  
  // Setup tab switching functionality
  notesTab.addEventListener('click', function() {
    // Hide highlights tab content
    highlightsTab.classList.remove('active');
    highlightsTabContent.classList.remove('active');
    
    // Show notes tab content
    notesTab.classList.add('active');
    notesTabContent.classList.add('active');
    
    // Load notes when switching to the tab
    loadNotes();
  });
  
  highlightsTab.addEventListener('click', function() {
    // Hide notes tab content
    notesTab.classList.remove('active');
    notesTabContent.classList.remove('active');
    
    // Show highlights tab content
    highlightsTab.classList.add('active');
    highlightsTabContent.classList.add('active');
  });
  
  // Load and display notes
  function loadNotes() {
    chrome.storage.local.get(['notes'], function(result) {
      notesList.innerHTML = '';
      const notes = result.notes || {};
      let hasNotes = false;
      
      // Group notes by URL
      const notesByUrl = {};
      for (const noteId in notes) {
        const note = notes[noteId];
        if (!notesByUrl[note.url]) {
          notesByUrl[note.url] = [];
        }
        notesByUrl[note.url].push(note);
      }
      
      // Display notes grouped by URL
      for (const url in notesByUrl) {
        const urlNotes = notesByUrl[url];
        if (urlNotes.length > 0) {
          hasNotes = true;
          
          // Create URL header
          const urlHeader = document.createElement('div');
          urlHeader.textContent = new URL(url).hostname;
          urlHeader.style.fontWeight = 'bold';
          urlHeader.style.marginTop = '10px';
          notesList.appendChild(urlHeader);
          
          // Sort notes by timestamp (newest first)
          urlNotes.sort((a, b) => b.timestamp - a.timestamp);
          
          // Add notes for this URL
          urlNotes.forEach(note => {
            const div = document.createElement('div');
            div.className = 'note-item';
            
            // Truncate text if it's too long
            const maxLength = 80;
            let displayText = note.text || '';
            if (displayText.length > maxLength) {
              displayText = displayText.substring(0, maxLength) + '...';
            }
            
            // Add the text and a preview of the note content
            div.innerHTML = `
              <div>${displayText}</div>
              <div class="note-content">${note.content}</div>
            `;
            
            // Show creation date in the tooltip
            div.title = `Created: ${new Date(note.timestamp).toLocaleString()}`;
            
            // Make the note clickable
            div.dataset.url = url;
            div.dataset.id = note.id;
            div.dataset.text = note.text;
            
            // Add click handler to navigate to the note
            div.addEventListener('click', function() {
              navigateToNote(this.dataset.url, {
                id: this.dataset.id,
                text: this.dataset.text
              });
            });
            
            notesList.appendChild(div);
          });
        }
      }
      
      // Show message if no notes exist
      if (!hasNotes) {
        const emptyMessage = document.createElement('div');
        emptyMessage.textContent = 'No notes yet. Select text on webpages and click the note button to add notes.';
        emptyMessage.style.fontStyle = 'italic';
        emptyMessage.style.color = '#888';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.margin = '20px 0';
        notesList.appendChild(emptyMessage);
      }
    });
  }
  
  // Function to navigate to a specific note
  function navigateToNote(url, note) {
    // Open a new tab with the target URL
    chrome.tabs.create({ url: url }, function(tab) {
      // Add a listener that will send a message to the content script when the page is loaded
      function checkAndShowNote() {
        chrome.tabs.sendMessage(tab.id, {
          action: 'showNote',
          noteId: note.id,
          noteText: note.text
        });
      }
      
      // We need to wait until the page is fully loaded and our content script has initialized
      chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          // Wait a bit more to ensure our content script has initialized
          setTimeout(checkAndShowNote, 1000);
          chrome.tabs.onUpdated.removeListener(listener);
        }
      });
    });
  }
  
  // Clear all notes
  clearNotesButton.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all notes?')) {
      chrome.storage.local.set({ 'notes': {} }, function() {
        loadNotes();
      });
    }
  });
  
  // Export notes
  exportNotesButton.addEventListener('click', function() {
    chrome.storage.local.get(['notes'], function(result) {
      const notes = result.notes || {};
      
      // Create a data object with timestamp and version info
      const exportData = {
        version: '1.0',
        timestamp: Date.now(),
        notes: notes
      };
      
      // Convert to JSON string
      const jsonData = JSON.stringify(exportData, null, 2);
      
      // Create a Blob with the JSON data
      const blob = new Blob([jsonData], { type: 'application/json' });
      
      // Create a URL for the Blob
      const url = URL.createObjectURL(blob);
      
      // Create a temporary anchor element to trigger the download
      const a = document.createElement('a');
      a.href = url;
      a.download = `notes-export-${new Date().toISOString().slice(0, 10)}.json`;
      
      // Append to document (required for Firefox)
      document.body.appendChild(a);
      
      // Trigger the download
      a.click();
      
      // Clean up
      setTimeout(function() {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    });
  });
  
  // Import notes button click - trigger file input
  importNotesButton.addEventListener('click', function() {
    importNotesInput.click();
  });
  
  // Import notes file selected
  importNotesInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importedData = JSON.parse(e.target.result);
        
        // Validate import data structure
        if (!importedData.notes) {
          throw new Error('Invalid import file format');
        }
        
        // Merge with existing notes
        chrome.storage.local.get(['notes'], function(result) {
          let existingNotes = result.notes || {};
          const importedNotes = importedData.notes;
          
          // Ask user if they want to merge or replace
          const hasExisting = Object.keys(existingNotes).length > 0;
          let mergeOption = 'merge';
          
          if (hasExisting) {
            const userOption = confirm(
              'Would you like to merge with your existing notes? ' +
              'Click OK to merge, or Cancel to replace all existing notes.'
            );
            mergeOption = userOption ? 'merge' : 'replace';
          }
          
          // Update storage based on user's choice
          if (mergeOption === 'replace') {
            chrome.storage.local.set({ 'notes': importedNotes }, function() {
              loadNotes();
              alert('Notes imported successfully (replaced existing notes)');
            });
          } else {
            // Merge notes
            const mergedNotes = { ...existingNotes, ...importedNotes };
            chrome.storage.local.set({ 'notes': mergedNotes }, function() {
              loadNotes();
              alert('Notes imported successfully (merged with existing notes)');
            });
          }
        });
      } catch (error) {
        alert('Error importing notes: ' + error.message);
        console.error('Import error:', error);
      }
    };
    
    reader.onerror = function() {
      alert('Error reading file');
    };
    
    // Read the file as text
    reader.readAsText(file);
    
    // Reset the file input so the same file can be selected again
    event.target.value = '';
  });

  // Load notes when popup initially opens
  loadNotes();
});
