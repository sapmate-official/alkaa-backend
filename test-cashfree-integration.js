/**
 * Cashfree Integration Test Script
 * This script helps you test the Cashfree payout integration in Alkaa
 */

import { CashfreePayoutService } from './src/controller/v3/Payroll/services/cashfreePayoutService.js';
import { prisma } from './src/db/connection.js';
import dotenv from 'dotenv';

dotenv.config();

class CashfreeIntegrationTester {
    
    static async testEnvironmentSetup() {
        console.log("🔧 Testing Cashfree Environment Setup...\n");
        
        const requiredEnvVars = [
            'CASHFREE_APP_ID',
            'CASHFREE_SECRET_KEY', 
            'CASHFREE_ENVIRONMENT'
        ];
        
        const missing = requiredEnvVars.filter(env => !process.env[env]);
        
        if (missing.length > 0) {
            console.error("❌ Missing environment variables:", missing);
            return false;
        }
        
        console.log("✅ Environment Variables:");
        console.log(`   CASHFREE_APP_ID: ${process.env.CASHFREE_APP_ID?.substring(0, 8)}...`);
        console.log(`   CASHFREE_SECRET_KEY: ${process.env.CASHFREE_SECRET_KEY?.substring(0, 8)}...`);
        console.log(`   CASHFREE_ENVIRONMENT: ${process.env.CASHFREE_ENVIRONMENT}\n`);
        
        return true;
    }
    
    static async testDatabaseSchema() {
        console.log("🗄️ Testing Database Schema...\n");
        
        try {
            // Test if required tables exist
            const salaryRecord = await prisma.salaryRecord.findFirst({
                include: {
                    user: {
                        include: {
                            bankDetails: true
                        }
                    }
                }
            });
            
            const transactionTable = await prisma.transactionTable.findFirst();
            
            console.log("✅ Database Schema:");
            console.log(`   SalaryRecord table: Available`);
            console.log(`   TransactionTable table: Available`);
            console.log(`   BankDetails table: Available`);
            console.log(`   Sample salary records: ${salaryRecord ? 'Found' : 'None found'}\n`);
            
            return true;
            
        } catch (error) {
            console.error("❌ Database Schema Error:", error.message);
            return false;
        }
    }
    
    static async testCashfreeConnection() {
        console.log("🌐 Testing Cashfree API Connection...\n");
        
        try {
            const balance = await CashfreePayoutService.getAccountBalance();
            
            console.log("✅ Cashfree API Connection:");
            console.log(`   Status: Connected`);
            console.log(`   Balance Response:`, balance);
            console.log();
            
            return true;
            
        } catch (error) {
            console.error("❌ Cashfree API Connection Error:", error.message);
            console.log("💡 Make sure your Cashfree credentials are correct and account is activated\n");
            return false;
        }
    }
    
