import { seedOrganization } from './OrganizationSeeder.js';

async function main() {
  console.log('🚀 Starting organization seeding process using APIs...');
  
  try {
    await seedOrganization();
    console.log('🎉 Organization seeding completed successfully!');
    console.log('📧 Admin login credentials:');
    console.log('   Email: admin@techvantage.com');
    console.log('   Password: password');
    console.log('');
    console.log('🏢 Organization: TechVantage Solutions Pvt Ltd');
    console.log('👥 50 employees with realistic data created');
    console.log('🏢 10 departments with proper hierarchy');
    console.log('🎭 15 roles with appropriate permissions');
    console.log('🔑 All employees can login with password: "password"');
    console.log('');
    console.log('🔐 Super Admin used for seeding:');
    console.log('   Email: superadmin-test@alkaa.com');
    console.log('   Password: superAdmin-test@2025');
  } catch (error) {
    console.error('💥 Error during seeding:', error);
    process.exit(1);
  }
}

main();
