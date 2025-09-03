// Test file for the new email-based OTP authentication system
// This file demonstrates how to use the new authentication endpoints

const BASE_URL = 'http://localhost:3000/api/v1/auth';

/**
 * Test data - replace with real data for testing
 */
const testCredentials = {
    email: 'admin@techvantage.com',
    password: 'password'
};

/**
 * Step 1: Verify credentials
 * This endpoint checks if the user credentials are valid and determines if 2FA is required
 */
async function testVerifyCredentials() {
    console.log('=== Testing Credential Verification ===');
    
    try {
        const response = await fetch(`${BASE_URL}/verify-credentials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testCredentials)
        });

        const data = await response.json();
        console.log('Response:', data);

        if (data.requiresOTP) {
            console.log('✅ 2FA is required, session token:', data.sessionToken);
            return data.sessionToken;
        } else {
            console.log('✅ Login completed without 2FA');
            console.log('Access Token:', data.accessToken);
            return null;
        }
    } catch (error) {
        console.error('❌ Error:', error);
        return null;
    }
}

/**
 * Step 2: Request OTP (only if 2FA is required)
 */
async function testRequestOTP(sessionToken) {
    console.log('\n=== Testing OTP Request ===');
    
    try {
        const response = await fetch(`${BASE_URL}/request-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionToken })
        });

        const data = await response.json();
        console.log('Response:', data);

        if (response.ok) {
            console.log('✅ OTP sent successfully');
            return true;
        } else {
            console.log('❌ Failed to send OTP:', data.error);
            return false;
        }
    } catch (error) {
        console.error('❌ Error:', error);
        return false;
    }
}

/**
 * Step 3: Verify OTP (only if 2FA is required)
 * Note: You'll need to get the OTP from the email
 */
async function testVerifyOTP(sessionToken, otp) {
    console.log('\n=== Testing OTP Verification ===');
    
    try {
        const response = await fetch(`${BASE_URL}/verify-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionToken, otp })
        });

        const data = await response.json();
        console.log('Response:', data);

        if (response.ok) {
            console.log('✅ Login successful with 2FA');
            console.log('Access Token:', data.accessToken);
            return data.accessToken;
        } else {
            console.log('❌ OTP verification failed:', data.error);
            return null;
        }
    } catch (error) {
        console.error('❌ Error:', error);
        return null;
    }
}

/**
 * Test resend OTP functionality
 */
async function testResendOTP(sessionToken) {
    console.log('\n=== Testing OTP Resend ===');
    
    try {
        const response = await fetch(`${BASE_URL}/resend-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionToken })
        });

        const data = await response.json();
        console.log('Response:', data);

        if (response.ok) {
            console.log('✅ OTP resent successfully');
            return true;
        } else {
            console.log('❌ Failed to resend OTP:', data.error);
            return false;
        }
    } catch (error) {
        console.error('❌ Error:', error);
        return false;
    }
}

/**
 * Test 2FA toggle functionality (requires authentication)
 */
async function testToggle2FA(accessToken, enabled = true) {
    console.log('\n=== Testing 2FA Toggle ===');
    
    try {
        const response = await fetch(`${BASE_URL}/toggle-2fa`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ enabled })
        });

        const data = await response.json();
        console.log('Response:', data);

        if (response.ok) {
            console.log(`✅ 2FA ${enabled ? 'enabled' : 'disabled'} successfully`);
            return true;
        } else {
            console.log('❌ Failed to toggle 2FA:', data.error);
            return false;
        }
    } catch (error) {
        console.error('❌ Error:', error);
        return false;
    }
}

/**
 * Test notification preferences update (requires authentication)
 */
async function testUpdateNotificationPreferences(accessToken, enabled = true) {
    console.log('\n=== Testing Notification Preferences Update ===');
    
    try {
        const response = await fetch(`${BASE_URL}/notification-preferences`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ loginNotificationsEnabled: enabled })
        });

        const data = await response.json();
        console.log('Response:', data);

        if (response.ok) {
            console.log(`✅ Login notifications ${enabled ? 'enabled' : 'disabled'} successfully`);
            return true;
        } else {
            console.log('❌ Failed to update notification preferences:', data.error);
            return false;
        }
    } catch (error) {
        console.error('❌ Error:', error);
        return false;
    }
}

/**
 * Main test function
 */
async function runTests() {
    console.log('🚀 Starting Email-Based OTP Authentication Tests\n');
    
    // Step 1: Verify credentials
    const sessionToken = await testVerifyCredentials();
    
    if (sessionToken) {
        // 2FA is required
        
        // Step 2: Request OTP
        const otpSent = await testRequestOTP(sessionToken);
        
        if (otpSent) {
            console.log('\n📧 Please check your email for the OTP and run the verification manually');
            console.log('Example:');
            console.log(`testVerifyOTP('${sessionToken}', 'YOUR_OTP_HERE')`);
            
            // Test resend functionality
            // await testResendOTP(sessionToken);
        }
    }
    
    // If you have an access token from a successful login, you can test these:
    // await testToggle2FA('YOUR_ACCESS_TOKEN_HERE', true);
    // await testUpdateNotificationPreferences('YOUR_ACCESS_TOKEN_HERE', true);
    
    console.log('\n✅ Test run completed!');
}

// Export functions for manual testing
export {
    testVerifyCredentials,
    testRequestOTP,
    testVerifyOTP,
    testResendOTP,
    testToggle2FA,
    testUpdateNotificationPreferences,
    runTests
};

// Run tests if this file is executed directly
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
}

runTests();
console.log('📋 Authentication Test Helper Loaded');
console.log('Available functions:');
console.log('- testVerifyCredentials()');
console.log('- testRequestOTP(sessionToken)');
console.log('- testVerifyOTP(sessionToken, otp)');
console.log('- testResendOTP(sessionToken)');
console.log('- testToggle2FA(accessToken, enabled)');
console.log('- testUpdateNotificationPreferences(accessToken, enabled)');
console.log('- runTests() - Run all tests');
