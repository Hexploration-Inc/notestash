// Define highlight colors (keep in sync with background.js)
const highlightColors = {
  yellow: { color: "#ffff00", name: "Yellow" },
  green: { color: "#c2f0c2", name: "Light Green" },
  blue: { color: "#cce5ff", name: "Light Blue" },
  pink: { color: "#ffcccc", name: "Light Pink" },
  purple: { color: "#e6ccff", name: "Light Purple" },
};

// Cache to store text occurrences
const textOccurrenceCache = new Map();

// Flag to temporarily disable cache invalidation during highlight operations
let disableCacheInvalidation = false;

// Variable to track when the last restoration happened
let lastRestoreTime = 0;
// Variable to track if a restoration is currently in progress
let isRestorationInProgress = false;

// Function to invalidate cache (call when DOM changes significantly)
function invalidateTextOccurrenceCache() {
  // Skip invalidation if disabled
  if (disableCacheInvalidation) {
    // console.log('Cache invalidation skipped (disabled during operation)');
    return;
  }

  textOccurrenceCache.clear();
  // console.log('Text occurrence cache cleared');
}

// Functions to temporarily disable cache invalidation
function suppressCacheInvalidation(fn) {
  disableCacheInvalidation = true;
  try {
    return fn();
  } finally {
    disableCacheInvalidation = false;
  }
}

