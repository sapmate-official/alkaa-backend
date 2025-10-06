import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const BASE_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const API_VERSION = 'v3';
const PERMISSION_API = `${BASE_URL}/api/${API_VERSION}/permission`;

// Admin credentials for authentication
const ADMIN_CREDENTIALS = {
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'admin123'
};

// Payroll permissions to seed
const PAYROLL_PERMISSIONS = [
    {
        name: 'Generate Self Salary',
        key: 'generate_salary_to_myself',
        action: 'generate',
        description: 'Permission to generate own salary',
        module: 'payroll'
    },
    {
        name: 'Generate All Salaries',
        key: 'generate_salary_of_all',
        action: 'generate',
        description: 'Permission to generate salary for all employees',
        module: 'payroll'
    },
    {
        name: 'Create Payroll Cycle',
        key: 'create_payroll_cycle',
        action: 'create',
        description: 'Permission to create new payroll cycles',
        module: 'payroll'
    },
    {
        name: 'Start Payroll Cycle',
        key: 'start_payroll_cycle',
        action: 'execute',
        description: 'Permission to start payroll cycle processing',
        module: 'payroll'
    },
    {
        name: 'Approve Payroll Cycle',
        key: 'approve_payroll_cycle',
        action: 'approve',
        description: 'Permission to approve completed payroll cycles',
        module: 'payroll'
    },
    {
        name: 'View Payroll Cycles',
        key: 'view_payroll_cycles',
        action: 'read',
        description: 'Permission to view payroll cycles',
        module: 'payroll'
    },
    {
        name: 'Review Payroll Cycles',
        key: 'review_payroll_cycles',
        action: 'review',
        description: 'Permission to review payroll cycles for approval',
        module: 'payroll'
    },
    {
        name: 'View Payroll Statistics',
        key: 'view_payroll_statistics',
        action: 'read',
        description: 'Permission to view payroll statistics and analytics',
        module: 'payroll'
    },
    {
        name: 'Bulk Generate Salaries',
        key: 'bulk_generate_salaries',
        action: 'execute',
        description: 'Permission to perform bulk salary generation',
        module: 'payroll'
    },
    {
        name: 'Access Payroll',
        key: 'access_payroll',
        action: 'read',
        description: 'Basic permission to access payroll module',
        module: 'payroll'
    },
    {
        name: 'Admin Access',
        key: 'admin_access',
        action: 'admin',
        description: 'Full administrative access to all modules',
        module: 'system'
    },
    {
        name: 'View Own Salary Slip',
        key: 'view_salary_slip_to_myself',
        action: 'read',
        description: 'Permission to view own salary slip',
        module: 'payroll'
    },
    {
        name: 'View Subordinate Salary Slips',
        key: 'view_salary_slip_of_subordinates',
        action: 'read',
        description: 'Permission to view salary slips of subordinates',
        module: 'payroll'
    },
    {
        name: 'View All Salary Slips',
        key: 'view_salary_slip_of_all',
        action: 'read',
        description: 'Permission to view salary slips of all employees',
        module: 'payroll'
    }
];

class PayrollPermissionSeeder {
    constructor() {
        this.authToken = null;
        this.axiosInstance = axios.create({
            baseURL: BASE_URL,
            timeout: 30000,
            withCredentials: true
        });
    }

