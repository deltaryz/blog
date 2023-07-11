#!/bin/sh

# This script will run `makejson.ts`
# Caddy will be configured to run this automatically whenever the site updates

# For the sake of OS-agnosticity, this script assumes node and npm are already present on the system.

# Check if TypeScript is installed
if ! command -v tsc >/dev/null 2>&1; then
    echo "TypeScript is not installed. Installing TypeScript..."
    npm install -g typescript
fi

# Check if `npm install .` needs to be run
if [ ! -d "node_modules" ]; then
    echo "Dependencies not installed. Running 'npm install .'"
    npm install .
fi

echo "TypeScript and project dependencies are installed."

# Generate the posts.json
tsc makejson.ts && node makejson.js

# This makes sure caddy will still be able to git pull over it
echo "Forcibly resetting repo in case npm fucks something up"
git reset --hard HEAD