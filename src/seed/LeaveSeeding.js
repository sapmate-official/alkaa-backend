import axios from 'axios';
import { configDotenv } from 'dotenv';

configDotenv();

const ORG_ID = 'cmbtr8y9i0001tlpwtvjjsftz';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Sample leave types to create
const LEAVE_TYPES = [
    {
        name: "Annual Leave",
        description: "Yearly vacation leave for employees",
        annualLimit: 20,
        requiresApproval: true,
        isPaid: true,
        carryForward: true,
        maxCarryForward: 5
    },
    {
        name: "Sick Leave",
        description: "Medical leave for illness or health issues",
        annualLimit: 10,
        requiresApproval: false,
        isPaid: true,
        carryForward: false,
        maxCarryForward: 0
    },
    {
        name: "Personal Leave",
        description: "Personal time off for personal matters",
        annualLimit: 5,
        requiresApproval: true,
        isPaid: false,
        carryForward: false,
        maxCarryForward: 0
    },
    {
        name: "Maternity Leave",
        description: "Leave for new mothers",
        annualLimit: 90,
        requiresApproval: true,
        isPaid: true,
        carryForward: false,
        maxCarryForward: 0
    },
    {
        name: "Paternity Leave",
        description: "Leave for new fathers",
        annualLimit: 15,
        requiresApproval: true,
        isPaid: true,
        carryForward: false,
        maxCarryForward: 0
    },
    {
        name: "Emergency Leave",
        description: "Urgent leave for emergencies",
        annualLimit: 3,
        requiresApproval: false,
        isPaid: true,
        carryForward: false,
        maxCarryForward: 0
    }
];

class LeaveSeeder {
    constructor() {
        this.orgId = ORG_ID;
        this.baseUrl = BASE_URL;
        this.users = [];
        this.managers = [];
        this.leaveTypes = [];
        this.authToken = null;
        this.cookies = null;
    }

