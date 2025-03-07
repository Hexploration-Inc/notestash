// Populate highlights list when popup opens
document.addEventListener('DOMContentLoaded', function() {
    const highlightList = document.getElementById('highlightList');
    const clearButton = document.getElementById('clearHighlights');
    const exportButton = document.getElementById('exportHighlights');
    const importButton = document.getElementById('importHighlights');
    const importInput = document.getElementById('importInput');

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
                        
                        // Apply color styling to the highlight item
                        if (highlight.colorValue) {
                            div.style.borderLeft = `4px solid ${highlight.colorValue}`;
                            div.style.backgroundColor = highlight.colorValue + '30'; // Add 30% opacity
                        } else {
                            div.style.borderLeft = '4px solid #ffff00';
                            div.style.backgroundColor = '#ffff0030';
                        }
                        
                        // Truncate text if it's too long
                        const maxLength = 100;
                        let displayText = highlight.text;
                        if (displayText.length > maxLength) {
                            displayText = displayText.substring(0, maxLength) + '...';
                        }
                        
                        div.textContent = displayText;
                        
                        // Show color name in the tooltip if available
                        let tooltipText = `Created: ${new Date(highlight.timestamp).toLocaleString()}`;
                        if (highlight.colorKey) {
                            tooltipText += ` | Color: ${highlight.colorKey.charAt(0).toUpperCase() + highlight.colorKey.slice(1)}`;
                        }
                        div.title = tooltipText;
                        
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

    // Export highlights
    exportButton.addEventListener('click', function() {
        chrome.storage.local.get(['highlights'], function(result) {
            const highlights = result.highlights || {};
            
            // Create a data object with timestamp and version info
            const exportData = {
                version: '1.0',
                timestamp: Date.now(),
                highlights: highlights
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
            a.download = `highlights-export-${new Date().toISOString().slice(0, 10)}.json`;
            
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

    // Import highlights button click - trigger file input
    importButton.addEventListener('click', function() {
        importInput.click();
    });
    
    // Import highlights file selected
    importInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // Validate import data structure
                if (!importedData.highlights) {
                    throw new Error('Invalid import file format');
                }
                
                // Merge with existing highlights
                chrome.storage.local.get(['highlights'], function(result) {
                    let existingHighlights = result.highlights || {};
                    const importedHighlights = importedData.highlights;
                    
                    // Ask user if they want to merge or replace
                    const hasExisting = Object.keys(existingHighlights).length > 0;
                    let mergeOption = 'merge';
                    
                    if (hasExisting) {
                        const userOption = confirm(
                            'Would you like to merge with your existing highlights? ' +
                            'Click OK to merge, or Cancel to replace all existing highlights.'
                        );
                        mergeOption = userOption ? 'merge' : 'replace';
                    }
                    
                    let finalHighlights = {};
                    if (mergeOption === 'replace') {
                        finalHighlights = importedHighlights;
                    } else { // merge
                        finalHighlights = { ...existingHighlights };
                        
                        // Merge URL by URL
                        for (const url in importedHighlights) {
                            if (!finalHighlights[url]) {
                                finalHighlights[url] = [];
                            }
                            
                            // Get existing highlight IDs to avoid duplicates
                            const existingIds = new Set();
                            if (finalHighlights[url]) {
                                finalHighlights[url].forEach(h => existingIds.add(h.id));
                            }
                            
                            // Add imported highlights that don't exist yet
                            importedHighlights[url].forEach(highlight => {
                                if (!existingIds.has(highlight.id)) {
                                    finalHighlights[url].push(highlight);
                                }
                            });
                        }
                    }
                    
                    // Save merged highlights
                    chrome.storage.local.set({ highlights: finalHighlights }, function() {
                        alert('Highlights imported successfully!');
                        loadHighlights();
                    });
                });
            } catch (error) {
                console.error('Error importing highlights:', error);
                alert('Error importing highlights: ' + error.message);
            }
            
            // Reset file input
            importInput.value = '';
        };
        
        reader.onerror = function() {
            alert('Error reading the import file');
            importInput.value = '';
        };
        
        // Read the file as text
        reader.readAsText(file);
    });

    // Initial load
    loadHighlights();
});
