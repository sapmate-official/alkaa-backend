import { runSmartHierarchySeeder } from './SmartHierarchySeeder.js';
import { runEnhancedHierarchySeeder } from './EnhancedHierarchySeeder.js';
import { runIntelligentManagerAssigner } from './IntelligentManagerAssigner.js';

/**
 * Hierarchy Seeder Runner
 * 
 * This script allows you to run different hierarchy seeders
 * based on your preference and requirements.
 */

async function main() {
  const args = process.argv.slice(2);
  const seederType = args[0] || 'intelligent';
  
  console.log('🚀 Hierarchy Seeder Runner');
  console.log('=' .repeat(50));
  console.log(`Selected Seeder: ${seederType}`);
  console.log('');
  
  try {
    switch (seederType.toLowerCase()) {
      case 'smart':
        console.log('🧠 Running Smart Hierarchy Seeder (API-based)...');
        console.log('This seeder uses API calls to fetch data and make assignments.');
        console.log('');
        await runSmartHierarchySeeder();
        break;
        
      case 'enhanced':
        console.log('🔬 Running Enhanced Hierarchy Seeder (Database + API)...');
        console.log('This seeder uses database analysis for smarter decisions.');
        console.log('');
        await runEnhancedHierarchySeeder();
        break;

      case 'intelligent':
        console.log('🤖 Running Intelligent Manager Assigner (Fixed Database + API)...');
        console.log('This seeder analyzes departments and assigns managers and heads intelligently.');
        console.log('');
        await runIntelligentManagerAssigner();
        break;
        
      default:
        console.log('❌ Invalid seeder type. Available options:');
        console.log('  - smart: API-based hierarchy seeder');
        console.log('  - enhanced: Database analysis + API seeder');
        console.log('  - intelligent: Fixed database analysis + API seeder (recommended)');
        console.log('');
        console.log('Usage: node HierarchySeederRunner.js [smart|enhanced|intelligent]');
        process.exit(1);
    }
    
    console.log('\n✅ Hierarchy seeding completed successfully!');
    console.log('');
    console.log('🔍 What was accomplished:');
    console.log('  ✓ Analyzed existing organizational structure');
    console.log('  ✓ Identified best candidates for department heads');
    console.log('  ✓ Assigned department heads based on role hierarchy and experience');
    console.log('  ✓ Set up manager-employee relationships');
    console.log('  ✓ Established proper organizational reporting structure');
    console.log('');
    console.log('🔑 You can now login and verify the hierarchy:');
    console.log('  Admin: admin@techvantage.com / password');
    console.log('  CEO: rajesh.sharma@techvantage.com / password');
    console.log('');
    console.log('📱 Test the hierarchy in the admin panel:');
    console.log('  - Organization Chart');
    console.log('  - Employee Management');
    console.log('  - Department Management');
    console.log('  - Leave Approval Workflows');
    
  } catch (error) {
    console.error('\n❌ Hierarchy Seeding Failed!');
    console.error('Error:', error.message);
    
    console.error('\n🔧 Troubleshooting Tips:');
    console.error('  1. Ensure backend server is running on localhost:3000');
    console.error('  2. Verify OrganizationSeeder has been run successfully');
    console.error('  3. Check that admin user exists: admin@techvantage.com');
    console.error('  4. Confirm all employees are activated with password: "password"');
    console.error('  5. Make sure database connection is working');
    
    process.exit(1);
  }
}

// Run the main function
main();
