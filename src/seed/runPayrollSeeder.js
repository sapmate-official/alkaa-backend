#!/usr/bin/env node

/**
 * Payroll Permission Seeder Runner
 * 
 * This script seeds payroll-related permissions into the database
 * using the API endpoints rather than direct database manipulation.
 * 
 * Usage:
 *   npm run seed:payroll-permissions
 *   or
 *   node src/seed/runPayrollSeeder.js
 * 
 * Environment Variables Required:
 *   - BACKEND_URL: Backend server URL (default: http://localhost:8000)
 *   - ADMIN_EMAIL: Admin user email for authentication
 *   - ADMIN_PASSWORD: Admin user password for authentication
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if we're in the correct directory
const expectedPackageJson = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(expectedPackageJson)) {
    console.error('❌ Error: package.json not found. Please run this script from the backend root directory.');
    process.exit(1);
}

// Check if seeder file exists
const seederPath = path.join(__dirname, 'PayrollPermissionSeeder.js');
if (!fs.existsSync(seederPath)) {
    console.error('❌ Error: PayrollPermissionSeeder.js not found at:', seederPath);
    process.exit(1);
}

// Import and run the seeder
async function runSeeder() {
    try {
        console.log('📝 Loading PayrollPermissionSeeder...');
        
        // Dynamic import for ES modules
        const { default: PayrollPermissionSeeder } = await import('./PayrollPermissionSeeder.js');
        
        console.log('🚀 Starting seeder execution...\n');
        
        const seeder = new PayrollPermissionSeeder();
        await seeder.run();
        
    } catch (error) {
        if (error.code === 'ERR_MODULE_NOT_FOUND') {
            console.error('❌ Error: Failed to import seeder module.');
            console.error('   Make sure all dependencies are installed: npm install');
        } else {
            console.error('❌ Error running seeder:', error.message);
            console.error('   Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

// Environment validation
function validateEnvironment() {
    const requiredEnvVars = ['ADMIN_EMAIL', 'ADMIN_PASSWORD'];
    const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingVars.length > 0) {
        console.warn('⚠️ Warning: Missing environment variables:', missingVars.join(', '));
        console.warn('   The seeder will use default values, which may not work in production.');
        console.warn('   Consider setting these in your .env file.\n');
    }
}

// Main execution
console.log('🌱 Payroll Permission Seeder Runner\n');

validateEnvironment();
runSeeder();