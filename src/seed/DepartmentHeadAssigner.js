import axios from 'axios';

// Base URL for API calls
const BASE_URL = 'http://localhost:3000/api/v2';

// Admin credentials to login and get session cookies
const ADMIN_CREDENTIALS = {
  email: 'admin@techvantage.com',
  password: 'password'
};

// Department head assignments based on the hierarchy from OrganizationSeeder
const DEPARTMENT_HEAD_ASSIGNMENTS = [
  {
    departmentCode: "EXEC-01",
    headEmail: "rajesh.sharma@techvantage.com", // CEO
    headRole: "CEO"
  },
  {
    departmentCode: "IT-01", 
    headEmail: "priya.patel@techvantage.com", // CTO
    headRole: "CTO"
  },
  {
    departmentCode: "HR-01",
    headEmail: "anita.reddy@techvantage.com", // HR Director
    headRole: "HR Director"
  },
  {
    departmentCode: "FIN-01",
    headEmail: "madhuri.kulkarni@techvantage.com", // Finance Manager
    headRole: "Finance Manager"
  },
  {
    departmentCode: "SALES-01",
    headEmail: "gaurav.sinha@techvantage.com", // Sales Manager
    headRole: "Sales Manager"
  },
  {
    departmentCode: "BE-01",
    headEmail: "arjun.kumar@techvantage.com", // Engineering Manager (Backend)
    headRole: "Engineering Manager"
  },
  {
    departmentCode: "FE-01",
    headEmail: "karan.malhotra@techvantage.com", // Engineering Manager (Frontend)
    headRole: "Engineering Manager"
  },
  {
    departmentCode: "QA-01",
    headEmail: "shweta.bansal@techvantage.com", // Engineering Manager (QA)
    headRole: "Engineering Manager"
  },
  {
    departmentCode: "DEVOPS-01",
    headEmail: "sanjay.iyer@techvantage.com", // Engineering Manager (DevOps)
    headRole: "Engineering Manager"
  },
  {
    departmentCode: "TA-01",
    headEmail: "sneha.agarwal@techvantage.com", // Talent Acquisition Specialist
    headRole: "Talent Acquisition Specialist"
  }
];

class DepartmentHeadAssigner {
  constructor() {
    this.adminSessionCookies = null;
    this.organizationId = null;
    this.departments = new Map(); // code -> {id, name}
    this.users = new Map(); // email -> {id, name, departmentId}
  }

  async run() {
    try {
      console.log('🏢 Starting Department Head Assignment using APIs...');
      
      // Step 1: Login as admin to get session cookies
      await this.loginAsAdmin();
      
      // Step 2: Get organization ID and departments
      await this.fetchOrganizationData();
      
      // Step 3: Fetch all users in the organization
      await this.fetchUsers();
      
      // Step 4: Assign department heads
      await this.assignDepartmentHeads();
      
      // Step 5: Update manager assignments for department employees
      await this.updateManagerAssignments();
      
      console.log('✅ Department head assignment completed successfully!');
      
    } catch (error) {
      console.error('❌ Error in department head assigner:', error.response?.data || error.message);
      throw error;
    }
  }

  async loginAsAdmin() {
    try {
      console.log('🔐 Logging in as admin...');
      const loginResponse = await axios.post(`http://localhost:3000/api/v1/general/login`, ADMIN_CREDENTIALS);
      
      // Extract cookies from response headers
      this.adminSessionCookies = loginResponse.headers['set-cookie'];
      console.log('✅ Logged in as admin user');
    } catch (error) {
      console.error('Error logging in as admin:', error.response?.data || error.message);
      throw error;
    }
  }

  async fetchOrganizationData() {
    try {
      console.log('📋 Fetching organization data...');
      
      const config = {};
      if (this.adminSessionCookies) {
        config.headers = { Cookie: this.adminSessionCookies.join('; ') };
      }

      // Get organization (assuming there's only one for the admin)
      const orgResponse = await axios.get(`${BASE_URL}/organization`, config);
      
      if (orgResponse.data && orgResponse.data.length > 0) {
        this.organizationId = orgResponse.data[0].id;
        console.log(`✅ Found organization: ${orgResponse.data[0].name} (${this.organizationId})`);
      } else {
        throw new Error('No organization found');
      }

      // Get all departments for this organization
      const deptResponse = await axios.get(`${BASE_URL}/department/org/${this.organizationId}`, config);
      
      if (deptResponse.data && deptResponse.data.length > 0) {
        deptResponse.data.forEach(dept => {
          this.departments.set(dept.code, {
            id: dept.id,
            name: dept.name,
            code: dept.code,
            currentHeadId: dept.headId
          });
        });
        console.log(`✅ Fetched ${this.departments.size} departments`);
      }
      
    } catch (error) {
      console.error('Error fetching organization data:', error.response?.data || error.message);
      throw error;
    }
  }

