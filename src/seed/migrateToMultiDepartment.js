import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Migration Script: Single Department to Multi-Department Structure
 * 
 * This script migrates existing single department assignments to the new
 * multi-department UserDepartment junction table structure.
 * 
 * What it does:
 * 1. Creates backup of current department assignments
 * 2. Migrates existing User.departmentId to UserDepartment table
 * 3. Sets all existing assignments as primary departments
 * 4. Verifies data integrity
 * 5. Provides rollback capability
 */

export async function migrateToMultiDepartment() {
    console.log('🚀 Starting migration from single to multi-department structure...');
    
    try {
        // Step 1: Create backup of current department assignments
        console.log('📋 Step 1: Creating backup of current department assignments...');
        const backup = await createBackup();
        console.log(`✅ Backup created with ${backup.length} user-department assignments`);
        
        // Step 2: Migrate existing department assignments
        console.log('🔄 Step 2: Migrating existing department assignments...');
        const migrationResults = await migrateExistingAssignments();
        console.log(`✅ Migration completed: ${migrationResults.migrated} assignments migrated, ${migrationResults.skipped} skipped`);
        
        // Step 3: Verify data integrity
        console.log('🔍 Step 3: Verifying data integrity...');
        const verification = await verifyMigration();
        console.log(`✅ Verification completed: ${verification.verified} assignments verified`);
        
        if (verification.errors.length > 0) {
            console.error('❌ Verification errors found:', verification.errors);
            throw new Error('Migration verification failed');
        }
        
        console.log('🎉 Migration completed successfully!');
        return {
            success: true,
            backup,
            migrationResults,
            verification
        };
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        console.log('🔄 Run rollback if needed: await rollbackMigration()');
        throw error;
    }
}

async function createBackup() {
    const usersWithDepartments = await prisma.user.findMany({
        where: {
            departmentId: {
                not: null
            }
        },
        select: {
            id: true,
            orgId: true,
            departmentId: true,
            firstName: true,
            lastName: true,
            email: true,
            createdAt: true,
            department: {
                select: {
                    id: true,
                    name: true,
                    orgId: true
                }
            }
        }
    });
    
    // Store backup in a temporary table or file
    const backupData = {
        timestamp: new Date(),
        count: usersWithDepartments.length,
        assignments: usersWithDepartments.map(user => ({
            userId: user.id,
            departmentId: user.departmentId,
            userEmail: user.email,
            userName: `${user.firstName} ${user.lastName}`,
            departmentName: user.department?.name,
            orgId: user.orgId,
            originalCreatedAt: user.createdAt
        }))
    };
    
    // You can also save this to a file if needed
    console.log('💾 Backup data prepared for', backupData.count, 'users');
    
    return backupData.assignments;
}

async function migrateExistingAssignments() {
    let migrated = 0;
    let skipped = 0;
    
    // Get all users with department assignments
    const usersWithDepartments = await prisma.user.findMany({
        where: {
            departmentId: {
                not: null
            }
        },
        select: {
            id: true,
            orgId: true,
            departmentId: true,
            createdAt: true
        }
    });
    
    console.log(`Found ${usersWithDepartments.length} users with department assignments to migrate`);
    
    for (const user of usersWithDepartments) {
        try {
            // Check if UserDepartment record already exists
            const existingAssignment = await prisma.userDepartment.findUnique({
                where: {
                    userId_departmentId: {
                        userId: user.id,
                        departmentId: user.departmentId
                    }
                }
            });
            
            if (existingAssignment) {
                console.log(`⚠️  UserDepartment assignment already exists for user ${user.id}, skipping...`);
                skipped++;
                continue;
            }
            
            // Create new UserDepartment record
            await prisma.userDepartment.create({
                data: {
                    userId: user.id,
                    departmentId: user.departmentId,
                    isPrimary: true, // Mark existing department as primary
                    assignedAt: user.createdAt, // Use user's creation date as assignment date
                    assignedBy: null, // System migration, no specific assigner
                    role: null // No specific role initially
                }
            });
            
            migrated++;
            
            if (migrated % 50 === 0) {
                console.log(`📈 Progress: ${migrated} assignments migrated...`);
            }
            
        } catch (error) {
            console.error(`❌ Failed to migrate assignment for user ${user.id}:`, error);
            throw error;
        }
    }
    
    return { migrated, skipped };
}

async function verifyMigration() {
    let verified = 0;
    const errors = [];
    
    // Get all users with department assignments
    const usersWithDepartments = await prisma.user.findMany({
        where: {
            departmentId: {
                not: null
            }
        },
        include: {
            userDepartments: true
        }
    });
    
    for (const user of usersWithDepartments) {
        // Check if UserDepartment record exists
        const userDeptAssignment = user.userDepartments.find(
            ud => ud.departmentId === user.departmentId
        );
        
        if (!userDeptAssignment) {
            errors.push(`User ${user.id} missing UserDepartment record for department ${user.departmentId}`);
            continue;
        }
        
        // Check if it's marked as primary
        if (!userDeptAssignment.isPrimary) {
            errors.push(`User ${user.id} UserDepartment record not marked as primary`);
            continue;
        }
        
        verified++;
    }
    
    // Check for orphaned UserDepartment records
    const allUserDepartments = await prisma.userDepartment.findMany({
        include: {
            user: true,
            department: true
        }
    });
    
    for (const userDept of allUserDepartments) {
        if (!userDept.user) {
            errors.push(`UserDepartment ${userDept.id} references non-existent user ${userDept.userId}`);
        }
        if (!userDept.department) {
            errors.push(`UserDepartment ${userDept.id} references non-existent department ${userDept.departmentId}`);
        }
    }
    
    return { verified, errors };
}

/**
 * Rollback function to undo the migration if needed
 */
export async function rollbackMigration() {
    console.log('🔄 Starting rollback of multi-department migration...');
    
    try {
        // Delete all UserDepartment records created during migration
        const deletedCount = await prisma.userDepartment.deleteMany({
            where: {
                assignedBy: null // Only delete system-created assignments
            }
        });
        
        console.log(`✅ Rollback completed: ${deletedCount.count} UserDepartment records removed`);
        console.log('⚠️  Note: Original User.departmentId fields remain intact');
        
        return {
            success: true,
            deletedRecords: deletedCount.count
        };
        
    } catch (error) {
        console.error('❌ Rollback failed:', error);
        throw error;
    }
}

/**
 * Status check function to see current migration state
 */
export async function checkMigrationStatus() {
    const usersWithDept = await prisma.user.count({
        where: {
            departmentId: { not: null }
        }
    });
    
    const userDeptRecords = await prisma.userDepartment.count();
    const primaryAssignments = await prisma.userDepartment.count({
        where: { isPrimary: true }
    });
    
    console.log('📊 Migration Status:');
    console.log(`   Users with departmentId: ${usersWithDept}`);
    console.log(`   UserDepartment records: ${userDeptRecords}`);
    console.log(`   Primary assignments: ${primaryAssignments}`);
    
    return {
        usersWithDepartmentId: usersWithDept,
        userDepartmentRecords: userDeptRecords,
        primaryAssignments: primaryAssignments,
        migrationNeeded: usersWithDept > primaryAssignments
    };
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const command = process.argv[2];
    
    try {
        switch (command) {
            case 'migrate':
                await migrateToMultiDepartment();
                break;
            case 'rollback':
                await rollbackMigration();
                break;
            case 'status':
                await checkMigrationStatus();
                break;
            default:
                console.log('Usage: node migrateToMultiDepartment.js [migrate|rollback|status]');
                break;
        }
    } catch (error) {
        console.error('Script execution failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}
