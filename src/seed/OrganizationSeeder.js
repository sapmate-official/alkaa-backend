import axios from 'axios';
import { faker } from '@faker-js/faker';

// Base URL for API calls
const BASE_URL = 'http://localhost:3000/api/v2';

// Super admin credentials for organization creation
const SUPER_ADMIN_CREDENTIALS = {
  email: 'superadmin-test@alkaa.online',
  password: 'superAdmin-test@2025'
};

// Realistic company data
const COMPANY_DATA = {
  name: "TechVantage Solutions Pvt Ltd",
  industry: "Information Technology",
  settings: JSON.stringify({
    workingHours: "9:00 AM - 6:00 PM",
    timezone: "Asia/Kolkata",
    currency: "INR",
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  })
};

// Department structure with realistic hierarchy
const DEPARTMENTS_DATA = [
  {
    name: "Executive Leadership",
    code: "EXEC-01",
    description: "Top-level executive leadership and strategic planning",
    location: "Bangalore - Tower A, Floor 10",
    budget: 50000000,
    isParent: true
  },
  {
    name: "Human Resources",
    code: "HR-01", 
    description: "Employee management, recruitment, and organizational development",
    location: "Bangalore - Tower A, Floor 5",
    budget: 15000000,
    isParent: true
  },
  {
    name: "Information Technology",
    code: "IT-01",
    description: "Software development, infrastructure, and technical operations",
    location: "Bangalore - Tower B, Floor 3-7",
    budget: 80000000,
    isParent: true
  },
  {
    name: "Finance & Accounting",
    code: "FIN-01",
    description: "Financial planning, accounting, and business analysis",
    location: "Bangalore - Tower A, Floor 6",
    budget: 12000000,
    isParent: true
  },
  {
    name: "Sales & Marketing",
    code: "SALES-01",
    description: "Business development, client relations, and marketing operations",
    location: "Bangalore - Tower A, Floor 8",
    budget: 25000000,
    isParent: true
  },
  {
    name: "Quality Assurance",
    code: "QA-01",
    description: "Software testing, quality control, and process improvement",
    location: "Bangalore - Tower B, Floor 6",
    budget: 8000000,
    parentCode: "IT-01"
  },
  {
    name: "DevOps & Infrastructure",
    code: "DEVOPS-01",
    description: "Cloud infrastructure, deployment, and system administration",
    location: "Bangalore - Tower B, Floor 7",
    budget: 15000000,
    parentCode: "IT-01"
  },
  {
    name: "Frontend Development",
    code: "FE-01",
    description: "User interface and user experience development",
    location: "Bangalore - Tower B, Floor 4",
    budget: 20000000,
    parentCode: "IT-01"
  },
  {
    name: "Backend Development",
    code: "BE-01",
    description: "Server-side development and API management",
    location: "Bangalore - Tower B, Floor 5",
    budget: 25000000,
    parentCode: "IT-01"
  },
  {
    name: "Talent Acquisition",
    code: "TA-01",
    description: "Recruitment and talent sourcing",
    location: "Bangalore - Tower A, Floor 5",
    budget: 5000000,
    parentCode: "HR-01"
  }
];

