// Define highlight colors (keep in sync with background.js)
const highlightColors = {
  yellow: { color: '#ffff00', name: 'Yellow' },
  green: { color: '#c2f0c2', name: 'Light Green' },
  blue: { color: '#cce5ff', name: 'Light Blue' },
  pink: { color: '#ffcccc', name: 'Light Pink' },
  purple: { color: '#e6ccff', name: 'Light Purple' }
};

// Create and manage color palette for text selection
function createColorPalette() {
  // Check if palette already exists
  let palette = document.getElementById('highlighter-color-palette');
  if (palette) return palette;
  
  // Create palette element
  palette = document.createElement('div');
  palette.id = 'highlighter-color-palette';
  palette.className = 'highlighter-color-palette';
  
  // Add color circles
  Object.entries(highlightColors).forEach(([colorKey, details]) => {
    const colorCircle = document.createElement('div');
    colorCircle.className = 'highlighter-color-circle';
    colorCircle.style.backgroundColor = details.color;
    colorCircle.dataset.colorKey = colorKey;
    colorCircle.title = details.name;
    
    // Add click handler
    colorCircle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Apply highlight with selected color
      // Use a slight delay to ensure the selection is preserved when clicking
      setTimeout(() => {
        applyHighlight(colorKey, details.color);
        
        // Hide palette after selection
        hideColorPalette();
      }, 10);
    });
    
    palette.appendChild(colorCircle);
  });
  
  // Add palette to document
  document.body.appendChild(palette);
  return palette;
}

// Function to apply highlight using the selected color
function applyHighlight(colorKey, colorValue) {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText) {
    try {
      // Clone the range to avoid issues with selection changes
      const range = selection.getRangeAt(0).cloneRange();
      const span = document.createElement('span');
      span.className = 'highlighter-mark';
      span.style.backgroundColor = colorValue;
      span.dataset.color = colorKey;
      
      const highlightId = `highlight-${Date.now()}`;
      span.dataset.highlightId = highlightId;
      
      // Get the ancestor node that contains the selection
      let container = range.commonAncestorContainer;
      if (container.nodeType !== Node.ELEMENT_NODE) {
        container = container.parentNode;
      }
      
      // Find the index of this occurrence
      let occurrenceIndex = 0;
      let currentNode = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      // Get the path to the node
      const getNodePath = function(node) {
        const path = [];
        while (node !== document.body && node.parentNode) {
          let index = 0;
          let sibling = node;
          while (sibling) {
            sibling = sibling.previousSibling;
            if (sibling) index++;
          }
          path.unshift(index);
          node = node.parentNode;
        }
        return path;
      };
      
      // Get the exact path to the node containing the highlight
      const nodePath = getNodePath(range.startContainer);
      
      // Count occurrences of this text up to this point
      let textNode;
      let currentOccurrence = 0;
      while (textNode = currentNode.nextNode()) {
        const textContent = textNode.textContent;
        let pos = -1;
        while ((pos = textContent.indexOf(selectedText, pos + 1)) !== -1) {
          currentOccurrence++;
          // If this is our selection, save the occurrence index
          if (textNode === range.startContainer && pos === range.startOffset) {
            occurrenceIndex = currentOccurrence;
            break;
          }
        }
        if (occurrenceIndex > 0) break;
      }
      
      // Apply the highlight
      range.surroundContents(span);
      
      // Save the highlight to storage
      const highlight = {
        id: highlightId,
        text: selectedText,
        url: window.location.href,
        timestamp: Date.now(),
        occurrenceIndex: occurrenceIndex,
        nodePath: nodePath,
        colorKey: colorKey,
        colorValue: colorValue
      };
      
      saveHighlight(highlight);
      console.log('Successfully applied highlight:', highlight);
      
    } catch (e) {
      console.error('Failed to highlight text:', e);
      // Try again with a simpler approach if the complex one fails
      try {
        const range = selection.getRangeAt(0).cloneRange();
        const span = document.createElement('span');
        span.className = 'highlighter-mark';
        span.style.backgroundColor = colorValue;
        span.dataset.color = colorKey;
        
        const highlightId = `highlight-${Date.now()}`;
        span.dataset.highlightId = highlightId;
        
        range.surroundContents(span);
        
        // Save a simpler highlight version
        saveHighlight({
          id: highlightId,
          text: selectedText,
          url: window.location.href,
          timestamp: Date.now(),
          colorKey: colorKey,
          colorValue: colorValue
        });
        
        console.log('Applied simplified highlight as fallback');
      } catch (e2) {
        console.error('Both highlight methods failed:', e2);
      }
    }
  } else {
    console.warn('No text selected for highlighting');
  }
}

