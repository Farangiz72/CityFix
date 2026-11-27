#!/bin/sh
# Применяет схему, сеет данные и запускает API.
# Applies the schema, seeds the data and starts the API.
set -e

# SQLite: убеждаемся, что каталог для файла БД существует (volume).
# Make sure the directory of the SQLite file exists (named volume).
case "${DATABASE_URL:-}" in
  file:*)
    mkdir -p "$(dirname "${DATABASE_URL#file:}")"
    ;;
esac

echo "[cityfix] применяем схему БД / applying database schema"
npx prisma db push --skip-generate

if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "[cityfix] начальные данные / seeding"
  npx tsx prisma/seed.ts
fi

echo "[cityfix] запуск API / starting API"
exec node dist/server.js