// Role definitions with permission mapping
const ROLES_DATA = [
  {
    name: "CEO",
    description: "Chief Executive Officer - Full organizational control",
    permissionCategories: ["all"]
  },
  {
    name: "CTO", 
    description: "Chief Technology Officer - Technology leadership",
    permissionCategories: ["Organization", "Department", "Employee", "Info", "Role"]
  },
  {
    name: "HR Director",
    description: "Human Resources Director - People management",
    permissionCategories: ["Employee", "Info", "Organization", "Salary"]
  },
  {
    name: "Engineering Manager",
    description: "Engineering team leadership and management",
    permissionCategories: ["Department", "Employee", "Info", "Attendance"]
  },
  {
    name: "Senior Software Engineer",
    description: "Senior technical contributor and team lead",
    permissionCategories: ["Info", "Attendance", "leave"]
  },
  {
    name: "Software Engineer",
    description: "Software development and implementation",
    permissionCategories: ["Info", "Attendance", "leave"]
  },
  {
    name: "QA Engineer",
    description: "Quality assurance and testing specialist",
    permissionCategories: ["Info", "Attendance", "leave"]
  },
  {
    name: "DevOps Engineer",
    description: "Infrastructure and deployment specialist",
    permissionCategories: ["Info", "Attendance", "leave"]
  },
  {
    name: "UI/UX Designer",
    description: "User interface and experience design",
    permissionCategories: ["Info", "Attendance", "leave"]
  },
  {
    name: "Sales Manager",
    description: "Sales team leadership and client management",
    permissionCategories: ["Info", "Attendance", "Organization"]
  },
  {
    name: "Sales Executive",
    description: "Client acquisition and relationship management",
    permissionCategories: ["Info", "Attendance", "leave"]
  },
  {
    name: "Finance Manager",
    description: "Financial planning and analysis leadership",
    permissionCategories: ["Salary", "Info", "Attendance", "Organization"]
  },
  {
    name: "Accountant",
    description: "Financial record keeping and reporting",
    permissionCategories: ["Info", "Attendance", "leave"]
  },
  {
    name: "HR Manager",
    description: "Human resources management and operations",
    permissionCategories: ["Employee", "Info", "Attendance", "leave"]
  },
  {
    name: "Talent Acquisition Specialist",
    description: "Recruitment and hiring specialist",
    permissionCategories: ["Employee", "Info", "Attendance"]
  }
];

