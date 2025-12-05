# Database Scripts

This directory contains scripts for database operations including migrations, backups, and schema exports.

## Schema Export for draw.io

Export your database schema to track changes visually in draw.io.

### Quick Start

**PowerShell (Windows):**
```powershell
# Export development database schema
.\export-schema.ps1 dev sql

# Export SIT/staging database schema
.\export-schema.ps1 sit sql

# Export production database schema
.\export-schema.ps1 prod sql
```

**Bash/Shell (Linux/Mac):**
```bash
# Make script executable
chmod +x export-schema.sh

# Export development database schema
./export-schema.sh dev sql

# Export SIT/staging database schema
./export-schema.sh sit sql

# Export production database schema
./export-schema.sh prod sql
```

### Prerequisites

1. **Docker containers must be running:**
   ```powershell
   # For development
   docker compose up -d
   
   # For SIT
   docker compose -f docker-compose.sit.yml up -d
   
   # For production
   docker compose -f docker-compose.production.yml up -d
   ```

2. **Database container must be healthy:**
   ```powershell
   docker compose ps db
   ```

### Output

Exported schemas are saved to: `schema-exports/` directory (at project root)

Files are named: `schema_{environment}_{timestamp}.sql`

Example: `schema_dev_20250115_143022.sql`

### Using in draw.io

**⚠️ Important:** draw.io does NOT directly import PostgreSQL SQL dumps. Use one of these methods:

1. **Method 1: Via dbdiagram.io (Recommended)**
   - Go to [dbdiagram.io](https://dbdiagram.io)
   - Click "Import" → "PostgreSQL"
   - Upload or paste your exported `.sql` file
   - dbdiagram.io will automatically generate a visual ER diagram
   - Export options:
     - **PNG/PDF**: For documentation
     - **Draw.io XML**: Import into draw.io for further editing
     - **DBML**: For version control

2. **Method 2: Manual Creation in draw.io**
   - Open [draw.io](https://app.diagrams.net)
   - Use the SQL file as reference
   - Manually create:
     - Table shapes for each table
     - Columns with data types
     - Foreign key relationships
   - The SQL file contains all the information you need

3. **Method 3: Use Database Tools**
   - Tools like **pgAdmin**, **DBeaver**, or **DataGrip** can generate ER diagrams
   - Export the diagram as an image or import into draw.io

### Tracking Changes

To track database changes over time:

1. **Export schema regularly:**
   ```powershell
   # Before making changes
   .\export-schema.ps1 dev sql
   
   # After making changes
   .\export-schema.ps1 dev sql
   ```

2. **Compare versions:**
   - Use Git to track `schema-exports/` directory (if committed)
   - Or use diff tools to compare SQL files
   - Visualize differences in draw.io by importing both versions

3. **Document changes:**
   - Create a changelog in `MIGRATION_GUIDE.md`
   - Reference schema export timestamps
   - Keep draw.io diagrams updated

### Supported Formats

- **SQL** (default): Standard PostgreSQL schema dump
  - Can be imported into dbdiagram.io for visualization
  - Human-readable
  - Can be used to recreate database structure
  - Contains all tables, columns, constraints, and relationships

- **DBML** (experimental): Database Markup Language
  - Better for programmatic processing
  - Can be converted to various formats
  - Requires additional tools for full support

### Troubleshooting

**Error: Container not found**
- Ensure Docker containers are running
- Check container name matches your environment
- Verify docker-compose file is correct

**Error: Permission denied**
- On Linux/Mac: `chmod +x export-schema.sh`
- On Windows: Run PowerShell as Administrator if needed

**Error: Database connection failed**
- Check database container is healthy: `docker compose ps db`
- Verify database credentials in script match docker-compose.yml
- Wait a few seconds after starting containers

**Empty or incomplete export**
- Ensure database has been initialized
- Check if tables exist: `docker compose exec db psql -U bkns_dev -d bakong_notification_services_dev -c "\dt"`

### Related Scripts

- `migrate-category-type-complete.sql` - Database migration script
- `MIGRATION_GUIDE.md` - Migration documentation

### Best Practices

1. **Export before major changes:**
   - Before running migrations
   - Before deploying to new environment
   - Before refactoring database structure

2. **Version control:**
   - Consider committing schema exports (if not too large)
   - Or keep them in a separate repository
   - Tag exports with Git tags for releases

3. **Regular exports:**
   - Export after each migration
   - Export weekly/monthly for documentation
   - Export before and after major releases

4. **Documentation:**
   - Update draw.io diagrams when schema changes
   - Keep migration guide synchronized
   - Document breaking changes in schema

---

**Note**: Schema exports contain only structure (tables, columns, constraints), not data. This is safe to commit and share.

