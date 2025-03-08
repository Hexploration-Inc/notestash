#!/bin/bash
# This script removes the duplicate cache code from content.js

# First create a backup
cp content.js content.js.bak

# Remove the duplicate section
awk '{
  if (NR >= 664 && NR <= 690) {
    # Skip lines in the duplicate section
    next;
  }
  print $0;
}' content.js.bak > content.js

echo "Fixed duplicate declarations in content.js"