// Employee templates with realistic Indian names and data
const EMPLOYEE_TEMPLATES = [
  // Executive Leadership
  {
    firstName: "Rajesh", lastName: "Sharma", email: "rajesh.sharma@techvantage.com",
    departmentCode: "EXEC-01", role: "CEO", isHead: true,
    experience: 15, salaryRange: [8000000, 10000000]
  },
  {
    firstName: "Priya", lastName: "Patel", email: "priya.patel@techvantage.com", 
    departmentCode: "IT-01", role: "CTO", isHead: true,
    experience: 12, salaryRange: [6000000, 8000000]
  },
  
  // HR Department
  {
    firstName: "Anita", lastName: "Reddy", email: "anita.reddy@techvantage.com",
    departmentCode: "HR-01", role: "HR Director", isHead: true,
    experience: 10, salaryRange: [3500000, 4500000]
  },
  {
    firstName: "Vikram", lastName: "Singh", email: "vikram.singh@techvantage.com",
    departmentCode: "HR-01", role: "HR Manager",
    experience: 7, salaryRange: [2500000, 3000000]
  },
  {
    firstName: "Sneha", lastName: "Agarwal", email: "sneha.agarwal@techvantage.com",
    departmentCode: "TA-01", role: "Talent Acquisition Specialist", isHead: true,
    experience: 5, salaryRange: [1800000, 2200000]
  },
  {
    firstName: "Rohit", lastName: "Mehta", email: "rohit.mehta@techvantage.com",
    departmentCode: "TA-01", role: "Talent Acquisition Specialist",
    experience: 3, salaryRange: [1500000, 1800000]
  },

  // IT Department - Backend
  {
    firstName: "Arjun", lastName: "Kumar", email: "arjun.kumar@techvantage.com",
    departmentCode: "BE-01", role: "Engineering Manager", isHead: true,
    experience: 8, salaryRange: [3000000, 3500000]
  },
  {
    firstName: "Deepika", lastName: "Nair", email: "deepika.nair@techvantage.com",
    departmentCode: "BE-01", role: "Senior Software Engineer",
    experience: 6, salaryRange: [2200000, 2800000]
  },
  {
    firstName: "Amit", lastName: "Joshi", email: "amit.joshi@techvantage.com",
    departmentCode: "BE-01", role: "Senior Software Engineer", 
    experience: 5, salaryRange: [2000000, 2500000]
  },
  {
    firstName: "Kavya", lastName: "Rao", email: "kavya.rao@techvantage.com",
    departmentCode: "BE-01", role: "Software Engineer",
    experience: 3, salaryRange: [1500000, 2000000]
  },
  {
    firstName: "Suresh", lastName: "Gupta", email: "suresh.gupta@techvantage.com",
    departmentCode: "BE-01", role: "Software Engineer",
    experience: 2, salaryRange: [1200000, 1600000]
  },
  {
    firstName: "Meera", lastName: "Shah", email: "meera.shah@techvantage.com",
    departmentCode: "BE-01", role: "Software Engineer",
    experience: 4, salaryRange: [1600000, 2100000]
  },

  // IT Department - Frontend
  {
    firstName: "Karan", lastName: "Malhotra", email: "karan.malhotra@techvantage.com",
    departmentCode: "FE-01", role: "Engineering Manager", isHead: true,
    experience: 7, salaryRange: [2800000, 3200000]
  },
  {
    firstName: "Neha", lastName: "Chopra", email: "neha.chopra@techvantage.com",
    departmentCode: "FE-01", role: "UI/UX Designer",
    experience: 4, salaryRange: [1800000, 2200000]
  },
  {
    firstName: "Rahul", lastName: "Verma", email: "rahul.verma@techvantage.com",
    departmentCode: "FE-01", role: "Senior Software Engineer",
    experience: 5, salaryRange: [2000000, 2400000]
  },
  {
    firstName: "Pooja", lastName: "Saxena", email: "pooja.saxena@techvantage.com",
    departmentCode: "FE-01", role: "Software Engineer",
    experience: 3, salaryRange: [1400000, 1800000]
  },
  {
    firstName: "Vishal", lastName: "Mishra", email: "vishal.mishra@techvantage.com",
    departmentCode: "FE-01", role: "Software Engineer",
    experience: 2, salaryRange: [1200000, 1500000]
  },

  // QA Department
  {
    firstName: "Shweta", lastName: "Bansal", email: "shweta.bansal@techvantage.com",
    departmentCode: "QA-01", role: "Engineering Manager", isHead: true,
    experience: 6, salaryRange: [2500000, 3000000]
  },
  {
    firstName: "Manish", lastName: "Trivedi", email: "manish.trivedi@techvantage.com",
    departmentCode: "QA-01", role: "QA Engineer",
    experience: 4, salaryRange: [1600000, 2000000]
  },
  {
    firstName: "Riya", lastName: "Kapoor", email: "riya.kapoor@techvantage.com",
    departmentCode: "QA-01", role: "QA Engineer",
    experience: 3, salaryRange: [1400000, 1700000]
  },
  {
    firstName: "Aditya", lastName: "Pandey", email: "aditya.pandey@techvantage.com",
    departmentCode: "QA-01", role: "QA Engineer",
    experience: 2, salaryRange: [1200000, 1500000]
  },

  // DevOps Department
  {
    firstName: "Sanjay", lastName: "Iyer", email: "sanjay.iyer@techvantage.com",
    departmentCode: "DEVOPS-01", role: "Engineering Manager", isHead: true,
    experience: 8, salaryRange: [3200000, 3800000]
  },
  {
    firstName: "Priyanka", lastName: "Desai", email: "priyanka.desai@techvantage.com",
    departmentCode: "DEVOPS-01", role: "DevOps Engineer",
    experience: 5, salaryRange: [2200000, 2600000]
  },
  {
    firstName: "Akash", lastName: "Jain", email: "akash.jain@techvantage.com",
    departmentCode: "DEVOPS-01", role: "DevOps Engineer",
    experience: 3, salaryRange: [1800000, 2200000]
  },

  // Finance Department
  {
    firstName: "Madhuri", lastName: "Kulkarni", email: "madhuri.kulkarni@techvantage.com",
    departmentCode: "FIN-01", role: "Finance Manager", isHead: true,
    experience: 9, salaryRange: [3000000, 3500000]
  },
  {
    firstName: "Ravi", lastName: "Agrawal", email: "ravi.agrawal@techvantage.com",
    departmentCode: "FIN-01", role: "Accountant",
    experience: 5, salaryRange: [1800000, 2200000]
  },
  {
    firstName: "Sunita", lastName: "Bhardwaj", email: "sunita.bhardwaj@techvantage.com",
    departmentCode: "FIN-01", role: "Accountant",
    experience: 3, salaryRange: [1500000, 1800000]
  },

  // Sales Department
  {
    firstName: "Gaurav", lastName: "Sinha", email: "gaurav.sinha@techvantage.com",
    departmentCode: "SALES-01", role: "Sales Manager", isHead: true,
    experience: 7, salaryRange: [2800000, 3200000]
  },
  {
    firstName: "Preeti", lastName: "Sharma", email: "preeti.sharma@techvantage.com",
    departmentCode: "SALES-01", role: "Sales Executive",
    experience: 4, salaryRange: [1600000, 2000000]
  },
  {
    firstName: "Nikhil", lastName: "Bhatia", email: "nikhil.bhatia@techvantage.com",
    departmentCode: "SALES-01", role: "Sales Executive",
    experience: 3, salaryRange: [1400000, 1800000]
  }
];

