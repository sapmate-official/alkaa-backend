import axios from 'axios';

// Base URL for API calls
const BASE_URL = 'http://localhost:3000/api/v2';

// Admin credentials to login and get session cookies
const ADMIN_CREDENTIALS = {
  email: 'admin@techvantage.com',
  password: 'password'
};

/**
 * Complete Department Hierarchy Setup
 * 
 * This script performs the following operations using only API calls:
 * 1. Assigns department heads based on organizational hierarchy
 * 2. Sets up manager-employee relationships within departments
 * 3. Establishes cross-departmental reporting structures
 * 4. Validates the final organizational structure
 */

// Enhanced department head assignments with hierarchical structure
const ORGANIZATIONAL_HIERARCHY = [
  {
    departmentCode: "EXEC-01",
    headEmail: "rajesh.sharma@techvantage.com",
    headRole: "CEO",
    reportsTo: null, // CEO reports to no one
    manageDepartments: ["IT-01", "HR-01", "FIN-01", "SALES-01"] // CEO manages other department heads
  },
  {
    departmentCode: "IT-01", 
    headEmail: "priya.patel@techvantage.com",
    headRole: "CTO",
    reportsTo: "rajesh.sharma@techvantage.com", // CTO reports to CEO
    manageDepartments: ["BE-01", "FE-01", "QA-01", "DEVOPS-01"] // CTO manages IT sub-departments
  },
  {
    departmentCode: "HR-01",
    headEmail: "anita.reddy@techvantage.com",
    headRole: "HR Director",
    reportsTo: "rajesh.sharma@techvantage.com", // HR Director reports to CEO
    manageDepartments: ["TA-01"] // HR Director manages Talent Acquisition
  },
  {
    departmentCode: "FIN-01",
    headEmail: "madhuri.kulkarni@techvantage.com",
    headRole: "Finance Manager",
    reportsTo: "rajesh.sharma@techvantage.com", // Finance Manager reports to CEO
    manageDepartments: []
  },
  {
    departmentCode: "SALES-01",
    headEmail: "gaurav.sinha@techvantage.com",
    headRole: "Sales Manager",
    reportsTo: "rajesh.sharma@techvantage.com", // Sales Manager reports to CEO
    manageDepartments: []
  },
  {
    departmentCode: "BE-01",
    headEmail: "arjun.kumar@techvantage.com",
    headRole: "Engineering Manager",
    reportsTo: "priya.patel@techvantage.com", // Backend Manager reports to CTO
    manageDepartments: []
  },
  {
    departmentCode: "FE-01",
    headEmail: "karan.malhotra@techvantage.com",
    headRole: "Engineering Manager",
    reportsTo: "priya.patel@techvantage.com", // Frontend Manager reports to CTO
    manageDepartments: []
  },
  {
    departmentCode: "QA-01",
    headEmail: "shweta.bansal@techvantage.com",
    headRole: "Engineering Manager",
    reportsTo: "priya.patel@techvantage.com", // QA Manager reports to CTO
    manageDepartments: []
  },
  {
    departmentCode: "DEVOPS-01",
    headEmail: "sanjay.iyer@techvantage.com",
    headRole: "Engineering Manager",
    reportsTo: "priya.patel@techvantage.com", // DevOps Manager reports to CTO
    manageDepartments: []
  },
  {
    departmentCode: "TA-01",
    headEmail: "sneha.agarwal@techvantage.com",
    headRole: "Talent Acquisition Specialist",
    reportsTo: "anita.reddy@techvantage.com", // TA Specialist reports to HR Director
    manageDepartments: []
  }
];

class CompleteHierarchySetup {
  constructor() {
    this.adminSessionCookies = null;
    this.organizationId = null;
    this.departments = new Map(); // code -> department data
    this.users = new Map(); // email -> user data
    this.usersByDepartment = new Map(); // departmentId -> [users]
  }

