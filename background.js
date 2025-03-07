// Define highlight colors
const highlightColors = {
  yellow: { color: '#ffff00', name: 'Yellow' },
  green: { color: '#c2f0c2', name: 'Light Green' },
  blue: { color: '#cce5ff', name: 'Light Blue' },
  pink: { color: '#ffcccc', name: 'Light Pink' },
  purple: { color: '#e6ccff', name: 'Light Purple' }
};

// Create context menu items when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  // Parent menu item
  chrome.contextMenus.create({
    id: 'highlight-text-parent',
    title: 'Highlight Text',
    contexts: ['selection']
  });
  
  // Color submenu items
  Object.entries(highlightColors).forEach(([id, details]) => {
    chrome.contextMenus.create({
      id: `highlight-${id}`,
      parentId: 'highlight-text-parent',
      title: details.name,
      contexts: ['selection']
    });
  });
});

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Check if the menu item is one of our highlight colors
  const colorMatch = info.menuItemId.match(/^highlight-(\w+)$/);
  
  if (colorMatch) {
    const colorKey = colorMatch[1];
    if (highlightColors[colorKey]) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: highlightSelection,
        args: [colorKey, highlightColors[colorKey].color]
      });
    }
  }
});

// Function to highlight selected text
function highlightSelection(colorKey = 'yellow', colorValue = '#ffff00') {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText) {
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.className = 'highlighter-mark';
    span.style.backgroundColor = colorValue;
    span.dataset.color = colorKey;
    
    const highlightId = `highlight-${Date.now()}`;
    span.dataset.highlightId = highlightId;
    
    try {
      // Get the context before and after the selection to help identify the correct location later
      const contextLength = 50; // Character length for context
      
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
        while (node !== document.body) {
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
      
      // Save highlight to storage with position information
      chrome.storage.local.get(['highlights'], function(result) {
        const highlights = result.highlights || {};
        if (!highlights[window.location.href]) {
          highlights[window.location.href] = [];
        }
        highlights[window.location.href].push({
          id: highlightId,
          text: selectedText,
          url: window.location.href,
          timestamp: Date.now(),
          occurrenceIndex: occurrenceIndex, // Store which occurrence of the text was highlighted
          nodePath: nodePath, // Store path to node for more precise location
          colorKey: colorKey, // Store the color key
          colorValue: colorValue // Store the actual color value
        });
        chrome.storage.local.set({ highlights }, function() {
          console.log('Highlight saved successfully:', highlightId, 'occurrence:', occurrenceIndex, 'color:', colorKey);
        });
      });
    } catch (e) {
      console.error('Failed to highlight text:', e);
    }
  }
}