class OrganizationSeeder {
  constructor() {
    this.organizationId = null;
    this.adminRoleId = null;
    this.adminUserId = null;
    this.departments = new Map();
    this.roles = new Map();
    this.permissions = [];
    this.employees = [];
    this.superAdminSessionCookies = null;
    this.adminSessionCookies = null;
    this.userTokens = new Map(); // Store user verification tokens
  }

  async run() {
    try {
      console.log('🏢 Starting Organization Seeder using APIs...');
      
      // Step 1: Login as super admin
      await this.loginAsSuperAdmin();
      
      // Step 2: Get subscription plan (Super Admin API)
      await this.getSubscriptionPlan();
      
      // Step 3: Create organization (Super Admin API)
      await this.createOrganization();
      
      // Step 4: Create admin role with all permissions (Super Admin API)
      await this.createAdminRole();
      
      // Step 5: Create admin user (Super Admin API)
      await this.createAdminUser();
      
      // Step 6: Activate admin user and set password
      await this.activateAdminUser();
      
      // Step 7: Login as admin to get session cookies
      await this.loginAsAdmin();
      
      // Step 8: Get all permissions
      await this.fetchPermissions();
      
      // Step 9: Create departments
      await this.createDepartments();
      
      // Step 10: Create roles with specific permissions
      await this.createRoles();
      
      // Step 11: Create employees
      await this.createEmployees();
      
      // Step 12: Generate additional employees to reach 50
      await this.generateAdditionalEmployees();
      
      // Step 13: Activate all employees and set passwords
      await this.activateAllEmployees();
      
      console.log('✅ Organization seeder completed successfully!');
      console.log(`📊 Created organization: ${COMPANY_DATA.name}`);
      console.log(`👥 Total employees: ${this.employees.length}`);
      console.log(`🏢 Total departments: ${this.departments.size}`);
      console.log(`🎭 Total roles: ${this.roles.size}`);
      console.log('🔐 All employees activated with password: "password"');
      
    } catch (error) {
      console.error('❌ Error in organization seeder:', error.response?.data || error.message);
      throw error;
    }
  }

  async loginAsSuperAdmin() {
    try {
      console.log('🔐 Logging in as super admin...');
      const loginResponse = await axios.post(`${BASE_URL}/super-admin/login`, SUPER_ADMIN_CREDENTIALS);
      
      // Extract cookies from response headers
      this.superAdminSessionCookies = loginResponse.headers['set-cookie'];
      console.log('✅ Logged in as super admin');
    } catch (error) {
      console.error('Error logging in as super admin:', error.response?.data || error.message);
      throw error;
    }
  }

  async getSubscriptionPlan() {
    try {
      const config = {};
      if (this.superAdminSessionCookies) {
        config.headers = { Cookie: this.superAdminSessionCookies.join('; ') };
      }

      const response = await axios.get(`${BASE_URL}/subscription-plans`, config);
      const activePlans = response.data.filter(plan => plan.isActive);
      
      if (activePlans.length === 0) {
        throw new Error('No active subscription plan found');
      }
      
      this.subscriptionPlanId = activePlans[0].id;
      console.log(`📋 Using subscription plan: ${activePlans[0].name}`);
    } catch (error) {
      console.error('Error fetching subscription plan:', error.response?.data || error.message);
      throw error;
    }
  }

  async createOrganization() {
    try {
      // Following OrganizationCreate.tsx pattern - using correct endpoint
      const payload = {
        name: COMPANY_DATA.name,
        industry: COMPANY_DATA.industry,
        subscriptionPlanId: this.subscriptionPlanId,
        isActive: true,
        settings: COMPANY_DATA.settings,
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      };

      const config = {};
      if (this.superAdminSessionCookies) {
        config.headers = { Cookie: this.superAdminSessionCookies.join('; ') };
      }

      // Changed from /organizations to /organization (singular)
      const response = await axios.post(`${BASE_URL}/organization`, payload, config);
      this.organizationId = response.data.id;
      console.log(`✅ Created organization: ${COMPANY_DATA.name} (${this.organizationId})`);
    } catch (error) {
      console.error('Error creating organization:', error.response?.data || error.message);
      throw error;
    }
  }

