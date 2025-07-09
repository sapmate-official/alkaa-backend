import axios from 'axios';

// Base URL for API calls
const BASE_URL = 'http://localhost:3000/api/v2';

// Admin credentials to login and get session cookies
const ADMIN_CREDENTIALS = {
  email: 'admin@techvantage.com',
  password: 'password'
};

/**
 * Department Hierarchy Setup
 * 
 * This script assigns department heads based on the organizational hierarchy from OrganizationSeeder
 * and sets up proper manager-employee relationships using only API calls.
 * 
 * Hierarchy Structure:
 * - CEO (Rajesh Sharma) - Executive Leadership Head
 * - CTO (Priya Patel) - IT Department Head, reports to CEO
 * - HR Director (Anita Reddy) - HR Department Head, reports to CEO
 * - Finance Manager (Madhuri Kulkarni) - Finance Department Head, reports to CEO
 * - Sales Manager (Gaurav Sinha) - Sales Department Head, reports to CEO
 * - Engineering Managers report to CTO
 * - Talent Acquisition head reports to HR Director
 */

// Department head assignments based on the hierarchy from OrganizationSeeder
const DEPARTMENT_HEAD_ASSIGNMENTS = [
  {
    departmentCode: "EXEC-01",
    headEmail: "rajesh.sharma@techvantage.com", // CEO
    headRole: "CEO",
    reportsTo: null // CEO reports to no one
  },
  {
    departmentCode: "IT-01", 
    headEmail: "priya.patel@techvantage.com", // CTO
    headRole: "CTO",
    reportsTo: "rajesh.sharma@techvantage.com" // CTO reports to CEO
  },
  {
    departmentCode: "HR-01",
    headEmail: "anita.reddy@techvantage.com", // HR Director
    headRole: "HR Director",
    reportsTo: "rajesh.sharma@techvantage.com" // HR Director reports to CEO
  },
  {
    departmentCode: "FIN-01",
    headEmail: "madhuri.kulkarni@techvantage.com", // Finance Manager
    headRole: "Finance Manager",
    reportsTo: "rajesh.sharma@techvantage.com" // Finance Manager reports to CEO
  },
  {
    departmentCode: "SALES-01",
    headEmail: "gaurav.sinha@techvantage.com", // Sales Manager
    headRole: "Sales Manager",
    reportsTo: "rajesh.sharma@techvantage.com" // Sales Manager reports to CEO
  },
  {
    departmentCode: "BE-01",
    headEmail: "arjun.kumar@techvantage.com", // Engineering Manager (Backend)
    headRole: "Engineering Manager",
    reportsTo: "priya.patel@techvantage.com" // Backend Manager reports to CTO
  },
  {
    departmentCode: "FE-01",
    headEmail: "karan.malhotra@techvantage.com", // Engineering Manager (Frontend)
    headRole: "Engineering Manager",
    reportsTo: "priya.patel@techvantage.com" // Frontend Manager reports to CTO
  },
  {
    departmentCode: "QA-01",
    headEmail: "shweta.bansal@techvantage.com", // Engineering Manager (QA)
    headRole: "Engineering Manager",
    reportsTo: "priya.patel@techvantage.com" // QA Manager reports to CTO
  },
  {
    departmentCode: "DEVOPS-01",
    headEmail: "sanjay.iyer@techvantage.com", // Engineering Manager (DevOps)
    headRole: "Engineering Manager",
    reportsTo: "priya.patel@techvantage.com" // DevOps Manager reports to CTO
  },
  {
    departmentCode: "TA-01",
    headEmail: "sneha.agarwal@techvantage.com", // Talent Acquisition Specialist
    headRole: "Talent Acquisition Specialist",
    reportsTo: "anita.reddy@techvantage.com" // TA Specialist reports to HR Director
  }
];

class DepartmentHierarchySetup {
  constructor() {
    this.adminSessionCookies = null;
    this.organizationId = null;
    this.departments = new Map(); // code -> {id, name, headId}
    this.users = new Map(); // email -> {id, firstName, lastName, email, departmentId, managerId}
    this.assignmentResults = [];
  }

  async run() {
    try {
      console.log('🏢 Starting Department Hierarchy Setup using APIs...');
      console.log('=' .repeat(80));
      
      // Step 1: Login as admin to get session cookies
      await this.loginAsAdmin();
      
      // Step 2: Fetch organization data and departments
      await this.fetchOrganizationData();
      
      // Step 3: Fetch all users in the organization
      await this.fetchUsers();
      
      // Step 4: Assign department heads
      await this.assignDepartmentHeads();
      
      // Step 5: Set up manager reporting hierarchy
      await this.setupManagerHierarchy();
      
      // Step 6: Assign department employees to their heads as managers
      await this.assignDepartmentEmployeeManagers();
      
      // Step 7: Generate final report
      await this.generateFinalReport();
      
      console.log('\n✅ Department hierarchy setup completed successfully!');
      console.log('🎯 All department heads assigned and manager relationships established');
      
    } catch (error) {
      console.error('❌ Error in department hierarchy setup:', error.response?.data || error.message);
      throw error;
    }
  }

