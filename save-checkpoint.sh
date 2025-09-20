#!/bin/bash
# Comprehensive checkpoint and backup script
set -e

echo "💾 Saving checkpoint and backup..."

# Add all changes
echo "📄 Adding files..."
git add -A

# Get description from command line or use default
DESCRIPTION=${1:-"checkpoint"}

# Commit with timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
COMMIT_MESSAGE="CHECKPOINT: $DESCRIPTION - $TIMESTAMP"

echo "💬 Committing changes..."
if git commit -m "$COMMIT_MESSAGE" --no-verify; then
    echo "✅ Changes committed"
    
    # Create tag
    TAG_NAME="checkpoint-$TIMESTAMP"
    git tag "$TAG_NAME"
    echo "🏷️  Tag created: $TAG_NAME"
    
    # Push to GitHub
    echo "🚀 Pushing to GitHub..."
    if git push origin main; then
        echo "✅ Main branch pushed to GitHub"
    else
        echo "❌ Failed to push main branch"
    fi
    
    # Push tags
    if git push origin --tags; then
        echo "✅ Tags pushed to GitHub"
    else
        echo "❌ Failed to push tags"
    fi
    
    echo ""
    echo "🎉 Checkpoint complete!"
    echo "📝 Commit: $(git rev-parse HEAD)"
    echo "🏷️  Tag: $TAG_NAME"
    echo "🌐 GitHub: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^/]*\/[^.]*\).*/\1/')"
else
    echo "ℹ️  No changes to commit"
fi
echo "💡 To rollback: git reset --hard checkpoint-$TIMESTAMP"