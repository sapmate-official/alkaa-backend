import axios from 'axios';

const BASE_URL_V1 = 'http://localhost:3000/api/v1';
const BASE_URL_V2 = 'http://localhost:3000/api/v2';

async function testBirthdayEmails() {
    try {
        console.log('🔐 Logging in with admin credentials...');
        
        // Step 1: Login to get access token using v1 endpoint
        const loginResponse = await axios.post(`${BASE_URL_V1}/login`, {
            email: 'admin@techvantage.com',
            password: 'password'
        });

        console.log('✅ Login successful!');
        console.log('Login response:', loginResponse.data);
        
        // Extract token from response (check both possible locations)
        const token = loginResponse.data.accessToken || loginResponse.data.token || loginResponse.data.data?.token;
        
        if (!token) {
            console.error('❌ No token found in login response:', loginResponse.data);
            return;
        }

        console.log('🎫 Token received:', token.substring(0, 20) + '...');

        // Step 2: Test birthday email endpoint
        console.log('🎂 Testing birthday email to gpampa138@gmail.com...');
        
        const birthdayResponse = await axios.post(`${BASE_URL_V2}/birthday-emails/test`, {
            action: 'send_test_email',
            testEmail: 'gpampa138@gmail.com'
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('🎉 Birthday email test result:', birthdayResponse.data);

        // Step 3: Check today's birthdays
        console.log('📅 Checking today\'s birthdays...');
        
        const birthdaysResponse = await axios.post(`${BASE_URL_V2}/birthday-emails/test`, {
            action: 'check_todays_birthdays'
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('🎂 Today\'s birthdays:', birthdaysResponse.data);

    } catch (error) {
        console.error('❌ Error during testing:', error.response?.data || error.message);
        if (error.response?.status === 401) {
            console.log('🔒 Authentication failed - check credentials');
        }
    }
}

// Run the test
testBirthdayEmails();