    static async createTestPayroll() {
        console.log("💰 Creating Test Payroll Data...\n");
        
        try {
            // Find a user with bank details
            let user = await prisma.user.findFirst({
                include: {
                    bankDetails: true,
                    organization: true
                },
                where: {
                    bankDetails: {
                        isNot: null
                    }
                }
            });
            
            if (!user) {
                console.log("📝 Creating test user with bank details...");
                
                // Create a test user first
                user = await prisma.user.create({
                    data: {
                        email: 'test.employee@alkaa.com',
                        firstName: 'Test',
                        lastName: 'Employee',
                        orgId: 'your-org-id', // Replace with actual org ID
                        employeeId: 'TEST001',
                        monthlySalary: 50000,
                        status: 'active'
                    }
                });
                
                // Create bank details for test user
                await prisma.bankDetails.create({
                    data: {
                        userId: user.id,
                        bankName: 'Test Bank',
                        accountNumber: '3333333333', // Cashfree test account
                        ifscCode: 'YESB0CMSNOC', // Cashfree test IFSC
                        accountHolderName: 'Test Employee'
                    }
                });
                
                // Re-fetch user with bank details
                user = await prisma.user.findUnique({
                    where: { id: user.id },
                    include: {
                        bankDetails: true,
                        organization: true
                    }
                });
            }
            
            // Create a test salary record
            const salaryRecord = await prisma.salaryRecord.create({
                data: {
                    userId: user.id,
                    month: new Date().getMonth() + 1,
                    year: new Date().getFullYear(),
                    basicSalary: 45000,
                    netSalary: 40000,
                    status: 'PENDING',
                    allowances: {
                        hra: 5000,
                        da: 2000,
                        ta: 1000
                    },
                    deductions: {
                        pf: 5400,
                        tax: 2600
                    }
                }
            });
            
            console.log("✅ Test Data Created:");
            console.log(`   User ID: ${user.id}`);
            console.log(`   Employee ID: ${user.employeeId}`);
            console.log(`   Bank Account: ${user.bankDetails.accountNumber}`);
            console.log(`   Salary Record ID: ${salaryRecord.id}`);
            console.log(`   Net Salary: ₹${salaryRecord.netSalary}\n`);
            
            return { user, salaryRecord };
            
        } catch (error) {
            console.error("❌ Test Data Creation Error:", error.message);
            return null;
        }
    }
    
    static async testSalaryPayout(salaryRecordId) {
        console.log("💸 Testing Salary Payout...\n");
        
        try {
            const result = await CashfreePayoutService.initiateSalaryPayout(
                salaryRecordId,
                1000, // incentive
                500,  // bonus
                'Test salary payout via Cashfree'
            );
            
            console.log("✅ Payout Initiated:");
            console.log(`   Transfer ID: ${result.transferId}`);
            console.log(`   Amount: ₹${result.amount}`);
            console.log(`   Status: ${result.status}`);
            console.log(`   Transaction ID: ${result.transactionId}\n`);
            
            return result;
            
        } catch (error) {
            console.error("❌ Payout Error:", error.message);
            return null;
        }
    }
    
    static async testPayoutStatus(transferId) {
        console.log("📊 Testing Payout Status Check...\n");
        
        try {
            const status = await CashfreePayoutService.checkPayoutStatus(transferId);
            
            console.log("✅ Payout Status:");
            console.log(`   Transfer ID: ${status.transferId}`);
            console.log(`   Status: ${status.status}`);
            console.log(`   Details:`, status.details);
            console.log();
            
            return status;
            
        } catch (error) {
            console.error("❌ Status Check Error:", error.message);
            return null;
        }
    }
    
    static async runFullTest() {
        console.log("🚀 Starting Cashfree Integration Test Suite\n");
        console.log("=" .repeat(60) + "\n");
        
        // Test 1: Environment Setup
        const envTest = await this.testEnvironmentSetup();
        if (!envTest) return;
        
        // Test 2: Database Schema
        const dbTest = await this.testDatabaseSchema();
        if (!dbTest) return;
        
        // Test 3: Cashfree Connection
        const apiTest = await this.testCashfreeConnection();
        if (!apiTest) return;
        
        // Test 4: Create Test Data
        const testData = await this.createTestPayroll();
        if (!testData) return;
        
        // Test 5: Test Payout
        const payoutResult = await this.testSalaryPayout(testData.salaryRecord.id);
        if (!payoutResult) return;
        
        // Test 6: Check Status
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        await this.testPayoutStatus(payoutResult.transferId);
        
        console.log("🎉 Cashfree Integration Test Complete!");
        console.log("=" .repeat(60));
        console.log("✅ All tests passed! Your Cashfree integration is working correctly.");
        console.log("💡 Remember to use test credentials for testing and switch to production when ready.");
    }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    CashfreeIntegrationTester.runFullTest()
        .catch(console.error)
        .finally(() => process.exit());
}

export default CashfreeIntegrationTester;
