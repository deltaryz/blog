#!/bin/sh

# This script will run `makejson.ts`
# Caddy will be configured to run this automatically whenever the site updates

# For the sake of OS-agnosticity, this script assumes node and npm are already present on the system.

# Check if n is installed
if ! command -v n >/dev/null 2>&1; then
    echo "n is not installed. Installing n..."
    npm install -g n
fi

# Check if the latest Node.js version is installed
latest_version=$(n --latest)
if [ "$(node --version)" != "$latest_version" ]; then
    # Install the latest Node.js version
    echo "There is a node.js update ($latest_version) available. Updating node and npm..."
    n latest

    # make sure the new executable is present in PATH
    export PATH=/usr/local/bin:$PATH
    echo "Checking updated node version: $(node --version)"

    npm install -g npm@latest
fi

# Check if TypeScript is installed
if ! command -v tsc >/dev/null 2>&1; then
    echo "TypeScript is not installed. Installing TypeScript..."
    npm install -g typescript
fi

# Check if ts-node is installed
if ! command -v ts-node >/dev/null 2>&1; then
    echo "ts-node is not installed. Installing ts-node..."
    npm install -g ts-node
fi

# Check if `npm install .` needs to be run
if [ ! -d "node_modules" ]; then
    echo "Dependencies not installed. Running 'npm install .'"
    npm install .
fi

echo "TypeScript, ts-node, and project dependencies are installed."

ts-node makejson.ts
