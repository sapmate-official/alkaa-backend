#!/usr/bin/env node

/**
 * Script runner for multi-department migration
 * Usage: npm run migrate-multi-dept [migrate|rollback|status]
 */

import { migrateToMultiDepartment, rollbackMigration, checkMigrationStatus } from './src/seed/migrateToMultiDepartment.js';

const command = process.argv[2] || 'status';

async function main() {
    console.log(`🚀 Multi-Department Migration Tool`);
    console.log(`Command: ${command}`);
    console.log('─'.repeat(50));
    
    try {
        switch (command) {
            case 'migrate':
                console.log('🔄 Starting migration to multi-department structure...');
                const result = await migrateToMultiDepartment();
                console.log('✅ Migration completed successfully!');
                console.log('📊 Results:', result);
                break;
                
            case 'rollback':
                console.log('🔄 Rolling back multi-department migration...');
                const rollbackResult = await rollbackMigration();
                console.log('✅ Rollback completed!');
                console.log('📊 Results:', rollbackResult);
                break;
                
            case 'status':
                console.log('📊 Checking migration status...');
                const status = await checkMigrationStatus();
                if (status.migrationNeeded) {
                    console.log('⚠️  Migration needed - run: npm run migrate-multi-dept migrate');
                } else {
                    console.log('✅ Migration appears to be complete');
                }
                break;
                
            default:
                console.log('❌ Unknown command. Available commands:');
                console.log('   - migrate: Run the migration');
                console.log('   - rollback: Rollback the migration');
                console.log('   - status: Check migration status');
                process.exit(1);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