  async run() {
    try {
      console.log('🏗️ Starting Complete Department Hierarchy Setup...');
      console.log('=' .repeat(80));
      
      // Step 1: Authentication and data fetching
      await this.loginAsAdmin();
      await this.fetchOrganizationData();
      await this.fetchUsers();
      await this.organizeUsersByDepartment();
      
      // Step 2: Department head assignments
      await this.assignDepartmentHeads();
      
      // Step 3: Hierarchical manager assignments
      await this.setupHierarchicalReporting();
      
      // Step 4: Department-level employee assignments
      await this.assignDepartmentEmployeeManagers();
      
      // Step 5: Validation and reporting
      await this.validateHierarchy();
      await this.generateHierarchyReport();
      
      console.log('=' .repeat(80));
      console.log('✅ Complete Department Hierarchy Setup completed successfully!');
      
    } catch (error) {
      console.error('❌ Error in complete hierarchy setup:', error.response?.data || error.message);
      throw error;
    }
  }

  async loginAsAdmin() {
    try {
      console.log('🔐 Authenticating as admin...');
      const loginResponse = await axios.post(`http://localhost:3000/api/v1/general/login`, ADMIN_CREDENTIALS);
      
      this.adminSessionCookies = loginResponse.headers['set-cookie'];
      console.log('✅ Authentication successful');
    } catch (error) {
      console.error('Error logging in as admin:', error.response?.data || error.message);
      throw error;
    }
  }

  async fetchOrganizationData() {
    try {
      console.log('📋 Fetching organization and department data...');
      
      const config = this.getRequestConfig();

      // Get organization
      const orgResponse = await axios.get(`${BASE_URL}/organization`, config);
      
      if (orgResponse.data && orgResponse.data.length > 0) {
        this.organizationId = orgResponse.data[0].id;
      } else {
        throw new Error('No organization found');
      }

      // Get all departments
      const deptResponse = await axios.get(`${BASE_URL}/department/org/${this.organizationId}`, config);
      
      if (deptResponse.data && deptResponse.data.length > 0) {
        deptResponse.data.forEach(dept => {
          this.departments.set(dept.code, {
            id: dept.id,
            name: dept.name,
            code: dept.code,
            headId: dept.headId,
            parentId: dept.parentId
          });
        });
        console.log(`✅ Loaded ${this.departments.size} departments`);
      }
      
    } catch (error) {
      console.error('Error fetching organization data:', error.response?.data || error.message);
      throw error;
    }
  }

  async fetchUsers() {
    try {
      console.log('👥 Fetching all organization users...');
      
      const config = this.getRequestConfig();
      const response = await axios.get(`${BASE_URL}/user/org/${this.organizationId}`, config);
      
      if (response.data && response.data.length > 0) {
        response.data.forEach(user => {
          this.users.set(user.email, {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            employeeId: user.employeeId,
            departmentId: user.departmentId,
            managerId: user.managerId
          });
        });
        console.log(`✅ Loaded ${this.users.size} users`);
      }
      
    } catch (error) {
      console.error('Error fetching users:', error.response?.data || error.message);
      throw error;
    }
  }

  async organizeUsersByDepartment() {
    console.log('🗂️ Organizing users by department...');
    
    for (const [email, user] of this.users) {
      if (user.departmentId) {
        if (!this.usersByDepartment.has(user.departmentId)) {
          this.usersByDepartment.set(user.departmentId, []);
        }
        this.usersByDepartment.get(user.departmentId).push(user);
      }
    }
    
    console.log(`✅ Organized users across ${this.usersByDepartment.size} departments`);
  }

  async assignDepartmentHeads() {
    console.log('\n👑 Phase 1: Assigning Department Heads');
    console.log('-' .repeat(50));
    
    const config = this.getRequestConfig();
    
    for (const hierarchy of ORGANIZATIONAL_HIERARCHY) {
      try {
        const department = this.departments.get(hierarchy.departmentCode);
        const user = this.users.get(hierarchy.headEmail);
        
        if (!department || !user) {
          console.warn(`⚠️ Skipping ${hierarchy.departmentCode} - missing department or user`);
          continue;
        }

        if (department.headId === user.id) {
          console.log(`ℹ️ ${user.firstName} ${user.lastName} already heads ${department.name}`);
          continue;
        }

        // Assign department head
        await axios.put(`${BASE_URL}/department/${department.id}/head/${user.id}`, {}, config);
        
        console.log(`✅ ${user.firstName} ${user.lastName} → Head of ${department.name}`);
        
        // Update local data
        department.headId = user.id;
        
        await this.delay(100);
        
      } catch (error) {
        console.error(`❌ Error assigning head for ${hierarchy.departmentCode}:`, error.response?.data || error.message);
      }
    }
  }

