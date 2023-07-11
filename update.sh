#!/bin/sh

# This script will run `makejson.ts`
# Caddy will be configured to run this automatically whenever the site updates

# For the sake of OS-agnosticity, this script assumes node and npm are already present on the system.

echo "Checking for node and npm..."
which node
which npm

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

tsc makejson.ts && node makejson.js