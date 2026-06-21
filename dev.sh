#!/bin/bash
cd "$(dirname "$0")"
set -a; source .env.local; set +a
exec vercel dev --yes --listen 3000