  async createAdminRole() {
    try {
      // Get all permissions first using super admin session
      const config = {};
      if (this.superAdminSessionCookies) {
        config.headers = { Cookie: this.superAdminSessionCookies.join('; ') };
      }

      // Changed from /permissions to /permission (singular)
      const permissionsResponse = await axios.get(`${BASE_URL}/permission`, config);
      this.permissions = permissionsResponse.data || [];
      
      // Following OrganizationCreate.tsx pattern
      const payload = {
        orgId: this.organizationId,
        name: 'Org_Admin',
        description: 'Organization Administrator with full access',
        permissions: [],
        isDefault: true
      };

      // Changed from /roles to /role (singular)
      const response = await axios.post(`${BASE_URL}/role`, payload, config);
      this.adminRoleId = response.data.id;
      
      // Update role with all permissions - following RoleManagementDashboard.tsx pattern
      await axios.put(`${BASE_URL}/role/${this.adminRoleId}`, {
        permissions: this.permissions.map(p => p.id)
      }, config);
      
      this.roles.set('Org_Admin', this.adminRoleId);
      console.log(`✅ Created admin role with ${this.permissions.length} permissions`);
    } catch (error) {
      console.error('Error creating admin role:', error.response?.data || error.message);
      throw error;
    }
  }

  async createAdminUser() {
    try {
      const config = {};
      if (this.superAdminSessionCookies) {
        config.headers = { Cookie: this.superAdminSessionCookies.join('; ') };
      }

      // Following OrganizationCreate.tsx pattern for user creation
      const userPayload = {
        email: 'admin@techvantage.com',
        firstName: 'System',
        lastName: 'Administrator',
        orgId: this.organizationId
      };

      // Changed from /users to /user (singular)
      const userResponse = await axios.post(`${BASE_URL}/user`, userPayload, config);
      this.adminUserId = userResponse.data.user.id;
      
      // Store verification token for later activation
      if (userResponse.data.verificationToken) {
        this.userTokens.set(this.adminUserId, userResponse.data.verificationToken);
      }
      
      // Assign role to user - following OrganizationCreate.tsx pattern
      const roleAssignmentPayload = {
        userId: this.adminUserId,
        roleId: this.adminRoleId
      };
      
      // Changed from /user-roles to /user-role (singular)
      await axios.post(`${BASE_URL}/user-role`, roleAssignmentPayload, config);
      
      console.log(`✅ Created admin user: admin@techvantage.com`);
    } catch (error) {
      console.error('Error creating admin user:', error.response?.data || error.message);
      throw error;
    }
  }

  async activateAdminUser() {
    try {
      const verificationToken = this.userTokens.get(this.adminUserId);
      if (verificationToken) {
        // Following SetPassword.tsx pattern
        await axios.post(`${BASE_URL}/auth/set-password`, {
          password: 'password',
          verificationToken: verificationToken
        });
        console.log('✅ Activated admin user and set password');
      } else {
        console.warn('⚠️ No verification token found for admin user');
      }
    } catch (error) {
      console.error('Error activating admin user:', error.response?.data || error.message);
      // Don't throw error, continue with seeding
    }
  }

  async loginAsAdmin() {
    try {
      // Login as admin to get session cookies for subsequent API calls
      const loginResponse = await axios.post(`http://localhost:3000/api/v1/general/login`, {
        email: 'admin@techvantage.com',
        password: 'password'
      });
      
      // Extract cookies from response headers
      this.adminSessionCookies = loginResponse.headers['set-cookie'];
      console.log('✅ Logged in as admin user');
    } catch (error) {
      console.error('Error logging in as admin:', error.response?.data || error.message);
      // Continue without login cookies, some endpoints might work without authentication
    }
  }

  async fetchPermissions() {
    try {
      const config = {};
      if (this.adminSessionCookies) {
        config.headers = { Cookie: this.adminSessionCookies.join('; ') };
      }
      
      // Changed from /permissions to /permission (singular)
      const response = await axios.get(`${BASE_URL}/permission`, config);
      this.permissions = response.data || [];
      console.log(`📋 Fetched ${this.permissions.length} permissions`);
    } catch (error) {
      console.error('Error fetching permissions:', error.response?.data || error.message);
    }
  }

