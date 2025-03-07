// Function to restore highlights
function restoreHighlights() {
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
                                // Explicitly apply the style
                                span.style.backgroundColor = 'yellow';
                                
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
                    // Explicitly apply the style
                    span.style.backgroundColor = 'yellow';
                    
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
                span.style.backgroundColor = 'yellow';
                
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
    document.addEventListener('DOMContentLoaded', ensureHighlightsRestored);
} else {
    ensureHighlightsRestored();
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