  async setupHierarchicalReporting() {
    console.log('\n👨‍💼 Phase 2: Setting Up Hierarchical Reporting');
    console.log('-' .repeat(50));
    
    const config = this.getRequestConfig();
    
    // First, set up manager relationships for department heads
    for (const hierarchy of ORGANIZATIONAL_HIERARCHY) {
      try {
        if (!hierarchy.reportsTo) continue; // Skip CEO who reports to no one
        
        const subordinate = this.users.get(hierarchy.headEmail);
        const manager = this.users.get(hierarchy.reportsTo);
        
        if (!subordinate || !manager) {
          console.warn(`⚠️ Skipping hierarchy setup for ${hierarchy.headEmail} - missing users`);
          continue;
        }

        if (subordinate.managerId === manager.id) {
          console.log(`ℹ️ ${subordinate.firstName} ${subordinate.lastName} already reports to ${manager.firstName} ${manager.lastName}`);
          continue;
        }

        // Update manager relationship
        await axios.put(`${BASE_URL}/user/${subordinate.id}`, {
          managerId: manager.id
        }, config);
        
        console.log(`✅ ${subordinate.firstName} ${subordinate.lastName} → Reports to ${manager.firstName} ${manager.lastName}`);
        
        // Update local data
        subordinate.managerId = manager.id;
        
        await this.delay(100);
        
      } catch (error) {
        console.error(`❌ Error setting up reporting for ${hierarchy.headEmail}:`, error.response?.data || error.message);
      }
    }
  }

  async assignDepartmentEmployeeManagers() {
    console.log('\n👥 Phase 3: Assigning Department Employee Managers');
    console.log('-' .repeat(50));
    
    const config = this.getRequestConfig();
    
    for (const [departmentId, employees] of this.usersByDepartment) {
      try {
        // Find department head
        const department = Array.from(this.departments.values()).find(d => d.id === departmentId);
        if (!department || !department.headId) continue;
        
        const departmentHead = Array.from(this.users.values()).find(u => u.id === department.headId);
        if (!departmentHead) continue;
        
        console.log(`\n🏢 Processing ${department.name}:`);
        console.log(`  👑 Head: ${departmentHead.firstName} ${departmentHead.lastName}`);
        
        // Get employees excluding the head
        const departmentEmployees = employees.filter(emp => emp.id !== department.headId);
        
        if (departmentEmployees.length === 0) {
          console.log(`  ℹ️ No other employees in this department`);
          continue;
        }
        
        console.log(`  👥 Assigning ${departmentEmployees.length} employees to manager:`);
        
        for (const employee of departmentEmployees) {
          try {
            if (employee.managerId === departmentHead.id) {
              console.log(`    ℹ️ ${employee.firstName} ${employee.lastName} already reports to head`);
              continue;
            }
            
            // Assign department head as manager
            await axios.put(`${BASE_URL}/user/${employee.id}`, {
              managerId: departmentHead.id
            }, config);
            
            console.log(`    ✅ ${employee.firstName} ${employee.lastName} → ${departmentHead.firstName} ${departmentHead.lastName}`);
            
            // Update local data
            employee.managerId = departmentHead.id;
            
            await this.delay(100);
            
          } catch (error) {
            console.error(`    ❌ Error assigning manager for ${employee.firstName} ${employee.lastName}:`, error.response?.data || error.message);
          }
        }
        
      } catch (error) {
        console.error(`❌ Error processing department ${departmentId}:`, error);
      }
    }
  }

