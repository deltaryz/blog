#!/bin/bash

# This script will run `makejson.ts` 
# Caddy will be configured to run this automatically whenever the site updates

# Check if TypeScript is installed
if ! command -v tsc &> /dev/null; then
    echo "TypeScript is not installed. Installing TypeScript..."
    npm install -g typescript
fi

# Check if ts-node is installed
if ! command -v ts-node &> /dev/null; then
    echo "ts-node is not installed. Installing ts-node..."
    npm install -g ts-node
fi

echo "TypeScript and ts-node are installed."

ts-node makejson.ts