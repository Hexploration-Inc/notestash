// Populate highlights list when popup opens
document.addEventListener('DOMContentLoaded', function() {
    const highlightList = document.getElementById('highlightList');
    const clearButton = document.getElementById('clearHighlights');

    // Load and display highlights
    function loadHighlights() {
        chrome.storage.local.get(['highlights'], function(result) {
            highlightList.innerHTML = '';
            const highlights = result.highlights || {};
            
            for (const url in highlights) {
                const urlHighlights = highlights[url];
                if (urlHighlights.length > 0) {
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
                        div.textContent = highlight.text;
                        div.title = new Date(highlight.timestamp).toLocaleString();
                        highlightList.appendChild(div);
                    });
                }
            }
        });
    }

    // Clear all highlights
    clearButton.addEventListener('click', function() {
        chrome.storage.local.clear(function() {
            loadHighlights();
        });
    });

    // Initial load
    loadHighlights();
});
