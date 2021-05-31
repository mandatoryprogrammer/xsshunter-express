#!/bin/bash
set -e

echo "Setting up the database..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER xsshunterexpress;
    ALTER USER xsshunterexpress WITH PASSWORD 'xsshunterexpress';
    CREATE DATABASE xsshunterexpress;
    GRANT ALL PRIVILEGES ON DATABASE xsshunterexpress TO xsshunterexpress;
EOSQL