  async validateHierarchy() {
    console.log('\n🔍 Phase 4: Validating Organizational Hierarchy');
    console.log('-' .repeat(50));
    
    let validationErrors = 0;
    
    // Check 1: All departments should have heads
    for (const [code, department] of this.departments) {
      if (!department.headId) {
        console.error(`❌ Department ${department.name} (${code}) has no head assigned`);
        validationErrors++;
      }
    }
    
    // Check 2: All employees should have managers (except CEO)
    const ceoUser = this.users.get('rajesh.sharma@techvantage.com');
    for (const [email, user] of this.users) {
      if (user.id !== ceoUser?.id && !user.managerId) {
        console.error(`❌ User ${user.firstName} ${user.lastName} (${email}) has no manager assigned`);
        validationErrors++;
      }
    }
    
    // Check 3: Department heads should manage their department employees
    for (const [departmentId, employees] of this.usersByDepartment) {
      const department = Array.from(this.departments.values()).find(d => d.id === departmentId);
      if (!department?.headId) continue;
      
      const orphanedEmployees = employees.filter(emp => 
        emp.id !== department.headId && emp.managerId !== department.headId
      );
      
      if (orphanedEmployees.length > 0) {
        console.warn(`⚠️ Department ${department.name} has ${orphanedEmployees.length} employees not managed by department head`);
        orphanedEmployees.forEach(emp => {
          console.warn(`    - ${emp.firstName} ${emp.lastName} managed by: ${emp.managerId || 'none'}`);
        });
      }
    }
    
    if (validationErrors === 0) {
      console.log('✅ Hierarchy validation passed - no critical errors found');
    } else {
      console.warn(`⚠️ Hierarchy validation completed with ${validationErrors} errors`);
    }
  }

  async generateHierarchyReport() {
    console.log('\n📊 Final Organizational Hierarchy Report');
    console.log('=' .repeat(80));
    
    try {
      const config = this.getRequestConfig();
      const response = await axios.get(`${BASE_URL}/organization/${this.organizationId}/chart`, config);
      
      if (response.data?.departments) {
        console.log(`\n🏢 Organization: ${response.data.name || 'TechVantage Solutions'}`);
        console.log(`📈 Total Departments: ${response.data.departments.length}`);
        console.log(`👥 Total Users: ${response.data.users?.length || 0}`);
        
        // Group departments by hierarchy level
        const rootDepartments = response.data.departments.filter(d => !d.parentDepartment);
        const subDepartments = response.data.departments.filter(d => d.parentDepartment);
        
        console.log('\n📁 Department Structure:');
        
        rootDepartments.forEach(dept => {
          this.printDepartmentHierarchy(dept, response.data.departments, 0);
        });
        
        console.log('\n👑 Department Heads Summary:');
        response.data.departments.forEach(dept => {
          const headInfo = dept.departmentHead ? 
            `${dept.departmentHead.firstName} ${dept.departmentHead.lastName} (${dept.departmentHead.email})` : 
            'No head assigned';
          console.log(`  ${dept.name}: ${headInfo}`);
        });
        
        console.log('\n📊 Department Employee Counts:');
        response.data.departments.forEach(dept => {
          const employeeCount = dept.users?.length || 0;
          console.log(`  ${dept.name}: ${employeeCount} employees`);
        });
      }
      
    } catch (error) {
      console.error('Error generating hierarchy report:', error.response?.data || error.message);
    }
  }

  printDepartmentHierarchy(department, allDepartments, level) {
    const indent = '  '.repeat(level);
    const headInfo = department.departmentHead ? 
      `👑 ${department.departmentHead.firstName} ${department.departmentHead.lastName}` : 
      '⚠️ No head';
    const employeeCount = department.users?.length || 0;
    
    console.log(`${indent}📁 ${department.name} (${employeeCount} employees) - ${headInfo}`);
    
    // Print sub-departments
    const subDepts = allDepartments.filter(d => d.parentDepartment?.id === department.id);
    subDepts.forEach(subDept => {
      this.printDepartmentHierarchy(subDept, allDepartments, level + 1);
    });
  }

  getRequestConfig() {
    const config = {};
    if (this.adminSessionCookies) {
      config.headers = { Cookie: this.adminSessionCookies.join('; ') };
    }
    return config;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export async function setupCompleteHierarchy() {
  const setup = new CompleteHierarchySetup();
  await setup.run();
}

// Export class for direct use
export { CompleteHierarchySetup };

// // Run directly if this file is executed
// if (import.meta.url === `file://${process.argv[1]}`) {
//     .catch((error) => {
//         console.error('❌ Complete hierarchy setup failed:', error);
//         process.exit(1);
//     });
// }

setupCompleteHierarchy()