// Position the color palette above or below selected text
function positionColorPalette() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return false;
  
  const range = selection.getRangeAt(0);
  if (range.collapsed) return false;
  
  // Get selection coordinates and dimensions
  const rect = range.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  
  // Get or create palette
  const palette = createColorPalette();
  
  // Position palette above or below text based on available space
  const paletteHeight = 40; // Approximate height of palette
  
  const spaceAbove = rect.top;
  const spaceBelow = window.innerHeight - rect.bottom;
  
  // Default position (above text)
  let top, left;
  
  if (spaceAbove > paletteHeight || spaceAbove > spaceBelow) {
    // Position above text
    top = rect.top + window.scrollY - paletteHeight - 5;
  } else {
    // Position below text
    top = rect.bottom + window.scrollY + 5;
  }
  
  // Center horizontally over the selection
  left = rect.left + window.scrollX + (rect.width / 2) - (palette.offsetWidth / 2 || 100); // Default width estimate if not yet rendered
  
  // Ensure palette stays within viewport horizontally
  if (left < 5) left = 5;
  if (left + (palette.offsetWidth || 200) > window.innerWidth - 5) {
    left = window.innerWidth - (palette.offsetWidth || 200) - 5;
  }
  
  // Apply position
  palette.style.top = `${top}px`;
  palette.style.left = `${left}px`;
  palette.style.display = 'flex';
  palette.style.opacity = '1';
  
  // Store the current selection text to check if it changes
  palette.dataset.selectionText = selection.toString().trim();
  
  return true;
}

// Hide color palette
function hideColorPalette() {
  const palette = document.getElementById('highlighter-color-palette');
  if (palette) {
    palette.style.display = 'none';
  }
}

