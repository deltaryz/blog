#!/bin/sh

# In a development environment, use `deno task build` or `npm run-script build` instead

# This script is for my Caddy webserver
# Caddy will be configured to run this automatically whenever the site updates

# Generate website assets
deno task build

# This makes sure caddy will still be able to git pull over it
echo "Forcibly resetting repo in case npm fucks something up"
git reset --hard HEAD