  async createDepartments() {
    // First pass: Create all departments following Create.tsx pattern
    for (const deptData of DEPARTMENTS_DATA) {
      try {
        const payload = {
          name: deptData.name,
          code: deptData.code,
          description: deptData.description,
          location: deptData.location,
          budget: deptData.budget,
          status: true,
          orgId: this.organizationId,
          headId: null,
          parentId: null
        };

        const config = {};
        if (this.adminSessionCookies) {
          config.headers = { Cookie: this.adminSessionCookies.join('; ') };
        }

        // Changed from /departments to /department (singular)
        const response = await axios.post(`${BASE_URL}/department`, payload, config);
        this.departments.set(deptData.code, response.data.id);
        console.log(`✅ Created department: ${deptData.name} (${deptData.code})`);
      } catch (error) {
        console.error(`Error creating department ${deptData.name}:`, error.response?.data || error.message);
      }
    }
    
    // Second pass: Set parent relationships
    for (const deptData of DEPARTMENTS_DATA) {
      if (deptData.parentCode) {
        try {
          const parentId = this.departments.get(deptData.parentCode);
          const departmentId = this.departments.get(deptData.code);
          
          if (parentId && departmentId) {
            const config = {};
            if (this.adminSessionCookies) {
              config.headers = { Cookie: this.adminSessionCookies.join('; ') };
            }

            // Changed from /departments to /department (singular)
            await axios.put(`${BASE_URL}/department/${departmentId}`, {
              parentId: parentId
            }, config);
            
            console.log(`🔗 Set parent for ${deptData.name} -> ${deptData.parentCode}`);
          }
        } catch (error) {
          console.error(`Error setting parent for ${deptData.name}:`, error.response?.data || error.message);
        }
      }
    }
  }

  async createRoles() {
    for (const roleData of ROLES_DATA) {
      try {
        // Following RoleAssignment.tsx pattern for role creation
        const rolePermissions = this.getPermissionsForRole(roleData.permissionCategories);
        
        const payload = {
          orgId: this.organizationId,
          name: roleData.name,
          description: roleData.description,
          permissions: rolePermissions.map(permissionId => ({ permissionId }))
        };

        const config = {};
        if (this.adminSessionCookies) {
          config.headers = { Cookie: this.adminSessionCookies.join('; ') };
        }

        // Changed from /roles to /role (singular)
        const response = await axios.post(`${BASE_URL}/role`, payload, config);
        this.roles.set(roleData.name, response.data.id);
        
        console.log(`✅ Created role: ${roleData.name} with ${rolePermissions.length} permissions`);
      } catch (error) {
        console.error(`Error creating role ${roleData.name}:`, error.response?.data || error.message);
      }
    }
  }

  getPermissionsForRole(categories) {
    if (categories.includes('all')) {
      return this.permissions.map(p => p.id);
    }
    
    const permissionIds = [];
    
    for (const category of categories) {
      const categoryPermissions = this.permissions.filter(p => {
        const permissionName = p.name.toLowerCase();
        const categoryLower = category.toLowerCase();
        
        switch (categoryLower) {
          case 'organization':
            return permissionName.includes('organization') || permissionName.includes('billing');
          case 'department':
            return permissionName.includes('department');
          case 'employee':
            return permissionName.includes('employee') || permissionName.includes('user');
          case 'info':
            return permissionName.includes('information') || permissionName.includes('details') || permissionName.includes('personal');
          case 'attendance':
            return permissionName.includes('attendance');
          case 'leave':
            return permissionName.includes('leave');
          case 'salary':
            return permissionName.includes('salary');
          case 'role':
            return permissionName.includes('role');
          default:
            return false;
        }
      });
      
      permissionIds.push(...categoryPermissions.map(p => p.id));
    }
    
    return [...new Set(permissionIds)]; // Remove duplicates
  }

  async createEmployees() {
    for (const empData of EMPLOYEE_TEMPLATES) {
      await this.createEmployee(empData);
    }
  }