// Original restore highlights function that will be wrapped
function _originalRestoreHighlights() {
    chrome.storage.local.get(['highlights'], function(result) {
        const urlHighlights = result.highlights?.[window.location.href] || [];
        if (urlHighlights.length === 0) return;

        // First, remove existing highlights to avoid duplicates
        document.querySelectorAll('.highlighter-mark').forEach(el => {
            const parent = el.parentNode;
            const text = el.textContent;
            const textNode = document.createTextNode(text);
            parent.replaceChild(textNode, el);
        });

        // Sort highlights to process them in a consistent order
        const sortedHighlights = [...urlHighlights].sort((a, b) => a.timestamp - b.timestamp);

        // Now add highlights
        sortedHighlights.forEach(highlight => {
            // Try to find the exact occurrence based on the saved index
            const targetOccurrenceIndex = highlight.occurrenceIndex || 1;
            
            // Find all text nodes in the document
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: function(node) {
                        // Skip nodes that are already inside highlight spans
                        if (node.parentNode.classList && node.parentNode.classList.contains('highlighter-mark')) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        // Skip empty text nodes
                        if (node.textContent.trim().length === 0) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        return NodeFilter.FILTER_ACCEPT;
                    }
                },
                false
            );

            // Try to locate the correct occurrence
            let node;
            let currentOccurrence = 0;
            let found = false;
            
            // Function to locate a node by path (if available)
            const getNodeByPath = function(path) {
                if (!path || !Array.isArray(path) || path.length === 0) return null;
                
                let currentNode = document.body;
                for (let i = 0; i < path.length; i++) {
                    const childIndex = path[i];
                    if (currentNode.childNodes.length <= childIndex) return null;
                    currentNode = currentNode.childNodes[childIndex];
                }
                return currentNode;
            };
            
            // Try to find by node path first if available
            if (highlight.nodePath) {
                const targetNode = getNodeByPath(highlight.nodePath);
                if (targetNode && targetNode.nodeType === Node.TEXT_NODE && targetNode.textContent.includes(highlight.text)) {
                    node = targetNode;
                    currentOccurrence = 1; // We found the exact node
                    found = true;
                }
            }
            
            // If we couldn't find by path, search by occurrence index
            if (!found) {
                while (!found && (node = walker.nextNode())) {
                    const text = node.textContent;
                    let startPos = 0;
                    let pos;
                    
                    while ((pos = text.indexOf(highlight.text, startPos)) !== -1) {
                        currentOccurrence++;
                        
                        if (currentOccurrence === targetOccurrenceIndex) {
                            try {
                                const range = document.createRange();
                                range.setStart(node, pos);
                                range.setEnd(node, pos + highlight.text.length);
                                
                                const span = document.createElement('span');
                                span.className = 'highlighter-mark';
                                span.dataset.highlightId = highlight.id;
                                // Apply color from saved highlight or default to yellow
                                if (highlight.colorKey) {
                                    span.dataset.color = highlight.colorKey;
                                }
                                span.style.backgroundColor = highlight.colorValue || '#ffff00';
                                
                                range.surroundContents(span);
                                found = true;
                                console.log(`Restored highlight at occurrence ${currentOccurrence}:`, highlight.text);
                                break;
                            } catch (e) {
                                console.error('Error highlighting text:', e, highlight.text);
                                // Try next occurrence
                            }
                        }
                        startPos = pos + 1; // Move past current match
                    }
                    
                    if (found) break;
                }
            } else {
                // Use the node we found by path
                try {
                    const pos = node.textContent.indexOf(highlight.text);
                    const range = document.createRange();
                    range.setStart(node, pos);
                    range.setEnd(node, pos + highlight.text.length);
                    
                    const span = document.createElement('span');
                    span.className = 'highlighter-mark';
                    span.dataset.highlightId = highlight.id;
                    // Apply color from saved highlight or default to yellow
                    if (highlight.colorKey) {
                        span.dataset.color = highlight.colorKey;
                    }
                    span.style.backgroundColor = highlight.colorValue || '#ffff00';
                    
                    range.surroundContents(span);
                    console.log(`Restored highlight using exact node path:`, highlight.text);
                } catch (e) {
                    console.error('Error highlighting text with exact path:', e, highlight.text);
                }
            }
            
            // Fallback for older highlights or if occurrence-based restoration failed
            if (!found && !highlight.occurrenceIndex) {
                console.log('Using fallback method for highlight:', highlight.text);
                attemptFallbackHighlight(highlight);
            }
        });
    });
}

// Function to restore highlights (will be wrapped by setupHighlightInteractions)
let restoreHighlights = _originalRestoreHighlights;

// Fallback function for older highlights without position data
function attemptFallbackHighlight(highlight) {
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                if (node.parentNode.classList && node.parentNode.classList.contains('highlighter-mark')) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (node.textContent.trim().length === 0) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        },
        false
    );
    
    let node;
    while (node = walker.nextNode()) {
        if (node.textContent.includes(highlight.text)) {
            try {
                const range = document.createRange();
                range.setStart(node, node.textContent.indexOf(highlight.text));
                range.setEnd(node, node.textContent.indexOf(highlight.text) + highlight.text.length);
                
                const span = document.createElement('span');
                span.className = 'highlighter-mark';
                span.dataset.highlightId = highlight.id;
                // Apply color from saved highlight or default to yellow
                if (highlight.colorKey) {
                    span.dataset.color = highlight.colorKey;
                }
                span.style.backgroundColor = highlight.colorValue || '#ffff00';
                
                range.surroundContents(span);
                console.log('Fallback highlight applied:', highlight.text);
                return true;
            } catch (e) {
                console.error('Fallback highlighting error:', e, highlight.text);
            }
        }
    }
    return false;
}

// Function to save highlight to storage
function saveHighlight(highlight) {
    chrome.storage.local.get(['highlights'], function(result) {
        const highlights = result.highlights || {};
        if (!highlights[window.location.href]) {
            highlights[window.location.href] = [];
        }
        highlights[window.location.href].push(highlight);
        chrome.storage.local.set({ highlights });
    });
}

