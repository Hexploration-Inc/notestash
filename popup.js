// Populate highlights list when popup opens
document.addEventListener('DOMContentLoaded', function() {
    const highlightList = document.getElementById('highlightList');
    const clearButton = document.getElementById('clearHighlights');

    // Load and display highlights
    function loadHighlights() {
        chrome.storage.local.get(['highlights'], function(result) {
            highlightList.innerHTML = '';
            const highlights = result.highlights || {};
            let hasHighlights = false;
            
            for (const url in highlights) {
                const urlHighlights = highlights[url];
                if (urlHighlights.length > 0) {
                    hasHighlights = true;
                    
                    // Create URL header
                    const urlHeader = document.createElement('div');
                    urlHeader.textContent = new URL(url).hostname;
                    urlHeader.style.fontWeight = 'bold';
                    urlHeader.style.marginTop = '10px';
                    highlightList.appendChild(urlHeader);

                    // Add highlights for this URL
                    urlHighlights.forEach(highlight => {
                        const div = document.createElement('div');
                        div.className = 'highlight-item';
                        
                        // Truncate text if it's too long
                        const maxLength = 100;
                        let displayText = highlight.text;
                        if (displayText.length > maxLength) {
                            displayText = displayText.substring(0, maxLength) + '...';
                        }
                        
                        div.textContent = displayText;
                        div.title = `Created: ${new Date(highlight.timestamp).toLocaleString()}`;
                        
                        // Make the highlight clickable
                        div.style.cursor = 'pointer';
                        div.dataset.url = url;
                        div.dataset.id = highlight.id;
                        div.dataset.text = highlight.text;
                        div.dataset.occurrenceIndex = highlight.occurrenceIndex || 1;
                        
                        // Add click handler to navigate to the highlight
                        div.addEventListener('click', function() {
                            navigateToHighlight(this.dataset.url, {
                                id: this.dataset.id,
                                text: this.dataset.text,
                                occurrenceIndex: parseInt(this.dataset.occurrenceIndex)
                            });
                        });
                        
                        highlightList.appendChild(div);
                    });
                }
            }
            
            if (!hasHighlights) {
                const emptyMessage = document.createElement('div');
                emptyMessage.textContent = 'No highlights yet. Select text on webpages and use right-click menu to highlight.';
                emptyMessage.style.fontStyle = 'italic';
                emptyMessage.style.color = '#888';
                emptyMessage.style.textAlign = 'center';
                emptyMessage.style.margin = '20px 0';
                highlightList.appendChild(emptyMessage);
            }
        });
    }
    
    // Function to navigate to a specific highlight
    function navigateToHighlight(url, highlight) {
        // Open a new tab with the target URL
        chrome.tabs.create({ url: url }, function(tab) {
            // Add a listener that will send a message to the content script when the page is loaded
            function checkAndScroll() {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'scrollToHighlight',
                    highlightId: highlight.id,
                    highlightText: highlight.text,
                    occurrenceIndex: highlight.occurrenceIndex
                });
            }
            
            // We need to wait until the page is fully loaded and our content script has initialized
            chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                if (tabId === tab.id && changeInfo.status === 'complete') {
                    // Wait a bit more to ensure our content script has initialized
                    setTimeout(checkAndScroll, 1000);
                    chrome.tabs.onUpdated.removeListener(listener);
                }
            });
        });
    }

    // Clear all highlights
    clearButton.addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all highlights?')) {
            chrome.storage.local.clear(function() {
                loadHighlights();
            });
        }
    });

    // Initial load
    loadHighlights();
});
