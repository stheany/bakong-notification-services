# Database Migration Scripts

## Fix NULL fileId Migration

This directory contains scripts to fix NULL `fileId` values in the `image` table before TypeORM synchronize runs.

### Problem

When TypeORM synchronize tries to change the `fileId` column to `NOT NULL`, it fails if there are existing rows with NULL values:
```
error: column "fileId" of relation "image" contains null values
```

### Solution

These scripts populate all NULL `fileId` values with UUIDs before TypeORM synchronize runs.

## Usage

### Option 1: Run SQL Script Directly (Recommended for Server)

```bash
# On the server, run the migration script
bash apps/backend/scripts/run-migration.sh staging

# Or manually with psql
psql -U <username> -d <database> -f apps/backend/scripts/fix-null-fileid.sql

# Or via Docker
docker exec -i <container-name> psql -U <username> -d <database> < apps/backend/scripts/fix-null-fileid.sql
```

### Option 2: Run TypeScript Script (Development)

```bash
# From the backend directory
npm run fix-null-fileid

# Or directly
ts-node -r tsconfig-paths/register scripts/fix-null-fileid.ts
```

### Option 3: Integrate into Deployment

Add to your deployment script (`deploy-on-server.sh`):

```bash
# After pulling code, before starting containers
echo "🔄 Running database migration..."
cd apps/backend
bash scripts/run-migration.sh staging
cd ../..
```

## Files

- `fix-null-fileid.sql` - SQL script that can be run directly on the database
- `fix-null-fileid.ts` - TypeScript script using TypeORM DataSource
- `run-migration.sh` - Shell script wrapper for easy execution on server

## What It Does

1. Checks for rows with NULL `fileId` values
2. Generates unique UUIDs for each NULL value
3. Updates the rows in the database
4. Verifies all NULL values are fixed

## After Migration

Once the migration is complete, TypeORM synchronize should work without errors. The application can then start normally.

## Troubleshooting

### Error: "psql: command not found"
- Install PostgreSQL client tools, or
- Use Docker: `docker exec -i <container> psql ...`

### Error: "permission denied"
- Ensure the database user has UPDATE permissions on the `image` table
- Check that the user can connect to the database

### Still getting NULL errors after migration
- Verify the migration ran successfully: `SELECT COUNT(*) FROM image WHERE "fileId" IS NULL;`
- Check that TypeORM synchronize is enabled: `TYPEORM_SYNCHRONIZE=true`
- Review application logs for other errors

