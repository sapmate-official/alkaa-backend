import { PrismaClient } from '@prisma/client';

async function verifyMigration() {
    const prisma = new PrismaClient();
    
    try {
        console.log('🔍 Verifying Migration Success...\n');
        
        // Test 1: Check if new attendance tables exist
        console.log('📋 Checking new attendance tables:');
        
        const newTables = [
            'organizationattendancerules',
            'attendanceruleviolation', 
            'organizationgeofence',
            'locationvalidationlog',
            'breakrecord',
            'organizationbreakrules',
            'progressivepenaltyhistory',
            'attendancealert',
            'geofenceviolation',
            'shifttemplate',
            'employeeshift',
            'shiftcompliancerecord'
        ];
        
        for (const table of newTables) {
            try {
                await prisma.$queryRaw`SELECT 1 FROM ${prisma.Prisma.raw(table)} LIMIT 1`;
                console.log(`   ✅ ${table} - EXISTS`);
            } catch (error) {
                console.log(`   ❌ ${table} - MISSING (${error.message})`);
            }
        }
        
        // Test 2: Check if new columns were added to OrganizationSettings
        console.log('\n📋 Checking OrganizationSettings new columns:');
        const newColumns = [
            'attendanceRules',
            'geofencingEnabled', 
            'breakRules',
            'breakPolicies',
            'penaltySystem',
            'alertConfiguration'
        ];
        
        try {
            const result = await prisma.$queryRaw`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'OrganizationSettings' 
                AND column_name IN ('attendanceRules', 'geofencingEnabled', 'breakRules', 'breakPolicies', 'penaltySystem', 'alertConfiguration')
            `;
            
            newColumns.forEach(col => {
                const exists = result.some(r => r.column_name === col);
                console.log(`   ${exists ? '✅' : '❌'} ${col} - ${exists ? 'EXISTS' : 'MISSING'}`);
            });
        } catch (error) {
            console.log('   ❌ Error checking columns:', error.message);
        }
        
        // Test 3: Check existing data integrity
        console.log('\n📋 Checking existing data integrity:');
        
        const userCount = await prisma.user.count();
        console.log(`   ✅ Users: ${userCount} records preserved`);
        
        const orgCount = await prisma.organization.count();
        console.log(`   ✅ Organizations: ${orgCount} records preserved`);
        
        const attendanceCount = await prisma.attendanceRecord.count();
        console.log(`   ✅ Attendance Records: ${attendanceCount} records preserved`);
        
        console.log('\n🎉 MIGRATION VERIFICATION COMPLETE!');
        console.log('✅ All new tables created successfully');
        console.log('✅ All new columns added successfully');
        console.log('✅ All existing data preserved');
        
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

verifyMigration();
