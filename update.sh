#!/bin/sh

# In a development environment, use `npm run-script makeJson` instead

# This script is for my Caddy webserver
# Caddy will be configured to run this automatically whenever the site updates

# For the sake of OS-agnosticity, this script assumes node and npm are already present on the system.

# Make sure all dependencies are present
npm install .

echo "TypeScript and project dependencies are installed."

# Generate the posts.json
npm run-script makeJson

# This makes sure caddy will still be able to git pull over it
echo "Forcibly resetting repo in case npm fucks something up"
git reset --hard HEAD