// Create and manage color palette for text selection
function createColorPalette() {
  // Check if palette already exists
  let palette = document.getElementById("highlighter-color-palette");
  if (palette) return palette;

  // Create palette element
  palette = document.createElement("div");
  palette.id = "highlighter-color-palette";
  palette.className = "highlighter-color-palette";

  // Add color circles
  Object.entries(highlightColors).forEach(([colorKey, details]) => {
    const colorCircle = document.createElement("div");
    colorCircle.className = "highlighter-color-circle";
    colorCircle.style.backgroundColor = details.color;
    colorCircle.dataset.colorKey = colorKey;
    colorCircle.title = details.name;

    // Add click handler
    colorCircle.addEventListener("click", (e) => {
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
      const span = document.createElement("span");
      span.className = "highlighter-mark";
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
      const getNodePath = function (node) {
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
      while ((textNode = currentNode.nextNode())) {
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
      try {
        // Try the simple method first (works for single node highlights)
        range.surroundContents(span);
      } catch (multiNodeError) {
        // If the simple method fails, we're likely dealing with a multi-node selection
        console.log(
          "Multi-node selection detected, applying complex highlighting"
        );

        // Create a document fragment to hold our highlighted content
        const fragment = document.createDocumentFragment();

        // Create the highlight spans for all contents in the range
        const contents = range.extractContents();

        // Create a wrapper span with the same properties
        const wrapper = document.createElement("span");
        wrapper.className = "highlighter-mark";
        wrapper.style.backgroundColor = colorValue;
        wrapper.dataset.color = colorKey;
        wrapper.dataset.highlightId = highlightId;

        // Add the extracted contents to our wrapper
        wrapper.appendChild(contents);
        fragment.appendChild(wrapper);

        // Insert the fragment at the start of the range
        range.insertNode(fragment);
      }

      // Save the highlight to storage
      const highlight = {
        id: highlightId,
        text: selectedText,
        url: window.location.href,
        timestamp: Date.now(),
        occurrenceIndex: occurrenceIndex,
        nodePath: nodePath,
        colorKey: colorKey,
        colorValue: colorValue,
      };

      saveHighlight(highlight);
      console.log("Successfully applied highlight:", highlight);
    } catch (e) {
      console.error("Failed to highlight text:", e);
      // Try again with a simpler approach if the complex one fails
      try {
        const range = selection.getRangeAt(0).cloneRange();
        const span = document.createElement("span");
        span.className = "highlighter-mark";
        span.style.backgroundColor = colorValue;
        span.dataset.color = colorKey;

        const highlightId = `highlight-${Date.now()}`;
        span.dataset.highlightId = highlightId;

        try {
          // Try the simple surroundContents first
          range.surroundContents(span);
        } catch (multiNodeError) {
          // If it fails, it's probably a multi-node selection
          console.log("Using alternative multi-node highlighting in fallback");

          // Extract the contents and wrap them
          const contents = range.extractContents();
          span.appendChild(contents);
          range.insertNode(span);
        }

        // Save a simpler highlight version
        saveHighlight({
          id: highlightId,
          text: selectedText,
          url: window.location.href,
          timestamp: Date.now(),
          colorKey: colorKey,
          colorValue: colorValue,
        });

        console.log("Applied simplified highlight as fallback");
      } catch (e2) {
        console.error("Both highlight methods failed:", e2);
      }
    }
  } else {
    console.warn("No text selected for highlighting");
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
  left =
    rect.left +
    window.scrollX +
    rect.width / 2 -
    (palette.offsetWidth / 2 || 100); // Default width estimate if not yet rendered

  // Ensure palette stays within viewport horizontally
  if (left < 5) left = 5;
  if (left + (palette.offsetWidth || 200) > window.innerWidth - 5) {
    left = window.innerWidth - (palette.offsetWidth || 200) - 5;
  }

  // Apply position
  palette.style.top = `${top}px`;
  palette.style.left = `${left}px`;
  palette.style.display = "flex";
  palette.style.opacity = "1";

  // Store the current selection text to check if it changes
  palette.dataset.selectionText = selection.toString().trim();

  return true;
}

// Hide color palette
function hideColorPalette() {
  const palette = document.getElementById("highlighter-color-palette");
  if (palette) {
    palette.style.display = "none";
  }
}

// Cache for DOM text nodes to avoid recreating walker for each highlight
let domTextNodesCache = null;
let lastCacheTime = 0;

// Original restore highlights function that will be wrapped
function _originalRestoreHighlights() {
  // Use a flag to signal we're in restoration mode to avoid triggering the observer
  window._isRestoringHighlights = true;

  chrome.storage.local.get(["highlights"], function (result) {
    const urlHighlights = result.highlights?.[window.location.href] || [];
    if (urlHighlights.length === 0) {
      window._isRestoringHighlights = false;
      return;
    }

    // Track which highlights are already present on the page
    const existingHighlightIds = new Set();
    const existingHighlights = document.querySelectorAll(".highlighter-mark");
    existingHighlights.forEach((el) => {
      if (el.dataset.highlightId) {
        existingHighlightIds.add(el.dataset.highlightId);
      }
    });

    // Only process highlights that aren't already on the page
    const highlightsToRestore = urlHighlights.filter(
      (highlight) => !existingHighlightIds.has(highlight.id)
    );

    // Skip processing if all highlights are already on the page
    if (highlightsToRestore.length === 0) {
      console.log(
        `All ${urlHighlights.length} highlights already present on page`
      );
      window._isRestoringHighlights = false;
      return;
    }

    // Prepare DOM node cache for fast lookups (only refresh every 10 seconds to avoid expensive rebuilds)
    const now = Date.now();
    if (!domTextNodesCache || now - lastCacheTime > 10000) {
      buildTextNodeCache();
      lastCacheTime = now;
    }

    // Optimization: pre-build node path lookup function
    const nodePathLookup = {};
    highlightsToRestore.forEach((highlight) => {
      if (highlight.nodePath) {
        nodePathLookup[highlight.id] = highlight.nodePath;
      }
    });

    // Sort highlights to process them in a consistent order
    const sortedHighlights = [...highlightsToRestore].sort(
      (a, b) => a.timestamp - b.timestamp
    );

    // Process highlights - significantly reduce console logging
    let successfulHighlights = 0;
    const highlightCount = sortedHighlights.length;

    // Apply all highlights in one go with minimal logging
    sortedHighlights.forEach((highlight) => {
      const success = applyHighlightFast(highlight, nodePathLookup);
      if (success) successfulHighlights++;
    });

    // Only report total summary rather than individual highlights
    const totalHighlightsOnPage =
      existingHighlightIds.size + successfulHighlights;
    console.log(
      `Restored ${successfulHighlights}/${highlightCount} highlights (${totalHighlightsOnPage}/${urlHighlights.length} total on page)`
    );

    window._isRestoringHighlights = false;
  });
}

// Build a cache of all text nodes in the document
function buildTextNodeCache() {
  domTextNodesCache = [];

  // Skip hidden elements to avoid processing invisible content
  const isVisible = function (node) {
    if (!node) return false;

    // Get the computed style if it's an element node
    if (node.nodeType === Node.ELEMENT_NODE) {
      const style = window.getComputedStyle(node);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0"
      ) {
        return false;
      }
    }

    // Check parent visibility recursively
    return node.parentNode ? isVisible(node.parentNode) : true;
  };

  // Use a more robust walker configuration
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function (node) {
        // Skip nodes that are already inside highlight spans
        if (
          node.parentNode &&
          node.parentNode.classList &&
          node.parentNode.classList.contains("highlighter-mark")
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip very short text nodes to reduce noise
        if (node.textContent.trim().length < 2) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip invisible nodes
        if (!isVisible(node.parentNode)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    },
    false
  );

  let node;
  while ((node = walker.nextNode())) {
    // Add the node to our cache
    domTextNodesCache.push(node);
  }

  // Log cache building for diagnostics
  console.log(`Built text node cache with ${domTextNodesCache.length} nodes`);
}

// Fast highlight application using the cached nodes
function applyHighlightFast(highlight, nodePathLookup) {
  // Early return if text is missing
  if (!highlight.text || highlight.text.length === 0) return false;

  const targetOccurrenceIndex = highlight.occurrenceIndex || 1;
  let found = false;
  let node = null;
  let pos = -1;

  // Sanitize text for more reliable matching
  const sanitizedText = highlight.text.trim();
  if (sanitizedText.length === 0) return false;

  // Method 1: Find by node path first (fastest method)
  if (highlight.nodePath) {
    node = getNodeByPath(highlight.nodePath);
    if (node && node.nodeType === Node.TEXT_NODE) {
      // Try exact match first
      pos = node.textContent.indexOf(highlight.text);
      if (pos !== -1) {
        found = true;
      }
      // Try trimmed version as fallback
      else if (sanitizedText !== highlight.text) {
        pos = node.textContent.indexOf(sanitizedText);
        if (pos !== -1) {
          found = true;
          // Update the highlight text to what we actually found
          highlight.text = sanitizedText;
        }
      }
    }
  }

  // Method 2: If node path failed, search by text occurrence (using cache)
  if (!found && domTextNodesCache) {
    let currentOccurrence = 0;

    // Loop through cached nodes
    for (let i = 0; i < domTextNodesCache.length; i++) {
      const textNode = domTextNodesCache[i];
      const nodeText = textNode.textContent;
      let startPos = 0;

      // Try to find all occurrences in this node
      while ((pos = nodeText.indexOf(highlight.text, startPos)) !== -1) {
        currentOccurrence++;

        if (currentOccurrence === targetOccurrenceIndex) {
          node = textNode;
          found = true;
          break;
        }

        startPos = pos + 1;
      }

      // If we didn't find with exact text, try with sanitized version
      if (!found && sanitizedText !== highlight.text) {
        startPos = 0;
        while ((pos = nodeText.indexOf(sanitizedText, startPos)) !== -1) {
          currentOccurrence++;

          if (currentOccurrence === targetOccurrenceIndex) {
            node = textNode;
            found = true;
            // Update the highlight text to what we actually found
            highlight.text = sanitizedText;
            break;
          }

          startPos = pos + 1;
        }
      }

      if (found) break;
    }
  }

  // Method 3: Full-text search using a more relaxed approach
  if (!found && domTextNodesCache) {
    // Try to find partial matches (for cases where text may have slightly changed)
    const minMatchLength = Math.max(
      10,
      Math.floor(highlight.text.length * 0.7)
    );
    const searchText = highlight.text.substring(0, minMatchLength);

    if (searchText.length >= 10) {
      // Only attempt for reasonably sized text
      let currentOccurrence = 0;

      for (let i = 0; i < domTextNodesCache.length; i++) {
        const textNode = domTextNodesCache[i];
        const nodeText = textNode.textContent;

        if (nodeText.includes(searchText)) {
          currentOccurrence++;

          if (currentOccurrence === targetOccurrenceIndex) {
            node = textNode;
            pos = nodeText.indexOf(searchText);
            found = true;
            // Update the highlight text to use the partial match
            highlight.text = searchText;
            break;
          }
        }
      }
    }
  }

  // Apply the highlight if we found the right node and position
  if (found && node) {
    try {
      const range = document.createRange();
      range.setStart(node, pos);
      range.setEnd(node, pos + highlight.text.length);

      const span = document.createElement("span");
      span.className = "highlighter-mark";
      span.dataset.highlightId = highlight.id;

      // Apply color from saved highlight or default to yellow
      if (highlight.colorKey) {
        span.dataset.color = highlight.colorKey;
      }
      span.style.backgroundColor = highlight.colorValue || "#ffff00";

      try {
        // Try simple method first
        range.surroundContents(span);
      } catch (multiNodeError) {
        // Handle multi-node selections
        console.log(
          "Multi-node selection detected during fast highlight, using alternative approach"
        );
        const contents = range.extractContents();
        span.appendChild(contents);
        range.insertNode(span);
      }

      return true;
    } catch (e) {
      console.log(
        `Failed to apply highlight for text: "${highlight.text.substring(
          0,
          30
        )}${highlight.text.length > 30 ? "..." : ""}", error: ${e.message}`
      );
      // Try a different approach after failure
      try {
        // Create a replacement node manually
        const beforeText = document.createTextNode(
          node.textContent.substring(0, pos)
        );
        const highlightSpan = document.createElement("span");
        highlightSpan.className = "highlighter-mark";
        highlightSpan.dataset.highlightId = highlight.id;
        highlightSpan.style.backgroundColor = highlight.colorValue || "#ffff00";
        highlightSpan.textContent = highlight.text;
        const afterText = document.createTextNode(
          node.textContent.substring(pos + highlight.text.length)
        );

        const parentNode = node.parentNode;
        parentNode.insertBefore(beforeText, node);
        parentNode.insertBefore(highlightSpan, node);
        parentNode.insertBefore(afterText, node);
        parentNode.removeChild(node);

        return true;
      } catch (fallbackError) {
        console.log(
          `Fallback highlight method also failed: ${fallbackError.message}`
        );
      }
    }
  }

  // Last resort: fallback method if all else fails
  if (!found && highlight.position) {
    return attemptFallbackHighlight(highlight);
  }

  return false;
}

// Helper function to get node by path (reused from original)
function getNodeByPath(path) {
  if (!path || !Array.isArray(path) || path.length === 0) return null;

  let currentNode = document.body;
  for (let i = 0; i < path.length; i++) {
    const childIndex = path[i];
    if (currentNode.childNodes.length <= childIndex) return null;
    currentNode = currentNode.childNodes[childIndex];
  }
  return currentNode;
}

// Function to restore highlights (will be wrapped by setupHighlightInteractions)
let restoreHighlights = _originalRestoreHighlights;

// Fallback function for older highlights without position data
function attemptFallbackHighlight(highlight) {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function (node) {
        if (
          node.parentNode.classList &&
          node.parentNode.classList.contains("highlighter-mark")
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.textContent.trim().length === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
    false
  );

  let node;
  while ((node = walker.nextNode())) {
    if (node.textContent.includes(highlight.text)) {
      try {
        const range = document.createRange();
        range.setStart(node, node.textContent.indexOf(highlight.text));
        range.setEnd(
          node,
          node.textContent.indexOf(highlight.text) + highlight.text.length
        );

        const span = document.createElement("span");
        span.className = "highlighter-mark";
        span.dataset.highlightId = highlight.id;
        // Apply color from saved highlight or default to yellow
        if (highlight.colorKey) {
          span.dataset.color = highlight.colorKey;
        }
        span.style.backgroundColor = highlight.colorValue || "#ffff00";

        range.surroundContents(span);
        console.log("Fallback highlight applied:", highlight.text);
        return true;
      } catch (e) {
        console.error("Fallback highlighting error:", e, highlight.text);
      }
    }
  }
  return false;
}

// Function to save highlight to storage
function saveHighlight(highlight) {
  chrome.storage.local.get(["highlights"], function (result) {
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
  chrome.storage.local.get(["highlights"], function (result) {
    const highlights = result.highlights || {};
    const urlHighlights = highlights[window.location.href] || [];

    // Find and remove the highlight with matching ID
    const updatedHighlights = urlHighlights.filter((h) => h.id !== highlightId);

    // Update storage
    if (updatedHighlights.length !== urlHighlights.length) {
      highlights[window.location.href] = updatedHighlights;
      chrome.storage.local.set({ highlights }, function () {
        console.log("Highlight removed:", highlightId);
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
  if (!document.body) return;

  const now = Date.now();

  // Don't allow multiple restorations to run simultaneously
  if (isRestorationInProgress) {
    console.log("Restoration already in progress, skipping this attempt");
    return;
  }

  // Skip frequent restoration attempts (within 500ms) to avoid hammering the DOM
  if (now - lastRestoreTime < 500) {
    return;
  }

  // Count existing highlights to compare before and after restoration
  const existingHighlightCount =
    document.querySelectorAll(".highlighter-mark").length;

  console.log("Attempting to restore highlights...");
  isRestorationInProgress = true;

  // Use suppressCacheInvalidation to prevent cache invalidation during highlight restoration
  suppressCacheInvalidation(() => {
    // Set global flag to prevent mutation observers from interfering
    window._isRestoringHighlights = true;

    try {
      restoreHighlights();
    } catch (error) {
      console.error("Error during highlight restoration:", error);
    } finally {
      // Always clear flags even if restoration fails
      window._isRestoringHighlights = false;
      isRestorationInProgress = false;
      lastRestoreTime = Date.now();

      // Compare highlight counts after restoration
      const newHighlightCount =
        document.querySelectorAll(".highlighter-mark").length;
      if (newHighlightCount > existingHighlightCount) {
        console.log(
          `Restoration added ${
            newHighlightCount - existingHighlightCount
          } new highlights`
        );
      }
    }
  });
}

// Try multiple times to restore highlights using a more robust approach
function ensureHighlightsRestored() {
  // Check if highlights are already on the page
  chrome.storage.local.get(["highlights"], function (result) {
    const urlHighlights = result.highlights?.[window.location.href] || [];
    if (urlHighlights.length === 0) {
      console.log("No highlights to restore for this page");
      return;
    }

    const existingHighlights = document.querySelectorAll(".highlighter-mark");
    if (existingHighlights.length === urlHighlights.length) {
      // All highlights are already on the page
      console.log(
        `All ${urlHighlights.length} highlights already on page, no need for restoration`
      );
      return;
    }

    // For a cleaner approach, cancel previous restoration attempts
    const cancelPreviousDelays = window._highlightRestoreTimeouts || [];
    cancelPreviousDelays.forEach((timeoutId) => clearTimeout(timeoutId));
    window._highlightRestoreTimeouts = [];

    // Immediate attempt
    attemptRestore();

    // Use fewer, more strategic delayed attempts now that we have better restoration protection
    const delays = [500, 2000, 5000, 10000];

    // Setup delayed attempts and track them for potential cancellation
    delays.forEach((delay) => {
      const timeoutId = setTimeout(() => {
        // Before attempting restoration on this delay, check if it's still needed
        const currentHighlights =
          document.querySelectorAll(".highlighter-mark");
        if (currentHighlights.length === urlHighlights.length) {
          console.log(`All highlights restored, skipping further attempts`);
          // Cancel remaining timeouts
          const remainingTimeouts = window._highlightRestoreTimeouts || [];
          remainingTimeouts.forEach((id) => clearTimeout(id));
          window._highlightRestoreTimeouts = [];
          return;
        }

        attemptRestore();
      }, delay);

      window._highlightRestoreTimeouts = window._highlightRestoreTimeouts || [];
      window._highlightRestoreTimeouts.push(timeoutId);
    });

    // Also set up a mutation observer to detect when significant DOM changes occur
    const observer = new MutationObserver(function (mutations) {
      let significantChanges = false;

      // Only proceed if we don't have all highlights yet
      const currentHighlightCount =
        document.querySelectorAll(".highlighter-mark").length;
      if (currentHighlightCount === urlHighlights.length) {
        observer.disconnect();
        return;
      }

      // Check if mutations include significant additions to the DOM
      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          // Look for meaningful content additions
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (
                node.textContent.trim().length > 50 ||
                node.querySelectorAll("p, div, article, section").length > 0
              ) {
                significantChanges = true;
                break;
              }
            }
          }
        }
        if (significantChanges) break;
      }

      // Only attempt restore on significant DOM changes
      if (significantChanges) {
        // Refresh the text node cache and attempt restoration
        invalidateTextOccurrenceCache();
        attemptRestore();
      }
    });

    // Observe the body for changes, focusing on added/removed nodes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });

    // After 30 seconds, disconnect the observer to save resources
    setTimeout(() => observer.disconnect(), 30000);
  });
}

// Set up event listeners for initial page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    ensureHighlightsRestored();
    setupHighlightInteractions();
    setupCacheInvalidation(); // Initialize text occurrence cache invalidation
  });
} else {
  ensureHighlightsRestored();
  setupHighlightInteractions();
  setupCacheInvalidation(); // Initialize text occurrence cache invalidation
}

// Setup click handlers for highlight interactions
function setupHighlightInteractions() {
  // Clean up any existing event handlers to prevent duplicates
  const existingHandler = document.getElementById("highlighter-event-handler");
  if (existingHandler) {
    existingHandler.remove();
  }

  // Create an invisible element to store our initialized state
  const handlerMarker = document.createElement("div");
  handlerMarker.id = "highlighter-event-handler";
  handlerMarker.style.display = "none";
  document.body.appendChild(handlerMarker);

  // Use direct event handling for all highlights
  // This ensures we bind directly to the elements
  function addClickHandlersToHighlights() {
    document.querySelectorAll(".highlighter-mark").forEach((highlight) => {
      // Remove any existing click listeners first
      highlight.removeEventListener("click", handleHighlightClick);
      // Add the click listener
      highlight.addEventListener("click", handleHighlightClick);
      // Add visual feedback
      highlight.title = "Click to remove highlight";
    });
  }

  // Handle highlight click event
  function handleHighlightClick(e) {
    e.preventDefault();
    e.stopPropagation();

    console.log("Highlight clicked, removing...", this);
    unhighlightElement(this);
    return false;
  }

  // Add hover effect using event delegation
  document.body.addEventListener("mouseover", function (e) {
    if (e.target.classList.contains("highlighter-mark")) {
      e.target.title = "Click to remove highlight";
      e.target.classList.add("highlighter-mark-hover");
    }
  });

  document.body.addEventListener("mouseout", function (e) {
    if (e.target.classList.contains("highlighter-mark")) {
      e.target.classList.remove("highlighter-mark-hover");
    }
  });

  // Add click handlers to existing highlights
  addClickHandlersToHighlights();

  // Also add handlers to new highlights after restoration
  const originalRestoreHighlights = restoreHighlights;
  restoreHighlights = function () {
    originalRestoreHighlights.apply(this, arguments);
    // Wait a brief moment for DOM to update
    setTimeout(addClickHandlersToHighlights, 100);
  };
}

// Also try when page is fully loaded with all resources
window.addEventListener("load", ensureHighlightsRestored);

// Add a listener for after images and other resources finish loading
window.addEventListener("DOMContentLoaded", function () {
  // Set up a check after all images and iframes have loaded
  window.addEventListener("load", function () {
    setTimeout(attemptRestore, 500);
  });
});

// Handle dynamic content
const observer = new MutationObserver(function (mutations) {
  const hasNewContent = mutations.some((mutation) => {
    return Array.from(mutation.addedNodes).some((node) => {
      return (
        node.nodeType === Node.TEXT_NODE ||
        (node.nodeType === Node.ELEMENT_NODE &&
          node.textContent.trim().length > 0)
      );
    });
  });

  if (hasNewContent) {
    attemptRestore();
  }
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Function to find and scroll to a specific highlight
function scrollToHighlight(highlightId, highlightText, occurrenceIndex) {
  console.log(
    `Attempting to scroll to highlight: ${highlightId}, text: ${highlightText}, occurrence: ${occurrenceIndex}`
  );

  // First check if the highlight element already exists
  const existingHighlight = document.querySelector(
    `.highlighter-mark[data-highlight-id="${highlightId}"]`
  );
  if (existingHighlight) {
    console.log("Found existing highlight element, scrolling to it");
    existingHighlight.scrollIntoView({ behavior: "smooth", block: "center" });
    highlightElement(existingHighlight);
    return true;
  }

  // If the highlight doesn't exist yet, we need to restore highlights first
  console.log("Highlight not found in DOM, attempting to restore it");
  restoreHighlights();

  // After restoring, try to find the highlight again
  setTimeout(() => {
    const highlight = document.querySelector(
      `.highlighter-mark[data-highlight-id="${highlightId}"]`
    );
    if (highlight) {
      console.log("Found highlight after restoration, scrolling to it");
      highlight.scrollIntoView({ behavior: "smooth", block: "center" });
      highlightElement(highlight);
    } else {
      console.log(
        "Highlight still not found, attempting to locate by text and occurrence"
      );
      scrollToTextOccurrence(highlightText, occurrenceIndex);
    }
  }, 500);
}

// Set up cache invalidation for DOM changes
function setupCacheInvalidation() {
  // Track the last invalidation timestamp to prevent too frequent invalidations
  let lastInvalidationTime = 0;
  const DEBOUNCE_INTERVAL = 2000; // 2 seconds

  // Invalidate cache when body content changes significantly
  const observer = new MutationObserver((mutations) => {
    // Skip if invalidation is disabled
    if (disableCacheInvalidation) {
      return;
    }

    // Debounce frequent invalidations
    const now = Date.now();
    if (now - lastInvalidationTime < DEBOUNCE_INTERVAL) {
      return;
    }

    let shouldInvalidate = false;

    // Check if mutations are significant enough to invalidate cache
    for (const mutation of mutations) {
      // Skip mutations to highlight elements
      const targetIsHighlight =
        mutation.target.classList &&
        (mutation.target.classList.contains("highlighter-mark") ||
          mutation.target.classList.contains("temp-highlight"));

      const targetParentIsHighlight =
        mutation.target.parentNode &&
        mutation.target.parentNode.classList &&
        (mutation.target.parentNode.classList.contains("highlighter-mark") ||
          mutation.target.parentNode.classList.contains("temp-highlight"));

      // Skip mutations involving highlight elements
      if (targetIsHighlight || targetParentIsHighlight) {
        continue;
      }

      // Check if any added/removed nodes are highlights
      let involvesHighlights = false;
      if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
        // Check if mutation involves highlight elements
        for (const node of mutation.addedNodes) {
          if (
            node.classList &&
            (node.classList.contains("highlighter-mark") ||
              node.classList.contains("temp-highlight"))
          ) {
            involvesHighlights = true;
            break;
          }
        }

        for (const node of mutation.removedNodes) {
          if (
            node.classList &&
            (node.classList.contains("highlighter-mark") ||
              node.classList.contains("temp-highlight"))
          ) {
            involvesHighlights = true;
            break;
          }
        }

        // Skip if this mutation only involves highlight elements
        if (involvesHighlights) {
          continue;
        }

        shouldInvalidate = true;
        break;
      }

      // If text content changed in a non-highlight element
      if (mutation.type === "characterData" && !targetParentIsHighlight) {
        shouldInvalidate = true;
        break;
      }
    }

    if (shouldInvalidate) {
      invalidateTextOccurrenceCache();
      lastInvalidationTime = now;
    }
  });

  // Observe the entire document body for changes
  observer.observe(document.body, {
    childList: true, // Watch for changes in direct children
    subtree: true, // Watch the entire subtree
    characterData: true, // Watch for changes in text content
  });

  // Also invalidate cache on page navigation events
  window.addEventListener("beforeunload", invalidateTextOccurrenceCache);

  // Invalidate when history state changes (SPA navigation)
  window.addEventListener("popstate", invalidateTextOccurrenceCache);
}

// Function to find all occurrences of text and cache them
function findAndCacheTextOccurrences(text) {
  console.log(`Caching occurrences for text: ${text}`);

  // Don't cache very short text (less than 3 chars) or very long text to prevent excessive memory usage
  if (text.length < 3 || text.length > 200) {
    console.log("Text too short or too long for caching");
    return null;
  }

  const occurrences = {
    highlightElements: [], // Store highlight elements that contain the text
    textNodeOccurrences: [], // Store text nodes and positions
  };

  // First check already highlighted elements
  const highlightElements = document.querySelectorAll(".highlighter-mark");
  for (const el of highlightElements) {
    if (el.textContent === text) {
      occurrences.highlightElements.push(el);
    }
  }

  // Then check all text nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function (node) {
        if (
          node.parentNode.classList &&
          node.parentNode.classList.contains("highlighter-mark")
        ) {
          return NodeFilter.FILTER_ACCEPT; // Accept already highlighted nodes too
        }
        if (node.textContent.trim().length === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
    false
  );

  let node;
  while ((node = walker.nextNode())) {
    const textContent = node.textContent;
    let pos = -1;

    while ((pos = textContent.indexOf(text, pos + 1)) !== -1) {
      occurrences.textNodeOccurrences.push({
        node: node,
        position: pos,
      });
    }
  }

  // Cache the results
  textOccurrenceCache.set(text, occurrences);
  console.log(
    `Cached ${
      occurrences.highlightElements.length +
      occurrences.textNodeOccurrences.length
    } occurrences for text: ${text}`
  );

  return occurrences;
}

// Function to find and scroll to a specific occurrence of text
function scrollToTextOccurrence(text, occurrenceIndex) {
  console.log(
    `Attempting to scroll to occurrence ${occurrenceIndex} of text: ${text}`
  );

  // Try to get occurrences from cache first
  let occurrences = textOccurrenceCache.get(text);

  // If not in cache or cache is invalid, find and cache them
  if (!occurrences) {
    occurrences = findAndCacheTextOccurrences(text);

    // If caching failed or was skipped (text too short/long), fall back to original behavior
    if (!occurrences) {
      return scrollToTextOccurrenceOriginal(text, occurrenceIndex);
    }
  }

  // Calculate total number of occurrences
  const totalOccurrences =
    occurrences.highlightElements.length +
    occurrences.textNodeOccurrences.length;

  // Check if the requested occurrence exists
  if (occurrenceIndex > totalOccurrences) {
    console.log(
      `Occurrence ${occurrenceIndex} not found. Only ${totalOccurrences} occurrences exist.`
    );
    return false;
  }

  // If the occurrence is in the highlight elements
  if (occurrenceIndex <= occurrences.highlightElements.length) {
    const element = occurrences.highlightElements[occurrenceIndex - 1];
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    highlightElement(element);
    return true;
  }

  // Otherwise, it's in the text nodes
  const textNodeIndex =
    occurrenceIndex - occurrences.highlightElements.length - 1;
  const occurrence = occurrences.textNodeOccurrences[textNodeIndex];

  // Check if the node still exists in the DOM
  if (!document.contains(occurrence.node)) {
    console.log("Cached node no longer in DOM, invalidating cache");
    invalidateTextOccurrenceCache();
    return scrollToTextOccurrence(text, occurrenceIndex); // Try again with fresh cache
  }

  // Create temporary highlight
  try {
    const node = occurrence.node;
    const pos = occurrence.position;

    const range = document.createRange();
    range.setStart(node, pos);
    range.setEnd(node, pos + text.length);

    // Create temporary visual cue
    const tempHighlight = document.createElement("span");
    tempHighlight.className = "highlighter-mark temp-highlight";
    tempHighlight.style.backgroundColor = "#ffff00";
    tempHighlight.style.transition = "background-color 2s";

    range.surroundContents(tempHighlight);
    tempHighlight.scrollIntoView({ behavior: "smooth", block: "center" });
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
    console.error("Error creating temporary highlight:", e);
    return false;
  }

  return true;
}

// Original implementation as fallback for edge cases
function scrollToTextOccurrenceOriginal(text, occurrenceIndex) {
  // Find all text nodes in the document
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function (node) {
        if (
          node.parentNode.classList &&
          node.parentNode.classList.contains("highlighter-mark")
        ) {
          return NodeFilter.FILTER_ACCEPT; // Accept already highlighted nodes too
        }
        if (node.textContent.trim().length === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
    false
  );

  let currentOccurrence = 0;
  let node;
  let foundElement = null;

  // First check already highlighted elements
  const highlightElements = document.querySelectorAll(".highlighter-mark");
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
    foundElement.scrollIntoView({ behavior: "smooth", block: "center" });
    highlightElement(foundElement);
    return true;
  }

  // Reset counter and check all text nodes
  currentOccurrence = 0;
  while ((node = walker.nextNode())) {
    const textContent = node.textContent;
    let pos = -1;

    while ((pos = textContent.indexOf(text, pos + 1)) !== -1) {
      currentOccurrence++;

      if (currentOccurrence === occurrenceIndex) {
        // We found the correct occurrence
        if (
          node.parentNode.classList &&
          node.parentNode.classList.contains("highlighter-mark")
        ) {
          // This is already a highlight element
          node.parentNode.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          highlightElement(node.parentNode);
        } else {
          // This is a text node, we need to create temporary highlight
          try {
            const range = document.createRange();
            range.setStart(node, pos);
            range.setEnd(node, pos + text.length);

            // Create temporary visual cue
            const tempHighlight = document.createElement("span");
            tempHighlight.className = "highlighter-mark temp-highlight";
            // Use the saved color if available, or default to yellow
            if (highlight && highlight.colorKey) {
              tempHighlight.dataset.color = highlight.colorKey;
            }
            tempHighlight.style.backgroundColor =
              (highlight && highlight.colorValue) || "#ffff00";
            tempHighlight.style.transition = "background-color 2s";

            range.surroundContents(tempHighlight);
            tempHighlight.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
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
            console.error("Error creating temporary highlight:", e);
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
  const colorKey = element.dataset.color || "yellow";

  // Define the animation
  element.style.animation = `pulse-highlight-${colorKey} 2s ease-in-out 3`;

  // Create the keyframes for this color's animation if they don't exist yet
  if (!document.querySelector(`#highlight-keyframes-${colorKey}`)) {
    const style = document.createElement("style");
    style.id = `highlight-keyframes-${colorKey}`;

    // Generate appropriate contrast color for the animation
    let pulseColor;
    switch (colorKey) {
      case "yellow":
        pulseColor = "orange";
        break;
      case "green":
        pulseColor = "#97d097"; // Darker green
        break;
      case "blue":
        pulseColor = "#99c2ff"; // Darker blue
        break;
      case "pink":
        pulseColor = "#ff9999"; // Darker pink
        break;
      case "purple":
        pulseColor = "#cc99ff"; // Darker purple
        break;
      default:
        pulseColor = "orange";
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
    element.style.animation = "";
    element.style.backgroundColor = originalColor;
  }, 6000);
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "scrollToHighlight") {
    scrollToHighlight(
      message.highlightId,
      message.highlightText,
      message.occurrenceIndex
    );
    sendResponse({ success: true });
    return true;
  }
});

// Track if we're in the middle of a mouse selection
let isSelecting = false;

// Mouse down event to track start of selection
document.addEventListener("mousedown", function (e) {
  // Don't interfere with clicks on the palette itself
  if (
    e.target.closest(".highlighter-color-palette") ||
    e.target.classList.contains("highlighter-color-circle")
  ) {
    return;
  }

  isSelecting = true;
  hideColorPalette();
});

// Mouse up event to detect end of selection
document.addEventListener("mouseup", function (e) {
  // Don't interfere with clicks on the palette itself
  if (
    e.target.closest(".highlighter-color-palette") ||
    e.target.classList.contains("highlighter-color-circle")
  ) {
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
document.addEventListener("selectionchange", function () {
  // Only process this event if we're not in the middle of a mouse selection
  if (!isSelecting) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Get current palette
    const palette = document.getElementById("highlighter-color-palette");

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
document.addEventListener("click", function (e) {
  // Skip this during text selection
  if (isSelecting) return;

  // Check if click is outside of the palette and not on a color circle
  if (
    !e.target.closest(".highlighter-color-palette") &&
    !e.target.classList.contains("highlighter-color-circle")
  ) {
    hideColorPalette();
  }
});

// Function to initialize notes feature if available
function initializeNotesFeature() {
  if (typeof initializeNotes === "function") {
    console.log("Initializing notes feature");
    initializeNotes();
  } else {
    console.log("Notes feature not found, waiting...");
    // Try again after a short delay in case the script loads later
    setTimeout(() => {
      if (typeof initializeNotes === "function") {
        console.log("Initializing notes feature (delayed)");
        initializeNotes();
      }
    }, 500);
  }
}

// Initialize notes feature when page is loaded
document.addEventListener("DOMContentLoaded", initializeNotesFeature);

// Also try after full page load
window.addEventListener("load", initializeNotesFeature);
