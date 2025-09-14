// Test script for multi-tenant authentication
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api/v1/general';

async function testMultiTenantAuth() {
    try {
        console.log('🧪 Testing Multi-Tenant Authentication Flow\n');

        // Step 1: Check email
        console.log('1. Testing email check...');
        const emailResponse = await fetch(`${BASE_URL}/check-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'test@example.com'  // Replace with actual test email
            })
        });

        const emailResult = await emailResponse.json();
        console.log('Email check response:', emailResult);

        if (emailResult.singleOrganization) {
            console.log('✅ Single organization detected');
            
            // Step 2: Test password verification
            console.log('\n2. Testing password verification...');
            const passwordResponse = await fetch(`${BASE_URL}/verify-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: 'test@example.com',
                    password: 'password123'  // Replace with actual test password
                })
            });

            const passwordResult = await passwordResponse.json();
            console.log('Password verification response:', passwordResult);

            if (passwordResult.sessionToken) {
                console.log('✅ OTP sent successfully');
                
                // Note: For Step 3 (OTP verification), you would need the actual OTP
                // This is just a placeholder to show the flow
                console.log('\n3. OTP verification would happen here with the actual OTP');
                console.log('Session token received:', passwordResult.sessionToken);
            }
        } else if (emailResult.multipleOrganizations) {
            console.log('✅ Multiple organizations detected');
            console.log('Organizations:', emailResult.organizations);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
if (process.argv[2] === 'run') {
    testMultiTenantAuth();
} else {
    console.log('To run this test, use: node test_multitenant_auth.js run');
    console.log('Make sure the server is running on port 5000');
}
