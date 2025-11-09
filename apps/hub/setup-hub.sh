#!/bin/bash

# Copy config files from dashboard
cp ../dashboard/next.config.js .
cp ../dashboard/tailwind.config.ts .
cp ../dashboard/postcss.config.js .
cp ../dashboard/tsconfig.json .
cp ../dashboard/.gitignore .

# Copy shared utilities
cp -r ../dashboard/lib/* ./lib/ 2>/dev/null || true
cp -r ../dashboard/contexts/* ./contexts/ 2>/dev/null || true

echo "Configuration files copied successfully"