  async loginAsAdmin() {
    try {
      console.log('🔐 Logging in as admin...');
      const loginResponse = await axios.post(`http://localhost:3000/api/v1/general/login`, ADMIN_CREDENTIALS);
      
      // Extract cookies from response headers
      this.adminSessionCookies = loginResponse.headers['set-cookie'];
      console.log('✅ Successfully logged in as admin user');
    } catch (error) {
      console.error('❌ Error logging in as admin:', error.response?.data || error.message);
      throw error;
    }
  }

  async fetchOrganizationData() {
    try {
      console.log('\n📋 Fetching organization data...');
      
      const config = this.getRequestConfig();

      // Get organization
      const orgResponse = await axios.get(`${BASE_URL}/organization`, config);
      
      if (orgResponse.data && orgResponse.data.length > 0) {
        this.organizationId = orgResponse.data[0].id;
        console.log(`✅ Found organization: ${orgResponse.data[0].name} (${this.organizationId})`);
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
      console.error('❌ Error fetching organization data:', error.response?.data || error.message);
      throw error;
    }
  }

  async fetchUsers() {
    try {
      console.log('\n👥 Fetching all organization users...');
      
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
      console.error('❌ Error fetching users:', error.response?.data || error.message);
      throw error;
    }
  }

  async assignDepartmentHeads() {
    console.log('\n👑 Phase 1: Assigning Department Heads');
    console.log('-' .repeat(50));
    
    const config = this.getRequestConfig();
    
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

        // Check if user is already the head
        if (department.headId === user.id) {
          console.log(`ℹ️ ${user.firstName} ${user.lastName} already heads ${department.name}`);
          this.assignmentResults.push({
            department: assignment.departmentCode,
            head: assignment.headEmail,
            status: 'already_assigned',
            action: 'skipped'
          });
          continue;
        }

        // Assign department head
        await axios.put(`${BASE_URL}/department/${department.id}/head/${user.id}`, {}, config);
        
        console.log(`✅ Assigned ${user.firstName} ${user.lastName} as head of ${department.name}`);
        
        // Update local data
        department.headId = user.id;
        
        this.assignmentResults.push({
          department: assignment.departmentCode,
          head: assignment.headEmail,
          status: 'success',
          action: 'assigned'
        });
        
        // Small delay to avoid overwhelming the API
        await this.delay(200);
        
      } catch (error) {
        console.error(`❌ Error assigning head for ${assignment.departmentCode}:`, error.response?.data || error.message);
        this.assignmentResults.push({
          department: assignment.departmentCode,
          head: assignment.headEmail,
          status: 'error',
          action: 'failed',
          error: error.response?.data || error.message
        });
      }
    }
  }

  async setupManagerHierarchy() {
    console.log('\n👨‍💼 Phase 2: Setting Up Manager Hierarchy');
    console.log('-' .repeat(50));
    
    const config = this.getRequestConfig();
    
    for (const assignment of DEPARTMENT_HEAD_ASSIGNMENTS) {
      try {
        if (!assignment.reportsTo) {
          console.log(`ℹ️ ${assignment.headEmail} is top-level (CEO) - no manager needed`);
          continue;
        }
        
        const subordinate = this.users.get(assignment.headEmail);
        const manager = this.users.get(assignment.reportsTo);
        
        if (!subordinate || !manager) {
          console.warn(`⚠️ Cannot set up reporting: ${assignment.headEmail} → ${assignment.reportsTo}`);
          continue;
        }

        // Check if already assigned
        if (subordinate.managerId === manager.id) {
          console.log(`ℹ️ ${subordinate.firstName} ${subordinate.lastName} already reports to ${manager.firstName} ${manager.lastName}`);
          continue;
        }

        // Update manager assignment
        await axios.put(`${BASE_URL}/user/${subordinate.id}`, {
          managerId: manager.id
        }, config);
        
        console.log(`✅ ${subordinate.firstName} ${subordinate.lastName} (${assignment.headRole}) → ${manager.firstName} ${manager.lastName}`);
        
        // Update local data
        subordinate.managerId = manager.id;
        
        await this.delay(200);
        
      } catch (error) {
        console.error(`❌ Error setting up hierarchy for ${assignment.headEmail}:`, error.response?.data || error.message);
      }
    }
  }

  async assignDepartmentEmployeeManagers() {
    console.log('\n👥 Phase 3: Assigning Department Employee Managers');
    console.log('-' .repeat(50));
    
    const config = this.getRequestConfig();
    
    // Group users by department
    const usersByDepartment = new Map();
    
    for (const [email, user] of this.users) {
      if (user.departmentId) {
        if (!usersByDepartment.has(user.departmentId)) {
          usersByDepartment.set(user.departmentId, []);
        }
        usersByDepartment.get(user.departmentId).push(user);
      }
    }
    
    for (const [departmentId, employees] of usersByDepartment) {
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
        console.error(`❌ Error processing department ${departmentId}:`, error.response?.data || error.message);
      }
    }
  }

  async generateFinalReport() {
    console.log('\n📊 Phase 4: Final Hierarchy Report');
    console.log('=' .repeat(80));
    
    const config = this.getRequestConfig();
    
    try {
      // Get fresh organization chart data
      const response = await axios.get(`${BASE_URL}/organization/${this.organizationId}/chart`, config);
      
      if (response.data && response.data.departments) {
        console.log('\n🏗️ Current Organizational Structure:');
        
        // Sort departments by hierarchy level
        const sortedDepartments = response.data.departments.sort((a, b) => {
          // Executive first, then IT, then others
          const order = ['EXEC-01', 'IT-01', 'HR-01', 'FIN-01', 'SALES-01', 'BE-01', 'FE-01', 'QA-01', 'DEVOPS-01', 'TA-01'];
          const aIndex = order.indexOf(a.code) !== -1 ? order.indexOf(a.code) : 999;
          const bIndex = order.indexOf(b.code) !== -1 ? order.indexOf(b.code) : 999;
          return aIndex - bIndex;
        });
        
        sortedDepartments.forEach(dept => {
          console.log(`\n📁 ${dept.name} (${dept.code}):`);
          
          if (dept.departmentHead) {
            console.log(`  👑 Head: ${dept.departmentHead.firstName} ${dept.departmentHead.lastName} (${dept.departmentHead.email})`);
          } else {
            console.log(`  ⚠️  No head assigned`);
          }
          
          if (dept.users && dept.users.length > 0) {
            console.log(`  👥 Employees (${dept.users.length}):`);
            dept.users.forEach(user => {
              if (user.id === dept.departmentHead?.id) return; // Skip head in employee list
              
              const managerInfo = user.manager ? 
                `Manager: ${user.manager.firstName} ${user.manager.lastName}` : 
                'No manager assigned';
              console.log(`    - ${user.firstName} ${user.lastName} (${user.email}) - ${managerInfo}`);
            });
          }
        });
      }
      
      // Summary statistics
      console.log('\n📈 Summary Statistics:');
      console.log('-' .repeat(30));
      
      const successfulAssignments = this.assignmentResults.filter(r => r.status === 'success').length;
      const alreadyAssigned = this.assignmentResults.filter(r => r.status === 'already_assigned').length;
      const failedAssignments = this.assignmentResults.filter(r => r.status === 'error').length;
      
      console.log(`✅ Successfully assigned heads: ${successfulAssignments}`);
      console.log(`ℹ️ Already assigned: ${alreadyAssigned}`);
      console.log(`❌ Failed assignments: ${failedAssignments}`);
      console.log(`📊 Total departments: ${this.departments.size}`);
      console.log(`👤 Total users: ${this.users.size}`);
      
      // Manager coverage analysis
      const usersWithManagers = Array.from(this.users.values()).filter(u => u.managerId).length;
      const usersWithoutManagers = this.users.size - usersWithManagers;
      
      console.log(`👨‍💼 Users with managers: ${usersWithManagers}`);
      console.log(`🚫 Users without managers: ${usersWithoutManagers}`);
      
      if (failedAssignments > 0) {
        console.log('\n⚠️ Failed Assignments:');
        this.assignmentResults.filter(r => r.status === 'error').forEach(result => {
          console.log(`   - ${result.department}: ${result.error}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Error generating final report:', error.response?.data || error.message);
    }
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

// Export the main function
export async function setupDepartmentHierarchy() {
  const setup = new DepartmentHierarchySetup();
  await setup.run();
}

// Export class for direct use
export { DepartmentHierarchySetup };

// Run directly if this file is executed (ES module check)
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDepartmentHierarchy()
    .catch((error) => {
      console.error('❌ Department hierarchy setup failed:', error);
      process.exit(1);
    });
}
