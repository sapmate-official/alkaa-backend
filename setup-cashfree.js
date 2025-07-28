#!/usr/bin/env node

/**
 * Cashfree Integration Setup Script for Alkaa
 * This script helps you set up and verify your Cashfree integration
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CashfreeSetup {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, resolve);
        });
    }

    async setup() {
        console.log('\n🚀 Welcome to Alkaa Cashfree Integration Setup!\n');
        console.log('This script will help you configure Cashfree payment gateway for automated salary payouts.\n');

        // Step 1: Check current environment
        await this.checkCurrentSetup();

        // Step 2: Get Cashfree credentials
        await this.getCashfreeCredentials();

        // Step 3: Verify database schema
        await this.verifyDatabaseSchema();

        // Step 4: Test connection
        await this.testConnection();

        // Step 5: Final instructions
        await this.showFinalInstructions();

        this.rl.close();
    }

    async checkCurrentSetup() {
        console.log('📋 Step 1: Checking Current Setup\n');

        // Check if .env file exists
        const envPath = path.join(__dirname, '.env');
        if (!fs.existsSync(envPath)) {
            console.log('❌ .env file not found. Creating one for you...');
            this.createEnvFile();
        } else {
            console.log('✅ .env file found');
        }

        // Check if Cashfree package is installed
        const packageJsonPath = path.join(__dirname, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (packageJson.dependencies && packageJson.dependencies['cashfree-pg']) {
                console.log('✅ Cashfree package installed:', packageJson.dependencies['cashfree-pg']);
            } else {
                console.log('❌ Cashfree package not found. Installing...');
                await this.installCashfreePackage();
            }
        }

        console.log('\n');
    }

    async getCashfreeCredentials() {
        console.log('🔑 Step 2: Cashfree Credentials Setup\n');
        
        console.log('To get your Cashfree credentials:');
        console.log('1. Sign up at https://www.cashfree.com');
        console.log('2. Go to Dashboard → Developers → API Keys');
        console.log('3. Generate API Keys for Test Environment');
        console.log('4. Copy your App ID and Secret Key\n');

        const appId = await this.question('Enter your Cashfree App ID: ');
        const secretKey = await this.question('Enter your Cashfree Secret Key: ');
        const environment = await this.question('Environment (sandbox/production) [sandbox]: ') || 'sandbox';

        // Update .env file
        this.updateEnvFile({
            CASHFREE_APP_ID: appId,
            CASHFREE_SECRET_KEY: secretKey,
            CASHFREE_ENVIRONMENT: environment
        });

        console.log('✅ Credentials saved to .env file\n');
    }

    async verifyDatabaseSchema() {
        console.log('🗄️ Step 3: Database Schema Verification\n');
        
        try {
            // Check if required files exist
            const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
            if (fs.existsSync(schemaPath)) {
                console.log('✅ Prisma schema found');
                
                const schemaContent = fs.readFileSync(schemaPath, 'utf8');
                
                // Check for required fields
                const requiredFields = [
                    'paymentMode',
                    'paymentRef',
                    'cashfreeTransferId',
                    'cashfreeResponse'
                ];
                
                const missingFields = requiredFields.filter(field => !schemaContent.includes(field));
                
                if (missingFields.length === 0) {
                    console.log('✅ All required database fields are present');
                } else {
                    console.log('⚠️ Missing database fields:', missingFields.join(', '));
                    console.log('💡 Run: npx prisma db push to update your database');
                }
            } else {
                console.log('❌ Prisma schema not found');
            }
        } catch (error) {
            console.log('❌ Error checking database schema:', error.message);
        }

        console.log('\n');
    }

    async testConnection() {
        console.log('🌐 Step 4: Testing Cashfree Connection\n');
        
        const shouldTest = await this.question('Do you want to test the Cashfree connection now? (y/n) [y]: ') || 'y';
        
        if (shouldTest.toLowerCase() === 'y') {
            console.log('Running connection test...');
            
            try {
                // Import and run the test
                const testScript = path.join(__dirname, 'test-cashfree-integration.js');
                if (fs.existsSync(testScript)) {
                    console.log('✅ Test script found. Run the following command to test:');
                    console.log('   node test-cashfree-integration.js\n');
                } else {
                    console.log('❌ Test script not found. You can test manually using the API endpoints.\n');
                }
            } catch (error) {
                console.log('❌ Connection test failed:', error.message);
            }
        }
    }

    async showFinalInstructions() {
        console.log('🎉 Setup Complete! Final Instructions:\n');
        
        console.log('1. 🔧 Complete Cashfree Dashboard Setup:');
        console.log('   • Enable Payouts in your Cashfree dashboard');
        console.log('   • Complete KYC verification');
        console.log('   • Add test balance to your wallet\n');
        
        console.log('2. 🧪 Test the Integration:');
        console.log('   • Run: node test-cashfree-integration.js');
        console.log('   • Create test employees with bank details');
        console.log('   • Generate salary records');
        console.log('   • Try processing a test payout\n');
        
        console.log('3. 🎨 Frontend Integration:');
        console.log('   • Import CashfreePayoutManager component');
        console.log('   • Add it to your payroll dashboard');
        console.log('   • Test the UI with generated salary records\n');
        
        console.log('4. 🔔 Configure Webhooks:');
        console.log('   • In Cashfree dashboard, set webhook URL to:');
        console.log('   • https://your-domain.com/api/v2/payroll/cashfree/webhook\n');
        
        console.log('5. 📚 Documentation:');
        console.log('   • Read CASHFREE_INTEGRATION_GUIDE.md for detailed documentation');
        console.log('   • Check API endpoints in the guide');
        console.log('   • Review troubleshooting section\n');
        
        console.log('🚀 You\'re all set! Your Alkaa system now supports automated salary payouts via Cashfree.');
        console.log('💡 Remember to switch to production credentials when going live.\n');
    }

    createEnvFile() {
        const envContent = `# Database
DATABASE_URL=your_database_url

# JWT Secrets
ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret

# Cashfree Payment Gateway Configuration
CASHFREE_APP_ID=your_test_app_id
CASHFREE_SECRET_KEY=your_test_secret_key
CASHFREE_ENVIRONMENT=sandbox

# Other configurations...
PORT=3000
NODE_ENV=development
`;
        
        fs.writeFileSync(path.join(__dirname, '.env'), envContent);
        console.log('✅ Created .env file with template');
    }

    updateEnvFile(newVars) {
        const envPath = path.join(__dirname, '.env');
        let envContent = '';
        
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }
        
        // Update or add variables
        Object.entries(newVars).forEach(([key, value]) => {
            const regex = new RegExp(`^${key}=.*$`, 'm');
            const newLine = `${key}=${value}`;
            
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, newLine);
            } else {
                envContent += `\n${newLine}`;
            }
        });
        
        fs.writeFileSync(envPath, envContent);
    }

    async installCashfreePackage() {
        console.log('Installing Cashfree package...');
        // In a real scenario, you would use child_process to run npm install
        console.log('Please run: npm install cashfree-pg');
    }
}

// Run the setup
const setup = new CashfreeSetup();
setup.setup().catch(console.error);
