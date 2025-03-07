// Function to restore highlights on page load
function restoreHighlights() {
    chrome.storage.local.get(['highlights'], function(result) {
        const urlHighlights = result.highlights?.[window.location.href] || [];
        
        // Create a tree walker to find text nodes
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        urlHighlights.forEach(highlight => {
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.includes(highlight.text)) {
                    const range = document.createRange();
                    range.setStart(node, node.textContent.indexOf(highlight.text));
                    range.setEnd(node, node.textContent.indexOf(highlight.text) + highlight.text.length);
                    
                    const span = document.createElement('span');
                    span.className = 'highlighter-mark';
                    span.dataset.highlightId = highlight.id;
                    
                    try {
                        range.surroundContents(span);
                    } catch (e) {
                        console.log('Could not highlight text:', e);
                    }
                    break;
                }
            }
        });
    });
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

// Function to restore highlights on page load
function restoreHighlights() {
    chrome.storage.local.get(['highlights'], function(result) {
        const urlHighlights = result.highlights?.[window.location.href] || [];
        
        // Create a tree walker to find text nodes
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        urlHighlights.forEach(highlight => {
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.includes(highlight.text)) {
                    const range = document.createRange();
                    range.setStart(node, node.textContent.indexOf(highlight.text));
                    range.setEnd(node, node.textContent.indexOf(highlight.text) + highlight.text.length);
                    
                    const span = document.createElement('span');
                    span.className = 'highlighter-mark';
                    span.style.backgroundColor = 'yellow';
                    span.dataset.highlightId = highlight.id;
                    
                    range.surroundContents(span);
                    break;
                }
            }
        });
    });
}

// Restore highlights when page loads
document.addEventListener('DOMContentLoaded', restoreHighlights);
