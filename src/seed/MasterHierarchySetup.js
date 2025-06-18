import { setupDepartmentHierarchy } from './DepartmentHierarchySetup.js';
import { validateHierarchy } from './HierarchyValidator.js';

/**
 * Master Department Hierarchy Setup Script
 * 
 * This script orchestrates the complete department hierarchy setup process:
 * 1. Assigns department heads based on organizational structure
 * 2. Sets up manager-employee relationships
 * 3. Validates the entire hierarchy
 * 4. Generates comprehensive reports
 * 
 * Prerequisites:
 * - OrganizationSeeder must have been run to create departments and users
 * - Backend server must be running
 * - Admin user must exist and be activated
 */

async function runMasterHierarchySetup() {
  console.log('🚀 Starting Master Department Hierarchy Setup');
  console.log('=' .repeat(80));
  console.log('📋 This script will:');
  console.log('   1. Assign department heads based on organizational hierarchy');
  console.log('   2. Set up proper manager-employee relationships');
  console.log('   3. Validate the entire hierarchy structure');
  console.log('   4. Generate comprehensive reports');
  console.log('=' .repeat(80));
  
  try {
    // Phase 1: Setup Department Hierarchy
    console.log('\n🏗️ PHASE 1: Department Hierarchy Setup');
    console.log('=' .repeat(60));
    await setupDepartmentHierarchy();
    
    // Small delay to ensure data persistence
    console.log('\n⏳ Waiting for data synchronization...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Phase 2: Validate Hierarchy
    console.log('\n🔍 PHASE 2: Hierarchy Validation & Reporting');
    console.log('=' .repeat(60));
    await validateHierarchy();
    
    // Final Summary
    console.log('\n' + '=' .repeat(80));
    console.log('🎉 MASTER HIERARCHY SETUP COMPLETED SUCCESSFULLY!');
    console.log('=' .repeat(80));
    console.log('✅ Department heads have been assigned');
    console.log('✅ Manager-employee relationships have been established');
    console.log('✅ Hierarchy integrity has been validated');
    console.log('✅ Comprehensive reports have been generated');
    console.log('');
    console.log('🔑 Login Credentials:');
    console.log('   Admin: admin@techvantage.com / password');
    console.log('   CEO: rajesh.sharma@techvantage.com / password');
    console.log('   All employees: [employee-email] / password');
    console.log('');
    console.log('🌐 You can now test the hierarchy in the admin panel:');
    console.log('   - Organization Chart');
    console.log('   - Employee Management');
    console.log('   - Department Management');
    console.log('   - Leave Approval Workflows');
    console.log('=' .repeat(80));
    
  } catch (error) {
    console.error('\n❌ MASTER HIERARCHY SETUP FAILED!');
    console.error('=' .repeat(50));
    console.error('Error:', error.message);
    
    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }
    
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Ensure backend server is running on localhost:3000');
    console.error('   2. Verify OrganizationSeeder has been run successfully');
    console.error('   3. Check that admin user exists and is activated');
    console.error('   4. Confirm all departments and users were created');
    
    process.exit(1);
  }
}

// Run the master setup
runMasterHierarchySetup();
