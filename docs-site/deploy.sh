#!/bin/bash

# Deploy documentation to GitHub Pages
cd "$(dirname "$0")"

echo "Building documentation site..."
yarn build

echo "Deploying to GitHub Pages..."
# Using gh-pages npm package
yarn deploy

echo "Documentation deployed successfully!"
echo "Visit: https://20m61.github.io/v1z3r/"