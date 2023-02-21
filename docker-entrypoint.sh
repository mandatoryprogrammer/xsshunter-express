#!/usr/bin/env bash

if [[ "${SSL_ENABLED}" == "true" ]]; then
  echo "Initializing SSL/TLS..."
  # Set up Greenlock
  # Test if --maintainer-email is required, we can set it via environment variables...
  npx greenlock init --config-dir /app/greenlock.d --maintainer-email $SSL_CONTACT_EMAIL
  npx greenlock add --subject $HOSTNAME --altnames "$HOSTNAME"
fi

echo "Starting server..."
node server.js