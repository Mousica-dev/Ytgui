#!/bin/bash

# Print start message
echo "🧹 Cleaning YTgui project..."

# Remove build artifacts
if [ -d "dist" ]; then
    echo "Removing dist folder..."
    rm -rf dist/
fi

# Remove OS-specific temporary files
echo "Removing system temporary files..."
find . -name ".DS_Store" -delete  # macOS
find . -name "Thumbs.db" -delete  # Windows
find . -name "*~" -delete        # Linux
find . -name "*.tmp" -delete     # General temp files
find . -name "*.temp" -delete    # General temp files
find . -name "*.part" -delete    # Partial downloads

# Check if yt-dlp binary exists
if [ ! -f "bin/yt-dlp" ] && [ ! -f "bin/yt-dlp.exe" ]; then
    echo "⚠️  yt-dlp binary missing, reinstalling..."
    npm run postinstall
else
    echo "✅ yt-dlp binary present"
fi

echo "✨ Cleanup complete!" 