#!/bin/bash

# Deploy documentation to GitHub Pages
cd "$(dirname "$0")"

echo "Building documentation site..."
yarn build

# Check if out directory exists
if [ ! -d "out" ]; then
    echo "Error: out directory not found after build"
    exit 1
fi

echo "Deploying to GitHub Pages..."
# Using gh-pages npm package  
yarn deploy

echo "Documentation deployed successfully!"
echo "Visit: https://20m61.github.io/v1z3r/"