  async createEmployee(empData) {
    try {
      // Generate realistic employee data following CreateEmployeeNew.tsx pattern
      const employeeId = `EMP${String(this.employees.length + 1).padStart(3, '0')}`;
      const annualSalary = faker.number.int({ 
        min: empData.salaryRange[0], 
        max: empData.salaryRange[1] 
      });
      const monthlySalary = Math.round(annualSalary / 12);
      
      // Generate realistic personal details
      const dateOfBirth = faker.date.between({ 
        from: new Date(1985, 0, 1), 
        to: new Date(1998, 11, 31) 
      });
      const hiredDate = faker.date.between({ 
        from: new Date(2020, 0, 1), 
        to: new Date(2024, 11, 31) 
      });
      
      // Following CreateEmployeeNew.tsx form structure
      const employeePayload = {
        data: {
          // Basic Details
          firstName: empData.firstName,
          lastName: empData.lastName,
          email: empData.email,
          mobileNumber: `+91${faker.number.int({ min: 7000000000, max: 9999999999 })}`,
          emergencyContact: `+91${faker.number.int({ min: 7000000000, max: 9999999999 })}`,
          dateOfBirth: dateOfBirth.toISOString().split('T')[0],
          address: faker.location.streetAddress({ useFullAddress: true }) + ', Bangalore, Karnataka, India',
          adharNumber: faker.number.int({ min: 100000000000, max: 999999999999 }).toString(),
          panNumber: faker.string.alphanumeric({ length: 10, casing: 'upper' }),
          employeeId: employeeId,
          hiredDate: hiredDate.toISOString().split('T')[0],

          // Bank Details
          accountHolder: `${empData.firstName} ${empData.lastName}`,
          accountNumber: faker.number.int({ min: 10000000000, max: 99999999999 }).toString(),
          ifscCode: `${faker.string.alpha({ length: 4, casing: 'upper' })}0${faker.number.int({ min: 100000, max: 999999 })}`,
          bankName: faker.company.name() + ' Bank',

          // Salary Details
          annualPackage: annualSalary,
          monthlySalary: monthlySalary,
          hraPercentage: faker.number.int({ min: 8, max: 15 }),
          daPercentage: faker.number.int({ min: 5, max: 12 }),
          taPercentage: faker.number.int({ min: 3, max: 8 }),
          pfPercentage: faker.number.int({ min: 10, max: 12 }),
          taxPercentage: this.calculateTaxPercentage(annualSalary),
          insuranceFixed: faker.number.int({ min: 5000, max: 15000 }),

          // Role Assignment
          departmentId: this.departments.get(empData.departmentCode),
          roleIds: [this.roles.get(empData.role)].filter(Boolean),
          managerId: await this.getManagerForDepartment(empData.departmentCode, empData.role)
        },
        orgId: this.organizationId
      };

      const config = {};
      if (this.adminSessionCookies) {
        config.headers = { Cookie: this.adminSessionCookies.join('; ') };
      }

      // Kept as /organization/employees (this is correct based on organization.router.js)
      const response = await axios.post(`${BASE_URL}/organization/employees`, employeePayload, config);
      
      // Store verification token for later activation
      if (response.data?.verificationToken) {
        this.userTokens.set(response.data.user.id, response.data.verificationToken);
      }
      
      // Set as department head if specified
      if (empData.isHead && response.data?.user?.id) {
        try {
          const departmentId = this.departments.get(empData.departmentCode);
          if (departmentId) {
            await axios.put(`${BASE_URL}/department/${departmentId}`, {
              headId: response.data.user.id
            }, config);
          }
        } catch (error) {
          console.error(`Error setting department head for ${empData.firstName}:`, error.response?.data || error.message);
        }
      }
      
      this.employees.push({
        userId: response.data?.user?.id,
        employeeId: employeeId,
        email: empData.email,
        name: `${empData.firstName} ${empData.lastName}`,
        department: empData.departmentCode,
        role: empData.role,
        verificationToken: response.data?.verificationToken
      });
      
      console.log(`✅ Created employee: ${empData.firstName} ${empData.lastName} (${empData.role})`);
    } catch (error) {
      console.error(`Error creating employee ${empData.firstName} ${empData.lastName}:`, error.response?.data || error.message);
    }
  }

  async getManagerForDepartment(departmentCode, role) {
    // Find an appropriate manager based on department and role hierarchy
    const departmentEmployees = this.employees.filter(emp => emp.department === departmentCode);
    
    // If this is a manager role, report to department head or CEO
    if (role.includes('Manager') || role.includes('Director') || role === 'CTO') {
      const ceo = this.employees.find(emp => emp.role === 'CEO');
      return ceo ? ceo.userId : this.adminUserId;
    }
    
    // Find a manager in the same department
    const manager = departmentEmployees.find(emp => 
      emp.role.includes('Manager') || emp.role.includes('Director')
    );
    
    if (manager) {
      return manager.userId;
    }
    
    // Default to admin
    return this.adminUserId;
  }

