import { seedOrganization } from './OrganizationSeeder.js';
import { setupCompleteHierarchy } from './CompleteHierarchySetup.js';

/**
 * Master Organization Setup Script
 * 
 * This script runs the complete organization setup process:
 * 1. Creates organization, departments, roles, and employees
 * 2. Sets up department heads and manager relationships
 * 3. Validates the organizational hierarchy
 */

async function runCompleteOrganizationSetup() {
  try {
    console.log('🚀 Starting Complete Organization Setup Process');
    console.log('=' .repeat(100));
    
    console.log('\n📋 Phase 1: Organization Foundation Setup');
    console.log('This includes: Organization, Departments, Roles, Users, and Basic Data');
    console.log('-' .repeat(80));
    
    // Phase 1: Run the organization seeder
    await seedOrganization();
    
    console.log('\n✅ Phase 1 completed successfully!');
    console.log('⏳ Waiting 5 seconds before starting hierarchy setup...');
    
    // Wait a bit to ensure all data is properly persisted
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🏗️ Phase 2: Department Hierarchy & Manager Assignment Setup');
    console.log('This includes: Department Heads, Manager Relationships, and Hierarchy Validation');
    console.log('-' .repeat(80));
    
    // Phase 2: Set up the complete hierarchy
    await setupCompleteHierarchy();
    
    console.log('\n' + '=' .repeat(100));
    console.log('🎉 COMPLETE ORGANIZATION SETUP FINISHED SUCCESSFULLY! 🎉');
    console.log('=' .repeat(100));
    
    console.log('\n📊 Setup Summary:');
    console.log('✅ Organization created: TechVantage Solutions Pvt Ltd');
    console.log('✅ Departments created with proper hierarchy');
    console.log('✅ Roles created with appropriate permissions');
    console.log('✅ ~50 employees created with realistic data');
    console.log('✅ Department heads assigned');
    console.log('✅ Manager-employee relationships established');
    console.log('✅ Organizational hierarchy validated');
    
    console.log('\n🔑 Login Credentials:');
    console.log('Super Admin: superadmin-test@alkaa.online / superAdmin-test@2025');
    console.log('Org Admin: admin@techvantage.com / password');
    console.log('All Employees: [employee-email] / password');
    
    console.log('\n🌐 You can now:');
    console.log('• Login to the admin panel with org admin credentials');
    console.log('• View the organizational chart and department structure');  
    console.log('• Test employee management features');
    console.log('• Explore role-based access control');
    console.log('• Generate payroll, attendance, and leave management reports');
    
    console.log('\n📈 Next Steps:');
    console.log('• Test the hierarchy in the frontend application');
    console.log('• Verify department head permissions work correctly');
    console.log('• Check manager-subordinate relationships in payroll');
    console.log('• Validate leave approval workflows');
    
  } catch (error) {
    console.error('\n❌ COMPLETE ORGANIZATION SETUP FAILED!');
    console.error('Error details:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Ensure the backend server is running on localhost:3000');
    console.error('2. Check database connection and permissions');
    console.error('3. Verify super admin credentials are correct');
    console.error('4. Check for any API endpoint changes');
    
    process.exit(1);
  }
}

// Export for use in other scripts
export { runCompleteOrganizationSetup };

// Run directly if this file is executed
if (import.meta.url === `file://${process.argv[1]}`) {
  runCompleteOrganizationSetup();
}