  async fetchUsers() {
    try {
      console.log('👥 Fetching all users in organization...');
      
      const config = {};
      if (this.adminSessionCookies) {
        config.headers = { Cookie: this.adminSessionCookies.join('; ') };
      }

      // Get all users in the organization
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
        console.log(`✅ Fetched ${this.users.size} users`);
      }
      
    } catch (error) {
      console.error('Error fetching users:', error.response?.data || error.message);
      throw error;
    }
  }

  async assignDepartmentHeads() {
    console.log('👑 Assigning department heads...');
    
    for (const assignment of DEPARTMENT_HEAD_ASSIGNMENTS) {
      try {
        const department = this.departments.get(assignment.departmentCode);
        const user = this.users.get(assignment.headEmail);
        
        if (!department) {
          console.warn(`⚠️ Department not found: ${assignment.departmentCode}`);
          continue;
        }
        
        if (!user) {
          console.warn(`⚠️ User not found: ${assignment.headEmail}`);
          continue;
        }

        // Check if this user is already the head of this department
        if (department.currentHeadId === user.id) {
          console.log(`ℹ️ ${user.firstName} ${user.lastName} is already head of ${department.name}`);
          continue;
        }

        const config = {};
        if (this.adminSessionCookies) {
          config.headers = { Cookie: this.adminSessionCookies.join('; ') };
        }

        // Update department head using the API endpoint
        await axios.put(`${BASE_URL}/department/${department.id}/head/${user.id}`, {}, config);
        
        console.log(`✅ Assigned ${user.firstName} ${user.lastName} as head of ${department.name}`);
        
        // Update our local data
        department.currentHeadId = user.id;
        
      } catch (error) {
        console.error(`❌ Error assigning head for ${assignment.departmentCode}:`, error.response?.data || error.message);
      }
    }
  }

  async updateManagerAssignments() {
    console.log('👨‍💼 Updating manager assignments for department employees...');
    
    const config = {};
    if (this.adminSessionCookies) {
      config.headers = { Cookie: this.adminSessionCookies.join('; ') };
    }

    // For each department, make the head the manager of all employees in that department
    for (const [deptCode, department] of this.departments) {
      try {
        // Find the head of this department
        const headAssignment = DEPARTMENT_HEAD_ASSIGNMENTS.find(assignment => assignment.departmentCode === deptCode);
        if (!headAssignment) continue;
        
        const headUser = this.users.get(headAssignment.headEmail);
        if (!headUser) continue;

        // Find all employees in this department (excluding the head)
        const departmentEmployees = Array.from(this.users.values()).filter(user => 
          user.departmentId === department.id && 
          user.id !== headUser.id &&
          user.managerId !== headUser.id // Skip if already assigned
        );

        console.log(`🏢 Processing ${department.name}: ${departmentEmployees.length} employees to assign to ${headUser.firstName} ${headUser.lastName}`);

        // Update each employee's manager
        for (const employee of departmentEmployees) {
          try {
            // Update employee's manager using the user update API
            await axios.put(`${BASE_URL}/user/${employee.id}`, {
              managerId: headUser.id
            }, config);
            
            console.log(`  ✅ Assigned ${employee.firstName} ${employee.lastName} to manager ${headUser.firstName} ${headUser.lastName}`);
            
            // Update our local data
            employee.managerId = headUser.id;
            
            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (error) {
            console.error(`  ❌ Error updating manager for ${employee.firstName} ${employee.lastName}:`, error.response?.data || error.message);
          }
        }
        
      } catch (error) {
        console.error(`❌ Error processing department ${department.name}:`, error.response?.data || error.message);
      }
    }
  }

  async getManagerHierarchy() {
    console.log('🏗️ Current Manager Hierarchy:');
    
    const config = {};
    if (this.adminSessionCookies) {
      config.headers = { Cookie: this.adminSessionCookies.join('; ') };
    }

    try {
      // Get fresh organization data with hierarchy
      const response = await axios.get(`${BASE_URL}/organization/${this.organizationId}/chart`, config);
      
      if (response.data && response.data.departments) {
        response.data.departments.forEach(dept => {
          console.log(`\n📁 ${dept.name}:`);
          
          if (dept.departmentHead) {
            console.log(`  👑 Head: ${dept.departmentHead.firstName} ${dept.departmentHead.lastName} (${dept.departmentHead.email})`);
          } else {
            console.log(`  ⚠️  No head assigned`);
          }
          
          if (dept.users && dept.users.length > 0) {
            console.log(`  👥 Employees (${dept.users.length}):`);
            dept.users.forEach(user => {
              const managerInfo = user.manager ? 
                `Manager: ${user.manager.firstName} ${user.manager.lastName}` : 
                'No manager';
              console.log(`    - ${user.firstName} ${user.lastName} (${user.email}) - ${managerInfo}`);
            });
          }
        });
      }
      
    } catch (error) {
      console.error('Error fetching hierarchy:', error.response?.data || error.message);
    }
  }
}

export async function assignDepartmentHeads() {
  const assigner = new DepartmentHeadAssigner();
  await assigner.run();
  
  // Print the final hierarchy
  console.log('\n' + '='.repeat(80));
  await assigner.getManagerHierarchy();
}

// Export class for direct use
export { DepartmentHeadAssigner };

// Run directly if this file is executed (ES module check)
if (import.meta.url === `file://${process.argv[1]}`) {
  assignDepartmentHeads()
    .catch((error) => {
      console.error('❌ Department head assigner failed:', error);
      process.exit(1);
    });
}
