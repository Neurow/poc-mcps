#!/bin/bash
set -e

# Chaque domaine métier a sa propre base de données au sein de la même
# instance Postgres, pour simuler des systèmes indépendants qui ne
# partagent pas de tables entre eux (seule l'infra Postgres est mutualisée).
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE DATABASE ticket;
	CREATE DATABASE planning;
	CREATE DATABASE report;
EOSQL
