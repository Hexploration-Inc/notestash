// Create context menu item when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'highlight-text',
    title: 'Highlight Text',
    contexts: ['selection']
  });
});

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'highlight-text') {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: highlightSelection
    });
  }
});

// Function to highlight selected text
function highlightSelection() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (selectedText) {
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.className = 'highlighter-mark';
    span.style.backgroundColor = 'yellow';
    
    const highlightId = `highlight-${Date.now()}`;
    span.dataset.highlightId = highlightId;
    
    try {
      range.surroundContents(span);
      
      // Save highlight to storage
      chrome.storage.local.get(['highlights'], function(result) {
        const highlights = result.highlights || {};
        if (!highlights[window.location.href]) {
          highlights[window.location.href] = [];
        }
        highlights[window.location.href].push({
          id: highlightId,
          text: selectedText,
          url: window.location.href,
          timestamp: Date.now()
        });
        chrome.storage.local.set({ highlights });
      });
    } catch (e) {
      console.error('Failed to highlight text:', e);
    }
  }
}
