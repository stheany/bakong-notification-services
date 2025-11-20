import { DataSource } from 'typeorm'
import { randomUUID } from 'crypto'
import datasource from '../src/ormconfig'

/**
 * Migration script to fix NULL fileId values in the image table
 * This script populates NULL fileId values with UUIDs before TypeORM synchronize runs
 *
 * Usage:
 *   npm run fix-null-fileid
 *   or
 *   ts-node -r tsconfig-paths/register scripts/fix-null-fileid.ts
 */
async function fixNullFileIds() {
  console.log('🔄 Starting migration to fix NULL fileId values...\n')

  let dataSource: DataSource | null = null

  try {
    // Initialize DataSource
    dataSource = datasource
    if (!dataSource.isInitialized) {
      await dataSource.initialize()
      console.log('✅ Database connection established\n')
    }

    // Check for rows with NULL fileId
    const nullCountResult = await dataSource.query(
      `SELECT COUNT(*) as count FROM image WHERE "fileId" IS NULL`,
    )
    const nullCount = parseInt(nullCountResult[0].count, 10)

    if (nullCount === 0) {
      console.log('✅ No rows with NULL fileId found. Migration not needed.\n')
      return
    }

    console.log(`📊 Found ${nullCount} row(s) with NULL fileId\n`)
    console.log('🔄 Generating UUIDs and updating rows...\n')

    // Get all rows with NULL fileId
    const nullRows = await dataSource.query(`SELECT id FROM image WHERE "fileId" IS NULL`)

    let updatedCount = 0
    let errorCount = 0

    // Update each row with a unique UUID
    for (const row of nullRows) {
      try {
        const newFileId = randomUUID()

        // Check if this UUID already exists (very unlikely, but safe)
        const existingCheck = await dataSource.query(`SELECT id FROM image WHERE "fileId" = $1`, [
          newFileId,
        ])

        if (existingCheck.length > 0) {
          // If UUID collision (extremely rare), generate a new one
          const retryFileId = randomUUID()
          await dataSource.query(`UPDATE image SET "fileId" = $1 WHERE id = $2`, [
            retryFileId,
            row.id,
          ])
          console.log(`  ✓ Updated row id=${row.id} with fileId=${retryFileId}`)
        } else {
          await dataSource.query(`UPDATE image SET "fileId" = $1 WHERE id = $2`, [
            newFileId,
            row.id,
          ])
          console.log(`  ✓ Updated row id=${row.id} with fileId=${newFileId}`)
        }
        updatedCount++
      } catch (error) {
        console.error(`  ✗ Error updating row id=${row.id}:`, error.message)
        errorCount++
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 Migration Summary:')
    console.log(`   Total rows with NULL fileId: ${nullCount}`)
    console.log(`   Successfully updated: ${updatedCount}`)
    if (errorCount > 0) {
      console.log(`   Errors: ${errorCount}`)
    }
    console.log('='.repeat(50) + '\n')

    // Verify all NULL values are fixed
    const remainingNulls = await dataSource.query(
      `SELECT COUNT(*) as count FROM image WHERE "fileId" IS NULL`,
    )
    const remainingCount = parseInt(remainingNulls[0].count, 10)

    if (remainingCount === 0) {
      console.log('✅ All NULL fileId values have been fixed!')
      console.log('✅ Database is ready for TypeORM synchronize\n')
    } else {
      console.error(`❌ Warning: ${remainingCount} row(s) still have NULL fileId`)
      console.error('   Please review and fix manually\n')
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Migration failed:', error)
    if (error instanceof Error) {
      console.error('   Error message:', error.message)
      console.error('   Stack:', error.stack)
    }
    process.exit(1)
  } finally {
    // Close database connection
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy()
      console.log('🔌 Database connection closed\n')
    }
  }
}

// Run the migration
fixNullFileIds()
  .then(() => {
    console.log('✅ Migration completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  })