    /**
     * Authenticate and get auth token
     */
    async authenticate() {
        try {
            console.log('🔐 Authenticating admin user...');
            
            const response = await this.axiosInstance.post('/api/v2/super-admin/login', {
                email: ADMIN_CREDENTIALS.email,
                password: ADMIN_CREDENTIALS.password
            });
            console.log('Response:', response.data); // Debugging line
            if (response.data) {
                this.authToken = response.data.accessToken;
                
                // Set authorization header for subsequent requests
                this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`;
                
                console.log('✅ Authentication successful');
                return true;
            } else {
                throw new Error('Authentication failed: Invalid response');
            }
        } catch (error) {
            console.log(error)
            console.error('❌ Authentication failed:', error.response?.data || error.message);
            return false;
        }
    }

    /**
     * Get all existing categories and subcategories
     */
    async getExistingStructure() {
        try {
            console.log('📋 Fetching existing permission structure...');
            
            const categoriesResponse = await this.axiosInstance.get(`${PERMISSION_API}/categories`);
            const subcategoriesResponse = await this.axiosInstance.get(`${PERMISSION_API}/subcategories`);
            
            const categories = categoriesResponse.data || [];
            const subcategories = subcategoriesResponse.data || [];
            
            console.log(`📂 Found ${categories.length} categories and ${subcategories.length} subcategories`);
            
            return { categories, subcategories };
        } catch (error) {
            console.error('❌ Failed to fetch permission structure:', error.response?.data || error.message);
            return { categories: [], subcategories: [] };
        }
    }

    /**
     * Find appropriate subcategory for a permission
     */
    findSubcategoryForPermission(permission, subcategories) {
        // Try to find a payroll-related subcategory
        const payrollSubcategory = subcategories.find(sub => 
            sub.name.toLowerCase().includes('payroll') || 
            sub.name.toLowerCase().includes('salary')
        );
        
        if (payrollSubcategory) {
            return payrollSubcategory.id;
        }
        
        // Fallback to a general subcategory if available
        const generalSubcategory = subcategories.find(sub => 
            sub.name.toLowerCase().includes('general') || 
            sub.name.toLowerCase().includes('basic')
        );
        
        if (generalSubcategory) {
            return generalSubcategory.id;
        }
        
        // If no suitable subcategory found, use the first available one
        return subcategories.length > 0 ? subcategories[0].id : null;
    }

    /**
     * Check if permission already exists
     */
    async checkPermissionExists(key) {
        try {
            const response = await this.axiosInstance.get(`${PERMISSION_API}/permissions`);
            const permissions = response.data || [];
            
            return permissions.find(p => p.key === key);
        } catch (error) {
            console.warn('⚠️ Could not check existing permissions:', error.message);
            return null;
        }
    }

    /**
     * Create a single permission
     */
    async createPermission(permissionData, subcategoryId) {
        try {
            const payload = {
                name: permissionData.name,
                key: permissionData.key,
                action: permissionData.action,
                description: permissionData.description,
                module: permissionData.module,
                subcategoryId: subcategoryId
            };

            const response = await this.axiosInstance.post(`${PERMISSION_API}/permission`, payload);
            
            if (response.status === 201) {
                console.log(`✅ Created permission: ${permissionData.name} (${permissionData.key})`);
                return response.data;
            } else {
                throw new Error(`Unexpected response status: ${response.status}`);
            }
        } catch (error) {
            if (error.response?.status === 400 && error.response?.data?.error?.includes('unique constraint')) {
                console.log(`⚠️ Permission already exists: ${permissionData.name} (${permissionData.key})`);
                return null;
            }
            
            console.error(`❌ Failed to create permission ${permissionData.name}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Seed all payroll permissions
     */
    async seedPermissions() {
        try {
            console.log('🌱 Starting payroll permissions seeding...');
            
            // Get existing structure
            const { subcategories } = await this.getExistingStructure();
            
            if (subcategories.length === 0) {
                console.error('❌ No subcategories found. Please ensure categories and subcategories exist first.');
                return false;
            }

            let createdCount = 0;
            let skippedCount = 0;
            let errorCount = 0;

            for (const permission of PAYROLL_PERMISSIONS) {
                try {
                    // Check if permission already exists
                    const existingPermission = await this.checkPermissionExists(permission.key);
                    if (existingPermission) {
                        console.log(`⏭️ Skipping existing permission: ${permission.name} (${permission.key})`);
                        skippedCount++;
                        continue;
                    }

                    // Find appropriate subcategory
                    const subcategoryId = this.findSubcategoryForPermission(permission, subcategories);
                    if (!subcategoryId) {
                        console.error(`❌ No suitable subcategory found for permission: ${permission.name}`);
                        errorCount++;
                        continue;
                    }

                    // Create permission
                    const result = await this.createPermission(permission, subcategoryId);
                    if (result) {
                        createdCount++;
                    } else {
                        skippedCount++;
                    }

                    // Add small delay to avoid overwhelming the API
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    console.error(`❌ Error processing permission ${permission.name}:`, error.message);
                    errorCount++;
                }
            }

            console.log('\n📊 Seeding Summary:');
            console.log(`✅ Created: ${createdCount} permissions`);
            console.log(`⏭️ Skipped: ${skippedCount} permissions (already exist)`);
            console.log(`❌ Errors: ${errorCount} permissions`);
            
            return errorCount === 0;

        } catch (error) {
            console.error('❌ Seeding failed:', error.message);
            return false;
        }
    }

    /**
     * Main execution method
     */
    async run() {
        console.log('🚀 Payroll Permission Seeder Starting...\n');
        
        try {
            // Step 1: Authenticate
            const authenticated = await this.authenticate();
            if (!authenticated) {
                console.error('❌ Cannot proceed without authentication');
                process.exit(1);
            }

            // Step 2: Seed permissions
            const success = await this.seedPermissions();
            
            if (success) {
                console.log('\n🎉 Payroll permissions seeding completed successfully!');
                process.exit(0);
            } else {
                console.log('\n⚠️ Payroll permissions seeding completed with some errors.');
                process.exit(1);
            }

        } catch (error) {
            console.error('\n💥 Seeder crashed:', error.message);
            console.error('Stack trace:', error.stack);
            process.exit(1);
        }
    }
}

// Create and run the seeder
const seeder = new PayrollPermissionSeeder();

// Handle process termination gracefully
process.on('SIGINT', () => {
    console.log('\n⚠️ Seeder interrupted by user');
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('\n⚠️ Seeder terminated');
    process.exit(1);
});

// Run the seeder
seeder.run().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
});

export default PayrollPermissionSeeder;