// Function to remove highlight from storage
function removeHighlight(highlightId) {
    chrome.storage.local.get(['highlights'], function(result) {
        const highlights = result.highlights || {};
        const urlHighlights = highlights[window.location.href] || [];
        
        // Find and remove the highlight with matching ID
        const updatedHighlights = urlHighlights.filter(h => h.id !== highlightId);
        
        // Update storage
        if (updatedHighlights.length !== urlHighlights.length) {
            highlights[window.location.href] = updatedHighlights;
            chrome.storage.local.set({ highlights }, function() {
                console.log('Highlight removed:', highlightId);
            });
        }
    });
}

// Function to unhighlight a specific element
function unhighlightElement(element) {
    // Get the highlight ID for storage removal
    const highlightId = element.dataset.highlightId;
    
    // Remove the span but keep the text
    const parent = element.parentNode;
    const text = element.textContent;
    const textNode = document.createTextNode(text);
    parent.replaceChild(textNode, element);
    
    // Remove from storage
    if (highlightId) {
        removeHighlight(highlightId);
    }
    
    return true;
}

// Function to attempt highlight restoration
function attemptRestore() {
    if (document.body) {
        console.log('Attempting to restore highlights...');
        restoreHighlights();
    }
}

// Try multiple times to restore highlights using a more robust approach
function ensureHighlightsRestored() {
    // Immediate attempt
    attemptRestore();

    // Use a series of delayed attempts with increasing intervals
    const delays = [100, 500, 1000, 2000, 3000];
    delays.forEach(delay => {
        setTimeout(attemptRestore, delay);
    });
}

// Set up event listeners for initial page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        ensureHighlightsRestored();
        setupHighlightInteractions();
    });
} else {
    ensureHighlightsRestored();
    setupHighlightInteractions();
}

// Setup click handlers for highlight interactions
function setupHighlightInteractions() {
    // Clean up any existing event handlers to prevent duplicates
    const existingHandler = document.getElementById('highlighter-event-handler');
    if (existingHandler) {
        existingHandler.remove();
    }
    
    // Create an invisible element to store our initialized state
    const handlerMarker = document.createElement('div');
    handlerMarker.id = 'highlighter-event-handler';
    handlerMarker.style.display = 'none';
    document.body.appendChild(handlerMarker);
    
    // Use direct event handling for all highlights
    // This ensures we bind directly to the elements
    function addClickHandlersToHighlights() {
        document.querySelectorAll('.highlighter-mark').forEach(highlight => {
            // Remove any existing click listeners first
            highlight.removeEventListener('click', handleHighlightClick);
            // Add the click listener
            highlight.addEventListener('click', handleHighlightClick);
            // Add visual feedback
            highlight.title = 'Click to remove highlight';
        });
    }
    
    // Handle highlight click event
    function handleHighlightClick(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Highlight clicked, removing...', this);
        unhighlightElement(this);
        return false;
    }
    
    // Add hover effect using event delegation
    document.body.addEventListener('mouseover', function(e) {
        if (e.target.classList.contains('highlighter-mark')) {
            e.target.title = 'Click to remove highlight';
            e.target.classList.add('highlighter-mark-hover');
        }
    });
    
    document.body.addEventListener('mouseout', function(e) {
        if (e.target.classList.contains('highlighter-mark')) {
            e.target.classList.remove('highlighter-mark-hover');
        }
    });
    
    // Add click handlers to existing highlights
    addClickHandlersToHighlights();
    
    // Also add handlers to new highlights after restoration
    const originalRestoreHighlights = restoreHighlights;
    restoreHighlights = function() {
        originalRestoreHighlights.apply(this, arguments);
        // Wait a brief moment for DOM to update
        setTimeout(addClickHandlersToHighlights, 100);
    };
}

// Also try when page is fully loaded with all resources
window.addEventListener('load', ensureHighlightsRestored);

// Add a listener for after images and other resources finish loading
window.addEventListener('DOMContentLoaded', function() {
    // Set up a check after all images and iframes have loaded
    window.addEventListener('load', function() {
        setTimeout(attemptRestore, 500);
    });
});

