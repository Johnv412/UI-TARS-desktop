#!/bin/bash
# Simple checkpoint save script
set -e

echo "💾 Saving checkpoint..."

# Add all changes
git add -A

# Get description from command line or use default
DESCRIPTION=${1:-"checkpoint"}

# Commit with timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
git commit -m "CHECKPOINT: $DESCRIPTION - $TIMESTAMP" --no-verify || echo "No changes to commit"

# Create tag
git tag "checkpoint-$TIMESTAMP"

echo "✅ Checkpoint saved as: checkpoint-$TIMESTAMP"
echo "💡 To rollback: git reset --hard checkpoint-$TIMESTAMP"