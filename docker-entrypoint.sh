#!/usr/bin/env bash

echo "Starting server..."
if [ "$NODE_ENV" = "development" ]; then
    node server.js
else
    pm2-runtime server.js
fi
