/**
 * Test script for hard delete user from organization API
 * 
 * This script tests the new hardDeleteUserFromOrg endpoint
 * Usage: node test-hard-delete-user.js
 */

import axios from 'axios';

// Configuration
const BASE_URL = 'http://localhost:3000/api/v2/user';
const TEST_ORG_ID = 'your-org-id-here'; // Replace with actual org ID
const TEST_USER_ID = 'your-user-id-here'; // Replace with actual user ID
const AUTH_TOKEN = 'your-auth-token-here'; // Replace with actual auth token

const testHardDeleteUserFromOrg = async () => {
    try {
        console.log('🧪 Testing Hard Delete User from Organization API');
        console.log('=' .repeat(50));
        
        // Test 1: Valid deletion
        console.log('\n📝 Test 1: Valid user deletion');
        console.log(`Organization ID: ${TEST_ORG_ID}`);
        console.log(`User ID: ${TEST_USER_ID}`);
        
        const response = await axios.delete(
            `${BASE_URL}/org/${TEST_ORG_ID}/user/${TEST_USER_ID}`,
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (response.data.success) {
            console.log('✅ SUCCESS! User deleted successfully');
            console.log('Response:', JSON.stringify(response.data, null, 2));
        } else {
            console.log('❌ FAILED! Unexpected response format');
            console.log('Response:', JSON.stringify(response.data, null, 2));
        }
        
    } catch (error) {
        console.log('❌ ERROR occurred during testing');
        
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
            
            // Test different error scenarios
            if (error.response.status === 400) {
                console.log('💡 This is a validation error - check your orgId and userId format');
            } else if (error.response.status === 404) {
                console.log('💡 User not found in the specified organization');
            } else if (error.response.status === 403) {
                console.log('💡 Forbidden - cannot delete last admin or insufficient permissions');
            } else if (error.response.status === 401) {
                console.log('💡 Authentication required - check your auth token');
            }
        } else {
            console.log('Network Error:', error.message);
        }
    }
};

const testErrorScenarios = async () => {
    console.log('\n🧪 Testing Error Scenarios');
    console.log('=' .repeat(50));
    
    // Test 2: Invalid UUID format
    console.log('\n📝 Test 2: Invalid UUID format');
    try {
        await axios.delete(
            `${BASE_URL}/org/invalid-uuid/user/invalid-uuid`,
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
    } catch (error) {
        if (error.response && error.response.status === 400) {
            console.log('✅ EXPECTED ERROR: Invalid UUID format caught correctly');
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('❌ UNEXPECTED ERROR:', error.message);
        }
    }
    
    // Test 3: Non-existent user
    console.log('\n📝 Test 3: Non-existent user');
    const nonExistentUserId = '12345678-1234-1234-1234-123456789012';
    const nonExistentOrgId = '87654321-4321-4321-4321-210987654321';
    
    try {
        await axios.delete(
            `${BASE_URL}/org/${nonExistentOrgId}/user/${nonExistentUserId}`,
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.log('✅ EXPECTED ERROR: User not found caught correctly');
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('❌ UNEXPECTED ERROR:', error.message);
        }
    }
    
    // Test 4: Missing authentication
    console.log('\n📝 Test 4: Missing authentication');
    try {
        await axios.delete(
            `${BASE_URL}/org/${TEST_ORG_ID}/user/${TEST_USER_ID}`
            // No authorization header
        );
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.log('✅ EXPECTED ERROR: Authentication required caught correctly');
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('❌ UNEXPECTED ERROR:', error.message);
        }
    }
};

const printApiDocumentation = () => {
    console.log('\n📚 API Documentation');
    console.log('=' .repeat(50));
    console.log('🔗 Endpoint: DELETE /api/v2/user/org/:orgId/user/:userId');
    console.log('🔐 Authentication: Required (Bearer token)');
    console.log('📥 Parameters:');
    console.log('   - orgId (path): Organization ID (UUID format)');
    console.log('   - userId (path): User ID to delete (UUID format)');
    console.log('📤 Response:');
    console.log('   Success (200): { success: true, message: "...", data: {...} }');
    console.log('   Error (400): Invalid parameters');
    console.log('   Error (401): Authentication required');
    console.log('   Error (403): Forbidden (cannot delete last admin)');
    console.log('   Error (404): User not found');
    console.log('   Error (500): Internal server error');
    console.log('\n💡 Features:');
    console.log('   ✅ Validates UUID format');
    console.log('   ✅ Prevents deletion of last organization admin');
    console.log('   ✅ Comprehensive data cleanup (all related records)');
    console.log('   ✅ Transaction-based (atomic operation)');
    console.log('   ✅ Activity logging');
    console.log('   ✅ Detailed error messages');
};

// Main execution
const main = async () => {
    printApiDocumentation();
    
    // Only run tests if valid credentials are provided
    if (TEST_ORG_ID !== 'your-org-id-here' && TEST_USER_ID !== 'your-user-id-here' && AUTH_TOKEN !== 'your-auth-token-here') {
        await testHardDeleteUserFromOrg();
        await testErrorScenarios();
    } else {
        console.log('\n⚠️  To run tests, please update the configuration variables at the top of this file:');
        console.log('   - TEST_ORG_ID: Replace with actual organization ID');
        console.log('   - TEST_USER_ID: Replace with actual user ID (WARNING: This user will be PERMANENTLY deleted!)');
        console.log('   - AUTH_TOKEN: Replace with valid authentication token');
        console.log('\n🚨 WARNING: This will PERMANENTLY delete the specified user and all related data!');
    }
    
    console.log('\n✨ Test script completed');
};

main().catch(console.error);
