#!/bin/sh

# This script will run `makejson.ts`
# Caddy will be configured to run this automatically whenever the site updates

# For the sake of OS-agnosticity, this script assumes node and npm are already present on the system.

node_path=$(which node)
npm_path=$(which npm)

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

    node_path=$(n which latest)
    node_dir=$(echo "$node_path" | sed 's/\/node$//')
    npm_path="${node_dir}/npm"

    # make sure the new executable is present in PATH
    echo "Checking updated node version: "
    ${node_path} --version

    # update npm
    ${npm_path} install -g npm@latest
fi

# Check if TypeScript is installed
if ! command -v tsc >/dev/null 2>&1; then
    echo "TypeScript is not installed. Installing TypeScript..."
    ${npm_path} install -g typescript
fi

# Check if `npm install .` needs to be run
if [ ! -d "node_modules" ]; then
    echo "Dependencies not installed. Running 'npm install .'"
    ${npm_path} install .
fi

echo "TypeScript and project dependencies are installed."

tsc makejson.ts && eval "${node_path} makejson.js"