    // Fetch users from organization after authentication
    async fetchOrganizationUsers() {
        try {
            console.log('\n👥 Fetching users from organization...');
            
            const response = await this.makeAPICall('GET', `/api/v2/user/org/${this.orgId}`);

            if (response.data && response.data.length > 0) {
                this.users = response.data;
                console.log(`✅ Found ${response.data.length} users in organization`);
                
                // Log some user details for verification
                console.log('📋 Sample users:');
                response.data.slice(0, 5).forEach(user => {
                    console.log(`   - ${user.firstName} ${user.lastName} (${user.email}) - ${user.status}`);
                });
                
                return response.data;
            } else {
                console.log('⚠️ No users found in organization');
                return [];
            }
        } catch (error) {
            console.error(`❌ Failed to fetch users: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
            throw error;
        }
    }

    // Login to get authentication token
    async authenticate() {
        try {
            console.log('\n🔐 Authenticating with the system...');
            
            // Use the admin credentials from the organization
            const adminCredentials = {
                email: 'admin@techvantage.com',
                password: 'password'
            };

            console.log(`🔍 Trying to login as admin: ${adminCredentials.email}`);
            
            const response = await axios.post(`${this.baseUrl}/api/v1/general/login`, {
                email: adminCredentials.email,
                password: adminCredentials.password
            }, {
                withCredentials: true,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.accessToken) {
                this.authToken = response.data.accessToken;
                
                // Extract cookies from response if available
                if (response.headers['set-cookie']) {
                    this.cookies = response.headers['set-cookie'].join('; ');
                }
                
                console.log(`✅ Successfully authenticated as admin: ${adminCredentials.email}`);
                console.log(`🎫 Access token obtained`);
                return true;
            } else {
                throw new Error('No access token received from login');
            }
            
        } catch (error) {
            console.error('❌ Authentication failed:', error.response?.data?.message || error.message);
            throw error;
        }
    }

    // Helper method to make authenticated API calls
    async makeAPICall(method, endpoint, data = null, requireAuth = true) {
        try {
            const config = {
                method,
                url: `${this.baseUrl}${endpoint}`,
                headers: {
                    'Content-Type': 'application/json',
                },
                withCredentials: true
            };

            // Add authentication headers if required
            if (requireAuth && this.authToken) {
                config.headers['Authorization'] = `Bearer ${this.authToken}`;
                
                // Also add cookies if available
                if (this.cookies) {
                    config.headers['Cookie'] = this.cookies;
                }
            }

            if (data) {
                config.data = data;
            }

            console.log(`📡 Making ${method} request to: ${config.url}`);
            if (requireAuth && this.authToken) {
                console.log(`🔐 Using authentication token`);
            }
            
            const response = await axios(config);
            return response.data;
        } catch (error) {
            console.error(`❌ API call failed for ${endpoint}:`, error.response?.data || error.message);
            
            // If unauthorized, try to re-authenticate once
            if (error.response?.status === 401 && requireAuth && this.authToken) {
                console.log('🔄 Token might be expired, trying to re-authenticate...');
                await this.authenticate();
                
                // Retry the request once with new token
                if (this.authToken) {
                    config.headers['Authorization'] = `Bearer ${this.authToken}`;
                    if (this.cookies) {
                        config.headers['Cookie'] = this.cookies;
                    }
                    
                    try {
                        const retryResponse = await axios(config);
                        return retryResponse.data;
                    } catch (retryError) {
                        console.error(`❌ Retry failed for ${endpoint}:`, retryError.response?.data || retryError.message);
                        throw retryError;
                    }
                }
            }
            
            throw error;
        }
    }

    // Fetch organization chart to understand structure
    async fetchOrganizationChart() {
        try {
            console.log('\n🔍 Fetching organization chart...');
            const chartData = await this.makeAPICall('GET', `/api/v2/organization/${this.orgId}/chart`, null, true);
            
            console.log('\n📊 Organization Chart Structure:');
            console.log(JSON.stringify(chartData, null, 2));

            // Extract all users from the chart
            this.extractUsersFromChart(chartData.chart);
            
            console.log(`\n👥 Total users found: ${this.users.length}`);
            console.log(`👨‍💼 Total managers found: ${this.managers.length}`);

            // Log user hierarchy
            this.logUserHierarchy();

            return chartData;
        } catch (error) {
            console.error('❌ Failed to fetch organization chart:', error.message);
            throw error;
        }
    }

    // Recursively extract users from chart structure
    extractUsersFromChart(chartNode) {
        if (Array.isArray(chartNode)) {
            chartNode.forEach(node => this.extractUsersFromChart(node));
        } else if (chartNode && typeof chartNode === 'object') {
            if (chartNode.type === 'user') {
                const user = {
                    id: chartNode.id,
                    firstName: chartNode.firstName,
                    lastName: chartNode.lastName,
                    email: chartNode.email,
                    employeeId: chartNode.employeeId,
                    departmentId: chartNode.departmentId,
                    departmentName: chartNode.departmentName,
                    managerId: chartNode.managerId,
                    isManager: chartNode.isManager,
                    isHead: chartNode.isHead,
                    subordinates: chartNode.subordinates || []
                };
                
                this.users.push(user);
                
                if (user.isManager || user.isHead) {
                    this.managers.push(user);
                }
            }
            
            if (chartNode.children && Array.isArray(chartNode.children)) {
                chartNode.children.forEach(child => this.extractUsersFromChart(child));
            }
        }
    }

    // Log user hierarchy for verification
    logUserHierarchy() {
        console.log('\n🏢 User Hierarchy Summary:');
        
        // Group users by department
        const usersByDept = this.users.reduce((acc, user) => {
            const dept = user.departmentName || 'No Department';
            if (!acc[dept]) acc[dept] = [];
            acc[dept].push(user);
            return acc;
        }, {});

        Object.entries(usersByDept).forEach(([dept, deptUsers]) => {
            console.log(`\n📁 ${dept}:`);
            deptUsers.forEach(user => {
                const manager = this.users.find(u => u.id === user.managerId);
                const managerName = manager ? `${manager.firstName} ${manager.lastName}` : 'No Manager';
                const role = user.isHead ? '👑 Head' : user.isManager ? '👨‍💼 Manager' : '👤 Employee';
                console.log(`  ${role} ${user.firstName} ${user.lastName} (${user.email}) → Reports to: ${managerName}`);
            });
        });
    }

    // Create leave types for the organization
    async createLeaveTypes() {
        try {
            console.log('\n📝 Creating leave types...');
            
            for (const leaveTypeData of LEAVE_TYPES) {
                try {
                    const payload = {
                        ...leaveTypeData,
                        orgId: this.orgId
                    };

                    console.log(`\n🏷️  Creating leave type: ${leaveTypeData.name}`);
                    const createdLeaveType = await this.makeAPICall('POST', '/api/v2/leave-type/', payload, true);
                    
                    this.leaveTypes.push(createdLeaveType);
                    console.log(`✅ Created: ${createdLeaveType.name} (ID: ${createdLeaveType.id})`);
                    console.log(`   📊 Annual Limit: ${createdLeaveType.annualLimit} days`);
                    console.log(`   💰 Paid: ${createdLeaveType.isPaid ? 'Yes' : 'No'}`);
                    console.log(`   📋 Requires Approval: ${createdLeaveType.requiresApproval ? 'Yes' : 'No'}`);
                    
                } catch (error) {
                    console.error(`❌ Failed to create leave type ${leaveTypeData.name}:`, error.response?.data || error.message);
                }
            }

            console.log(`\n🎉 Successfully created ${this.leaveTypes.length} leave types!`);
            return this.leaveTypes;

        } catch (error) {
            console.error('❌ Failed to create leave types:', error.message);
            throw error;
        }
    }

    // Generate realistic leave requests
    async createLeaveRequests() {
        try {
            console.log('\n📅 Creating sample leave requests...');

            if (this.leaveTypes.length === 0) {
                console.log('⚠️  No leave types available. Skipping leave request creation.');
                return [];
            }

            const leaveRequests = [];
            const currentYear = new Date().getFullYear();
            const today = new Date();
            
            // Create leave requests for different scenarios
            const leaveScenarios = this.generateLeaveScenarios();

            for (const scenario of leaveScenarios) {
                try {
                    const user = this.users.find(u => u.id === scenario.userId);
                    const leaveType = this.leaveTypes.find(lt => lt.name === scenario.leaveTypeName);
                    
                    if (!user || !leaveType) {
                        console.log(`⚠️  Skipping scenario - User or leave type not found`);
                        continue;
                    }

                    // Calculate dates
                    const startDate = new Date(today);
                    startDate.setDate(today.getDate() + scenario.daysFromNow);
                    
                    const endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + scenario.duration - 1);

                    const payload = {
                        userId: user.id,
                        leaveTypeId: leaveType.id,
                        startDate: startDate.toISOString().split('T')[0],
                        endDate: endDate.toISOString().split('T')[0],
                        reason: scenario.reason
                    };

                    console.log(`\n🎫 Creating leave request for ${user.firstName} ${user.lastName}`);
                    console.log(`   📋 Type: ${leaveType.name}`);
                    console.log(`   📅 Duration: ${startDate.toDateString()} to ${endDate.toDateString()} (${scenario.duration} days)`);
                    console.log(`   💬 Reason: ${scenario.reason}`);

                    const createdRequest = await this.makeAPICall('POST', '/api/v2/leave-request/', payload, true);
                    leaveRequests.push(createdRequest);
                    
                    console.log(`✅ Created leave request (ID: ${createdRequest.id}) - Status: ${createdRequest.status}`);

                    // Add small delay to avoid overwhelming the system
                    await new Promise(resolve => setTimeout(resolve, 500));

                } catch (error) {
                    console.error(`❌ Failed to create leave request:`, error.response?.data || error.message);
                }
            }

            console.log(`\n🎉 Successfully created ${leaveRequests.length} leave requests!`);
            return leaveRequests;

        } catch (error) {
            console.error('❌ Failed to create leave requests:', error.message);
            throw error;
        }
    }

    // Generate diverse leave scenarios
    generateLeaveScenarios() {
        const scenarios = [];
        const reasons = {
            'Annual Leave': [
                'Family vacation to Goa',
                'Wedding anniversary celebration',
                'Home renovation work',
                'Visiting relatives in hometown',
                'Personal travel and rest'
            ],
            'Sick Leave': [
                'Flu and fever',
                'Medical checkup and tests',
                'Recovery from minor surgery',
                'Dental treatment',
                'Back pain and physiotherapy'
            ],
            'Personal Leave': [
                'House shifting',
                'Bank and documentation work',
                'Family emergency',
                'Religious ceremony',
                'Personal appointments'
            ],
            'Emergency Leave': [
                'Family medical emergency',
                'Urgent travel due to family situation',
                'Home emergency repair'
            ]
        };

        // Create scenarios for different users and leave types
        const eligibleUsers = this.users.slice(0, Math.min(this.users.length, 10)); // Limit to first 10 users
        
        eligibleUsers.forEach((user, index) => {
            // Each user gets 2-4 leave requests
            const requestCount = 2 + Math.floor(Math.random() * 3);
            
            for (let i = 0; i < requestCount; i++) {
                const leaveType = this.leaveTypes[Math.floor(Math.random() * this.leaveTypes.length)];
                const reasonList = reasons[leaveType.name] || ['General leave request'];
                const reason = reasonList[Math.floor(Math.random() * reasonList.length)];
                
                // Vary the duration based on leave type
                let duration;
                switch (leaveType.name) {
                    case 'Annual Leave':
                        duration = 3 + Math.floor(Math.random() * 5); // 3-7 days
                        break;
                    case 'Sick Leave':
                        duration = 1 + Math.floor(Math.random() * 3); // 1-3 days
                        break;
                    case 'Personal Leave':
                        duration = 1 + Math.floor(Math.random() * 2); // 1-2 days
                        break;
                    case 'Emergency Leave':
                        duration = 1; // 1 day
                        break;
                    case 'Maternity Leave':
                        duration = 60 + Math.floor(Math.random() * 30); // 60-90 days
                        break;
                    case 'Paternity Leave':
                        duration = 7 + Math.floor(Math.random() * 8); // 7-14 days
                        break;
                    default:
                        duration = 1 + Math.floor(Math.random() * 3); // 1-3 days
                }

                // Vary the start date (future dates)
                const daysFromNow = 1 + Math.floor(Math.random() * 30) + (i * 10); // Spread requests over time

                scenarios.push({
                    userId: user.id,
                    leaveTypeName: leaveType.name,
                    duration,
                    daysFromNow,
                    reason
                });
            }
        });

        return scenarios;
    }

    // Main seeding method
    async seedLeaveData() {
        try {
            console.log('🌱 Starting Leave Data Seeding Process...');
            console.log(`🏢 Organization ID: ${this.orgId}`);
            console.log(`🌐 Base URL: ${this.baseUrl}`);

            // Step 1: Authenticate with the system
            await this.authenticate();

            // Step 2: Fetch organization users
            await this.fetchOrganizationUsers();

            // Step 3: Fetch organization structure
            await this.fetchOrganizationChart();

            // Step 4: Create leave types
            await this.createLeaveTypes();

            // Step 5: Create sample leave requests
            await this.createLeaveRequests();

            // Step 6: Display summary
            this.displaySummary();

            console.log('\n🎉 Leave data seeding completed successfully!');

        } catch (error) {
            console.error('\n❌ Leave data seeding failed:', error.message);
            throw error;
        }
    }

    // Display seeding summary
    displaySummary() {
        console.log('\n📊 SEEDING SUMMARY');
        console.log('==================');
        console.log(`🏢 Organization: ${this.orgId}`);
        console.log(`👥 Total Users: ${this.users.length}`);
        console.log(`👨‍💼 Total Managers: ${this.managers.length}`);
        console.log(`🏷️  Leave Types Created: ${this.leaveTypes.length}`);
        
        console.log('\n📋 Leave Types:');
        this.leaveTypes.forEach((lt, index) => {
            console.log(`${index + 1}. ${lt.name} (${lt.annualLimit} days, ${lt.isPaid ? 'Paid' : 'Unpaid'})`);
        });

        console.log('\n👥 User Summary by Department:');
        const usersByDept = this.users.reduce((acc, user) => {
            const dept = user.departmentName || 'No Department';
            if (!acc[dept]) acc[dept] = 0;
            acc[dept]++;
            return acc;
        }, {});

        Object.entries(usersByDept).forEach(([dept, count]) => {
            console.log(`📁 ${dept}: ${count} users`);
        });
    }
}

// Run the seeding process
async function runLeaveSeeding() {
    const seeder = new LeaveSeeder();
    try {
        await seeder.seedLeaveData();
    } catch (error) {
        console.error('Seeding process failed:', error);
        process.exit(1);
    }
}

// Export for use in other scripts
export default LeaveSeeder;
export { runLeaveSeeding };

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runLeaveSeeding();
}