// Handle dynamic content
const observer = new MutationObserver(function(mutations) {
    const hasNewContent = mutations.some(mutation => {
        return Array.from(mutation.addedNodes).some(node => {
            return node.nodeType === Node.TEXT_NODE || 
                   (node.nodeType === Node.ELEMENT_NODE && node.textContent.trim().length > 0);
        });
    });
    
    if (hasNewContent) {
        attemptRestore();
    }
});

// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Function to find and scroll to a specific highlight
function scrollToHighlight(highlightId, highlightText, occurrenceIndex) {
    console.log(`Attempting to scroll to highlight: ${highlightId}, text: ${highlightText}, occurrence: ${occurrenceIndex}`);
    
    // First check if the highlight element already exists
    const existingHighlight = document.querySelector(`.highlighter-mark[data-highlight-id="${highlightId}"]`);
    if (existingHighlight) {
        console.log('Found existing highlight element, scrolling to it');
        existingHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        highlightElement(existingHighlight);
        return true;
    }
    
    // If the highlight doesn't exist yet, we need to restore highlights first
    console.log('Highlight not found in DOM, attempting to restore it');
    restoreHighlights();
    
    // After restoring, try to find the highlight again
    setTimeout(() => {
        const highlight = document.querySelector(`.highlighter-mark[data-highlight-id="${highlightId}"]`);
        if (highlight) {
            console.log('Found highlight after restoration, scrolling to it');
            highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
            highlightElement(highlight);
        } else {
            console.log('Highlight still not found, attempting to locate by text and occurrence');
            scrollToTextOccurrence(highlightText, occurrenceIndex);
        }
    }, 500);
}

// Function to find and scroll to a specific occurrence of text
function scrollToTextOccurrence(text, occurrenceIndex) {
    // Find all text nodes in the document
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                if (node.parentNode.classList && node.parentNode.classList.contains('highlighter-mark')) {
                    return NodeFilter.FILTER_ACCEPT; // Accept already highlighted nodes too
                }
                if (node.textContent.trim().length === 0) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        },
        false
    );
    
    let currentOccurrence = 0;
    let node;
    let foundElement = null;
    
    // First check already highlighted elements
    const highlightElements = document.querySelectorAll('.highlighter-mark');
    for (const el of highlightElements) {
        if (el.textContent === text) {
            currentOccurrence++;
            if (currentOccurrence === occurrenceIndex) {
                foundElement = el;
                break;
            }
        }
    }
    
    // If found among existing highlights
    if (foundElement) {
        foundElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        highlightElement(foundElement);
        return true;
    }
    
    // Reset counter and check all text nodes
    currentOccurrence = 0;
    while (node = walker.nextNode()) {
        const textContent = node.textContent;
        let pos = -1;
        
        while ((pos = textContent.indexOf(text, pos + 1)) !== -1) {
            currentOccurrence++;
            
            if (currentOccurrence === occurrenceIndex) {
                // We found the correct occurrence
                if (node.parentNode.classList && node.parentNode.classList.contains('highlighter-mark')) {
                    // This is already a highlight element
                    node.parentNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    highlightElement(node.parentNode);
                } else {
                    // This is a text node, we need to create temporary highlight
                    try {
                        const range = document.createRange();
                        range.setStart(node, pos);
                        range.setEnd(node, pos + text.length);
                        
                        // Create temporary visual cue
                        const tempHighlight = document.createElement('span');
                        tempHighlight.className = 'highlighter-mark temp-highlight';
                        // Use the saved color if available, or default to yellow
                        if (highlight.colorKey) {
                            tempHighlight.dataset.color = highlight.colorKey;
                        }
                        tempHighlight.style.backgroundColor = highlight.colorValue || '#ffff00';
                        tempHighlight.style.transition = 'background-color 2s';
                        
                        range.surroundContents(tempHighlight);
                        tempHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        highlightElement(tempHighlight);
                        
                        // Remove temp highlight after a while, leaving original text
                        setTimeout(() => {
                            if (tempHighlight.parentNode) {
                                const parent = tempHighlight.parentNode;
                                const text = tempHighlight.textContent;
                                const textNode = document.createTextNode(text);
                                parent.replaceChild(textNode, tempHighlight);
                            }
                        }, 5000);
                    } catch (e) {
                        console.error('Error creating temporary highlight:', e);
                    }
                }
                return true;
            }
        }
    }
    
    console.log(`Could not find occurrence ${occurrenceIndex} of text: ${text}`);
    return false;
}

