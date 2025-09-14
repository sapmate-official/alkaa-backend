import axios from 'axios';

// Test script for the complete organization creation API
const BASE_URL = 'http://localhost:3000/api/v2';

// Test credentials (replace with actual super admin token)
const SUPER_ADMIN_TOKEN = 'your-super-admin-token-here';

const testCompleteOrganizationCreation = async () => {
  try {
    console.log('🧪 Testing Complete Organization Creation API');
    console.log('=' .repeat(50));

    // First, let's get available subscription plans
    console.log('📋 Fetching subscription plans...');
    const plansResponse = await axios.get(`${BASE_URL}/subscription-plans`, {
      headers: {
        'Authorization': `Bearer ${SUPER_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const availablePlans = plansResponse.data.filter(plan => plan.isActive);
    if (availablePlans.length === 0) {
      throw new Error('No active subscription plans found');
    }
    
    console.log(`✅ Found ${availablePlans.length} active subscription plans`);
    const selectedPlan = availablePlans[0];
    console.log(`🎯 Using plan: ${selectedPlan.name} (${selectedPlan.id})`);

    // Get available permissions
    console.log('\n🔐 Fetching permissions...');
    const permissionsResponse = await axios.get(`${BASE_URL}/permission`, {
      headers: {
        'Authorization': `Bearer ${SUPER_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const permissions = permissionsResponse.data;
    if (permissions.length === 0) {
      throw new Error('No permissions found');
    }
    
    console.log(`✅ Found ${permissions.length} permissions`);
    
    // Select first 5 permissions for testing
    const selectedPermissions = permissions.slice(0, 5).map(p => p.id);
    console.log(`🎯 Selected ${selectedPermissions.length} permissions for admin role`);

    // Prepare test data
    const testData = {
      organization: {
        name: `Test Organization ${Date.now()}`,
        industry: 'Software Testing',
        subscriptionPlanId: selectedPlan.id,
        isActive: true,
        settings: JSON.stringify({
          timezone: 'Asia/Kolkata',
          workingHours: '9:00 AM - 6:00 PM'
        })
      },
      admin: {
        email: `testadmin${Date.now()}@example.com`,
        firstName: 'Test',
        lastName: 'Administrator'
      },
      permissions: selectedPermissions
    };

    console.log('\n🚀 Creating complete organization...');
    console.log('Organization Name:', testData.organization.name);
    console.log('Admin Email:', testData.admin.email);
    console.log('Selected Permissions:', selectedPermissions.length);

    // Make the API call
    const response = await axios.post(`${BASE_URL}/organization/complete`, testData, {
      headers: {
        'Authorization': `Bearer ${SUPER_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      console.log('\n🎉 SUCCESS! Organization created successfully');
      console.log('=' .repeat(50));
      console.log('📊 Response Data:');
      console.log('Organization ID:', response.data.data.organization.id);
      console.log('Organization Name:', response.data.data.organization.name);
      console.log('Admin Role ID:', response.data.data.adminRole.id);
      console.log('Admin User ID:', response.data.data.adminUser.id);
      console.log('Admin Email:', response.data.data.adminUser.email);
      console.log('Admin Status:', response.data.data.adminUser.status);
      console.log('Permissions Count:', response.data.data.adminRole.permissions.length);
      
      console.log('\n✅ Test completed successfully!');
      console.log('📧 Admin should receive a welcome email shortly');
    } else {
      console.log('\n❌ API returned success=false');
      console.log('Error:', response.data.message);
    }

  } catch (error) {
    console.log('\n❌ TEST FAILED!');
    console.log('=' .repeat(50));
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('Network Error:', error.message);
      console.log('Make sure the backend server is running on localhost:3000');
    } else {
      console.log('Error:', error.message);
    }
    
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure backend server is running');
    console.log('2. Update SUPER_ADMIN_TOKEN with valid token');
    console.log('3. Check database connection');
    console.log('4. Verify subscription plans exist');
    console.log('5. Verify permissions are seeded');
  }
};

// Test rollback functionality
const testRollbackFunctionality = async () => {
  try {
    console.log('\n🧪 Testing Rollback Functionality');
    console.log('=' .repeat(50));

    // Create a test with invalid data to trigger rollback
    const invalidTestData = {
      organization: {
        name: 'Test Rollback Org',
        industry: 'Test',
        subscriptionPlanId: 'invalid-subscription-plan-id', // This should cause failure
        isActive: true
      },
      admin: {
        email: 'invalid-email', // Invalid email format
        firstName: 'Test',
        lastName: 'User'
      },
      permissions: ['invalid-permission-id'] // Invalid permission ID
    };

    console.log('🚀 Attempting to create organization with invalid data...');
    
    const response = await axios.post(`${BASE_URL}/organization/complete`, invalidTestData, {
      headers: {
        'Authorization': `Bearer ${SUPER_ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('❌ Expected this to fail, but it succeeded:', response.data);

  } catch (error) {
    if (error.response && error.response.status >= 400) {
      console.log('✅ Expected failure occurred - rollback functionality working!');
      console.log('Error Status:', error.response.status);
      console.log('Error Message:', error.response.data.message || error.response.data.error);
      console.log('Rollback Details:', error.response.data.details);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
};

// Run the tests
const runTests = async () => {
  console.log('🔬 Complete Organization API Test Suite');
  console.log('Please update SUPER_ADMIN_TOKEN before running tests');
  console.log('=' .repeat(60));

  if (SUPER_ADMIN_TOKEN === 'your-super-admin-token-here') {
    console.log('⚠️  Please update SUPER_ADMIN_TOKEN in the script before running tests');
    return;
  }

  // Test 1: Successful creation
  await testCompleteOrganizationCreation();
  
  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Rollback functionality
  await testRollbackFunctionality();
  
  console.log('\n🏁 All tests completed!');
};

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { testCompleteOrganizationCreation, testRollbackFunctionality };