  calculateTaxPercentage(annualSalary) {
    // Simple tax calculation based on Indian tax slabs
    if (annualSalary <= 250000) return 0;
    if (annualSalary <= 500000) return 5;
    if (annualSalary <= 1000000) return 20;
    return 30;
  }

  async generateAdditionalEmployees() {
    const targetCount = 50;
    const currentCount = this.employees.length;
    const needed = targetCount - currentCount;
    
    if (needed <= 0) {
      console.log(`✅ Already have ${currentCount} employees`);
      return;
    }
    
    console.log(`🔄 Generating ${needed} additional employees...`);
    
    const engineeringRoles = ['Software Engineer', 'QA Engineer', 'DevOps Engineer', 'UI/UX Designer'];
    const generalRoles = ['Sales Executive', 'Accountant', 'HR Manager'];
    
    for (let i = 0; i < needed; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@techvantage.com`;
      
      // Randomly assign to departments with weighted distribution
      const departmentCode = faker.helpers.weightedArrayElement([
        { weight: 30, value: 'BE-01' },
        { weight: 25, value: 'FE-01' },
        { weight: 15, value: 'QA-01' },
        { weight: 10, value: 'DEVOPS-01' },
        { weight: 8, value: 'SALES-01' },
        { weight: 7, value: 'FIN-01' },
        { weight: 5, value: 'HR-01' }
      ]);
      
      // Select appropriate role based on department
      let role;
      if (['BE-01', 'FE-01', 'QA-01', 'DEVOPS-01'].includes(departmentCode)) {
        role = faker.helpers.arrayElement(engineeringRoles);
      } else {
        role = faker.helpers.arrayElement(generalRoles);
      }
      
      const experience = faker.number.int({ min: 1, max: 8 });
      const baseSalary = this.calculateSalaryForRole(role, experience);
      
      const empData = {
        firstName,
        lastName,
        email,
        departmentCode,
        role,
        experience,
        salaryRange: [baseSalary * 0.9, baseSalary * 1.1]
      };
      
      await this.createEmployee(empData);
    }
    
    console.log(`✅ Generated ${needed} additional employees`);
  }

  calculateSalaryForRole(role, experience) {
    const baseSalaries = {
      'Software Engineer': 1200000,
      'QA Engineer': 1100000,
      'DevOps Engineer': 1400000,
      'UI/UX Designer': 1300000,
      'Sales Executive': 1000000,
      'Accountant': 800000,
      'HR Manager': 1500000
    };
    
    const base = baseSalaries[role] || 1000000;
    const experienceMultiplier = 1 + (experience * 0.15);
    
    return Math.round(base * experienceMultiplier);
  }

  async activateAllEmployees() {
    console.log('🔐 Activating all employees and setting passwords...');
    
    let activatedCount = 0;
    
    for (const employee of this.employees) {
      try {
        const verificationToken = this.userTokens.get(employee.userId) || employee.verificationToken;
        
        if (verificationToken) {
          // Following SetPassword.tsx pattern
          await axios.post(`${BASE_URL}/auth/set-password`, {
            password: 'password',
            verificationToken: verificationToken
          });
          
          activatedCount++;
          console.log(`✅ Activated employee: ${employee.name}`);
        } else {
          console.warn(`⚠️ No verification token found for employee: ${employee.name}`);
        }
        
        // Add small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error activating employee ${employee.name}:`, error.response?.data || error.message);
      }
    }
    
    console.log(`✅ Successfully activated ${activatedCount} out of ${this.employees.length} employees`);
    console.log('🔑 All activated employees can login with password: "password"');
  }
}

export async function seedOrganization() {
  const seeder = new OrganizationSeeder();
  await seeder.run();
}

// Export class for direct use
export { OrganizationSeeder };

// Run directly if this file is executed (ES module check)
if (import.meta.url === `file://${process.argv[1]}`) {
  seedOrganization()
    .catch((error) => {
      console.error('❌ Seeder failed:', error);
      process.exit(1);
    });
}