// Function to add visual emphasis to a highlighted element
function highlightElement(element) {
    // Add a pulsing effect
    const originalColor = element.style.backgroundColor;
    const colorKey = element.dataset.color || 'yellow';
    
    // Define the animation
    element.style.animation = `pulse-highlight-${colorKey} 2s ease-in-out 3`;
    
    // Create the keyframes for this color's animation if they don't exist yet
    if (!document.querySelector(`#highlight-keyframes-${colorKey}`)) {
        const style = document.createElement('style');
        style.id = `highlight-keyframes-${colorKey}`;
        
        // Generate appropriate contrast color for the animation
        let pulseColor;
        switch(colorKey) {
            case 'yellow':
                pulseColor = 'orange';
                break;
            case 'green':
                pulseColor = '#97d097'; // Darker green
                break;
            case 'blue':
                pulseColor = '#99c2ff'; // Darker blue
                break;
            case 'pink':
                pulseColor = '#ff9999'; // Darker pink
                break;
            case 'purple':
                pulseColor = '#cc99ff'; // Darker purple
                break;
            default:
                pulseColor = 'orange';
        }
        
        style.textContent = `
            @keyframes pulse-highlight-${colorKey} {
                0% { background-color: ${originalColor}; }
                50% { background-color: ${pulseColor}; }
                100% { background-color: ${originalColor}; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Remove the animation after it completes
    setTimeout(() => {
        element.style.animation = '';
        element.style.backgroundColor = originalColor;
    }, 6000);
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === 'scrollToHighlight') {
        scrollToHighlight(message.highlightId, message.highlightText, message.occurrenceIndex);
        sendResponse({ success: true });
        return true;
    }
});

// Track if we're in the middle of a mouse selection
let isSelecting = false;

// Mouse down event to track start of selection
document.addEventListener('mousedown', function(e) {
    // Don't interfere with clicks on the palette itself
    if (e.target.closest('.highlighter-color-palette') ||
        e.target.classList.contains('highlighter-color-circle')) {
        return;
    }
    
    isSelecting = true;
    hideColorPalette();
});

// Mouse up event to detect end of selection
document.addEventListener('mouseup', function(e) {
    // Don't interfere with clicks on the palette itself
    if (e.target.closest('.highlighter-color-palette') ||
        e.target.classList.contains('highlighter-color-circle')) {
        return;
    }
    
    // Wait briefly to ensure selection is complete before checking
    setTimeout(() => {
        isSelecting = false;
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText) {
            positionColorPalette();
        }
    }, 10);
});

// Event listeners for showing/hiding color palette on text selection
document.addEventListener('selectionchange', function() {
    // Only process this event if we're not in the middle of a mouse selection
    if (!isSelecting) {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        // Get current palette
        const palette = document.getElementById('highlighter-color-palette');
        
        if (selectedText) {
            // Only reposition if the selection text has changed
            if (!palette || palette.dataset.selectionText !== selectedText) {
                positionColorPalette();
            }
        } else {
            hideColorPalette();
        }
    }
});

// Hide palette when clicking elsewhere (but not during selection)
document.addEventListener('click', function(e) {
    // Skip this during text selection
    if (isSelecting) return;
    
    // Check if click is outside of the palette and not on a color circle
    if (!e.target.closest('.highlighter-color-palette') && 
        !e.target.classList.contains('highlighter-color-circle')) {
        hideColorPalette();
    }
});

// Function to initialize notes feature if available
function initializeNotesFeature() {
    if (typeof initializeNotes === 'function') {
        console.log('Initializing notes feature');
        initializeNotes();
    } else {
        console.log('Notes feature not found, waiting...');
        // Try again after a short delay in case the script loads later
        setTimeout(() => {
            if (typeof initializeNotes === 'function') {
                console.log('Initializing notes feature (delayed)');
                initializeNotes();
            }
        }, 500);
    }
}

// Initialize notes feature when page is loaded
document.addEventListener('DOMContentLoaded', initializeNotesFeature);

// Also try after full page load
window.addEventListener('load', initializeNotesFeature);
