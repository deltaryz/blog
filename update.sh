#!/bin/sh

# In a development environment, use `npm run-script build` instead

# This script is for my Caddy webserver
# Caddy will be configured to run this automatically whenever the site updates

# For the sake of OS-agnosticity, this script assumes node and npm are already present on the system.

# Make sure all dependencies are present
npm install .

echo "Project dependencies are installed."

# Generate website assets
NODE_OPTIONS=--no-deprecation npm run-script build

# This makes sure caddy will still be able to git pull over it
echo "Forcibly resetting repo in case npm fucks something up"
git reset --hard HEAD