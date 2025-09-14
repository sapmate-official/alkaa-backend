import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Base URL for API calls
const BASE_URL = 'http://localhost:3000/api/v2';

// Admin credentials to login and get session cookies
const ADMIN_CREDENTIALS = {
  email: 'admin@techvantage.com',
  password: 'password'
};

/**
 * Smart Hierarchy Seeder
 * 
 * This seeder analyzes the existing organization structure and intelligently assigns:
 * 1. Department heads based on role hierarchy and experience
 * 2. Manager assignments for all employees
 * 3. Proper organizational reporting structure
 */

class SmartHierarchySeeder {
  constructor() {
    this.adminSessionCookies = null;
    this.organizationId = null;
    this.departments = new Map(); // code -> department data
    this.users = new Map(); // id -> user data
    this.roles = new Map(); // id -> role data
    this.departmentHierarchy = new Map(); // parent -> children mapping
    this.assignmentLog = [];
  }

  async run() {
    try {
      console.log('🧠 Starting Smart Hierarchy Seeder...');
      console.log('=' .repeat(60));
      
      // Step 1: Login as admin
      await this.loginAsAdmin();
      
      // Step 2: Fetch organization data
      await this.fetchOrganizationData();
      
      // Step 3: Analyze existing structure
      await this.analyzeExistingStructure();
      
      // Step 4: Assign department heads intelligently
      await this.assignDepartmentHeads();
      
      // Step 5: Assign managers for all employees
      await this.assignManagersForEmployees();
      
      // Step 6: Generate comprehensive report
      await this.generateFinalReport();
      
      console.log('\n🎉 Smart Hierarchy Seeder completed successfully!');
      
    } catch (error) {
      console.error('❌ Error in Smart Hierarchy Seeder:', error.message);
      if (error.response?.data) {
        console.error('API Response:', error.response.data);
      }
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  async loginAsAdmin() {
    try {
      console.log('🔐 Logging in as admin...');
      const response = await axios.post(`${BASE_URL.replace('/v2', '/v1')}/general/login`, ADMIN_CREDENTIALS);
      
      this.adminSessionCookies = response.headers['set-cookie'];
      console.log('✅ Admin login successful');
    } catch (error) {
      console.error('❌ Admin login failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async fetchOrganizationData() {
    try {
      console.log('📊 Fetching organization data...');
      
      const config = this.getRequestConfig();
      
      // Fetch organization
      const orgResponse = await axios.get(`${BASE_URL}/organization`, config);
      const organizations = Array.isArray(orgResponse.data) ? orgResponse.data : [orgResponse.data];
      const organization = organizations[0];
      
      if (!organization) {
        throw new Error('No organization found');
      }
      
      this.organizationId = organization.id;
      console.log(`📋 Organization: ${organization.name} (${this.organizationId})`);
      
      // Fetch departments
      const deptResponse = await axios.get(`${BASE_URL}/department`, config);
      const departments = deptResponse.data || [];
      
      departments.forEach(dept => {
        this.departments.set(dept.code || dept.id, {
          ...dept,
          employees: []
        });
      });
      
      console.log(`🏢 Found ${departments.length} departments`);
      
      // Fetch users
      const userResponse = await axios.get(`${BASE_URL}/user`, config);
      const users = userResponse.data || [];
      
      users.forEach(user => {
        this.users.set(user.id, user);
        
        // Group users by department
        const dept = Array.from(this.departments.values()).find(d => d.id === user.departmentId);
        if (dept) {
          dept.employees.push(user);
        }
      });
      
      console.log(`👥 Found ${users.length} users`);
      
      // Fetch roles
      const roleResponse = await axios.get(`${BASE_URL}/role`, config);
      const roles = roleResponse.data || [];
      
      roles.forEach(role => {
        this.roles.set(role.id, role);
      });
      
      console.log(`🎭 Found ${roles.length} roles`);
      
    } catch (error) {
      console.error('❌ Error fetching organization data:', error.response?.data || error.message);
      throw error;
    }
  }

  async analyzeExistingStructure() {
    console.log('\n🔍 Analyzing existing organizational structure...');
    console.log('-' .repeat(50));
    
    // Analyze department hierarchy
    for (const [code, dept] of this.departments) {
      console.log(`🏢 ${dept.name} (${code}): ${dept.employees.length} employees`);
      
      if (dept.employees.length > 0) {
        // Analyze roles in this department
        const roleAnalysis = this.analyzeRolesInDepartment(dept.employees);
        console.log(`   Roles: ${Object.entries(roleAnalysis).map(([role, count]) => `${role}(${count})`).join(', ')}`);
        
        // Identify potential department head
        const potentialHead = this.identifyPotentialDepartmentHead(dept.employees);
        if (potentialHead) {
          console.log(`   🎯 Potential Head: ${potentialHead.firstName} ${potentialHead.lastName} (${this.getRoleName(potentialHead.roleId)})`);
        }
      }
    }
  }

  analyzeRolesInDepartment(employees) {
    const roleAnalysis = {};
    
    employees.forEach(emp => {
      const role = this.roles.get(emp.roleId);
      if (role) {
        roleAnalysis[role.name] = (roleAnalysis[role.name] || 0) + 1;
      }
    });
    
    return roleAnalysis;
  }

  identifyPotentialDepartmentHead(employees) {
    if (employees.length === 0) return null;
    
    // Define role hierarchy weights (higher = better for leadership)
    const roleWeights = {
      'CEO': 1000,
      'CTO': 900,
      'HR Director': 850,
      'Engineering Manager': 800,
      'Finance Manager': 750,
      'Sales Manager': 750,
      'HR Manager': 700,
      'Talent Acquisition Specialist': 650,
      'Senior Software Engineer': 600,
      'Software Engineer': 400,
      'QA Engineer': 400,
      'DevOps Engineer': 450,
      'UI/UX Designer': 400,
      'Sales Executive': 350,
      'Accountant': 300
    };
    
    // Score each employee based on multiple factors
    const scoredEmployees = employees.map(emp => {
      const role = this.roles.get(emp.roleId);
      const roleName = role ? role.name : 'Unknown';
      
      let score = 0;
      
      // Role weight (most important factor)
      score += roleWeights[roleName] || 0;
      
      // Experience bonus (if available in employment info)
      if (emp.employmentInfo?.experience) {
        score += emp.employmentInfo.experience * 10;
      }
      
      // Salary can indicate seniority
      if (emp.employmentInfo?.salary) {
        score += emp.employmentInfo.salary / 100000; // Convert to manageable number
      }
      
      return {
        employee: emp,
        score,
        roleName
      };
    });
    
    // Sort by score (highest first)
    scoredEmployees.sort((a, b) => b.score - a.score);
    
    return scoredEmployees[0]?.employee;
  }

  async assignDepartmentHeads() {
    console.log('\n👑 Assigning department heads...');
    console.log('-' .repeat(50));
    
    const config = this.getRequestConfig();
    
    for (const [code, dept] of this.departments) {
      if (dept.employees.length === 0) {
        console.log(`⚠️ ${dept.name}: No employees found, skipping head assignment`);
        continue;
      }
      
      // Skip if already has a head
      if (dept.headId) {
        const currentHead = this.users.get(dept.headId);
        if (currentHead) {
          console.log(`✅ ${dept.name}: Already has head - ${currentHead.firstName} ${currentHead.lastName}`);
          continue;
        }
      }
      
      const potentialHead = this.identifyPotentialDepartmentHead(dept.employees);
      
      if (!potentialHead) {
        console.log(`⚠️ ${dept.name}: No suitable head candidate found`);
        continue;
      }
      
      try {
        // Assign department head using API
        await axios.put(`${BASE_URL}/department/${dept.id}/head/${potentialHead.id}`, {}, config);
        
        // Update local data
        dept.headId = potentialHead.id;
        
        const roleName = this.getRoleName(potentialHead.roleId);
        console.log(`✅ ${dept.name}: Assigned ${potentialHead.firstName} ${potentialHead.lastName} (${roleName}) as head`);
        
        this.assignmentLog.push({
          type: 'Department Head',
          department: dept.name,
          employee: `${potentialHead.firstName} ${potentialHead.lastName}`,
          role: roleName,
          reason: 'Highest scoring candidate based on role hierarchy and experience'
        });
        
        // Small delay to prevent API rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error assigning head for ${dept.name}:`, error.response?.data || error.message);
      }
    }
  }

  async assignManagersForEmployees() {
    console.log('\n👨‍💼 Assigning managers for all employees...');
    console.log('-' .repeat(50));
    
    const config = this.getRequestConfig();
    
    // Define organizational hierarchy (based on OrganizationSeeder structure)
    const hierarchyMap = {
      'EXEC-01': null, // CEO reports to no one
      'IT-01': 'EXEC-01', // CTO reports to CEO
      'HR-01': 'EXEC-01', // HR Director reports to CEO
      'FIN-01': 'EXEC-01', // Finance Manager reports to CEO
      'SALES-01': 'EXEC-01', // Sales Manager reports to CEO
      'BE-01': 'IT-01', // Backend team reports to IT
      'FE-01': 'IT-01', // Frontend team reports to IT
      'QA-01': 'IT-01', // QA team reports to IT
      'DEVOPS-01': 'IT-01', // DevOps team reports to IT
      'TA-01': 'HR-01' // Talent Acquisition reports to HR
    };
    
    let managersAssigned = 0;
    
    for (const [userId, user] of this.users) {
      // Skip if user already has a manager or is the org admin
      if (user.managerId || user.email === ADMIN_CREDENTIALS.email) {
        continue;
      }
      
      const userDept = Array.from(this.departments.values()).find(d => d.id === user.departmentId);
      if (!userDept) {
        console.log(`⚠️ ${user.firstName} ${user.lastName}: Department not found`);
        continue;
      }
      
      let managerId = null;
      
      // If user is a department head, assign them to the parent department head
      if (userDept.headId === user.id) {
        const parentDeptCode = hierarchyMap[userDept.code];
        if (parentDeptCode) {
          const parentDept = this.departments.get(parentDeptCode);
          if (parentDept && parentDept.headId) {
            managerId = parentDept.headId;
          }
        }
      } else {
        // Regular employee - assign to their department head
        if (userDept.headId) {
          managerId = userDept.headId;
        }
      }
      
      if (managerId && managerId !== user.id) {
        try {
          await axios.put(`${BASE_URL}/user/${user.id}/manager/${managerId}`, {}, config);
          
          const manager = this.users.get(managerId);
          console.log(`✅ ${user.firstName} ${user.lastName} → Manager: ${manager.firstName} ${manager.lastName}`);
          
          this.assignmentLog.push({
            type: 'Manager Assignment',
            employee: `${user.firstName} ${user.lastName}`,
            manager: `${manager.firstName} ${manager.lastName}`,
            department: userDept.name,
            reason: userDept.headId === user.id ? 'Department head reporting to parent department head' : 'Employee reporting to department head'
          });
          
          managersAssigned++;
          
          // Small delay to prevent API rate limiting
          await new Promise(resolve => setTimeout(resolve, 50));
          
        } catch (error) {
          console.error(`❌ Error assigning manager for ${user.firstName} ${user.lastName}:`, error.response?.data || error.message);
        }
      } else {
        console.log(`⚠️ ${user.firstName} ${user.lastName}: No suitable manager found`);
      }
    }
    
    console.log(`📊 Assigned managers to ${managersAssigned} employees`);
  }

  async generateFinalReport() {
    console.log('\n📋 Final Hierarchy Report');
    console.log('=' .repeat(60));
    
    // Department heads summary
    console.log('\n👑 Department Heads:');
    console.log('-' .repeat(30));
    
    for (const [code, dept] of this.departments) {
      if (dept.headId) {
        const head = this.users.get(dept.headId);
        if (head) {
          const roleName = this.getRoleName(head.roleId);
          console.log(`🏢 ${dept.name}: ${head.firstName} ${head.lastName} (${roleName})`);
        }
      } else {
        console.log(`🏢 ${dept.name}: No head assigned`);
      }
    }
    
    // Manager assignments summary
    console.log('\n👨‍💼 Manager Assignments Summary:');
    console.log('-' .repeat(30));
    
    let employeesWithManagers = 0;
    let employeesWithoutManagers = 0;
    
    for (const [userId, user] of this.users) {
      if (user.email === ADMIN_CREDENTIALS.email) continue; // Skip admin
      
      if (user.managerId) {
        employeesWithManagers++;
      } else {
        employeesWithoutManagers++;
      }
    }
    
    console.log(`✅ Employees with managers: ${employeesWithManagers}`);
    console.log(`⚠️ Employees without managers: ${employeesWithoutManagers}`);
    
    // Organizational tree
    console.log('\n🌳 Organizational Tree:');
    console.log('-' .repeat(30));
    await this.printOrganizationalTree();
    
    // Assignment log
    if (this.assignmentLog.length > 0) {
      console.log('\n📝 Assignment Log:');
      console.log('-' .repeat(30));
      
      this.assignmentLog.forEach((log, index) => {
        console.log(`${index + 1}. ${log.type}:`);
        if (log.type === 'Department Head') {
          console.log(`   ${log.department} → ${log.employee} (${log.role})`);
        } else {
          console.log(`   ${log.employee} → ${log.manager} (${log.department})`);
        }
        console.log(`   Reason: ${log.reason}\n`);
      });
    }
  }

  async printOrganizationalTree() {
    // Find the CEO (root of the tree)
    const ceoRole = Array.from(this.roles.values()).find(r => r.name === 'CEO');
    if (!ceoRole) {
      console.log('CEO role not found');
      return;
    }
    
    const ceo = Array.from(this.users.values()).find(u => u.roleId === ceoRole.id);
    if (!ceo) {
      console.log('CEO user not found');
      return;
    }
    
    // Build the tree starting from CEO
    this.printUserTree(ceo.id, 0);
  }

  printUserTree(userId, level = 0) {
    const user = this.users.get(userId);
    if (!user) return;
    
    const indent = '  '.repeat(level);
    const roleName = this.getRoleName(user.roleId);
    const dept = Array.from(this.departments.values()).find(d => d.id === user.departmentId);
    const deptName = dept ? dept.name : 'Unknown Dept';
    
    console.log(`${indent}${level === 0 ? '👑' : '├─'} ${user.firstName} ${user.lastName} (${roleName}) - ${deptName}`);
    
    // Find direct reports
    const directReports = Array.from(this.users.values()).filter(u => u.managerId === userId);
    directReports.forEach(report => {
      this.printUserTree(report.id, level + 1);
    });
  }

  getRoleName(roleId) {
    const role = this.roles.get(roleId);
    return role ? role.name : 'Unknown Role';
  }

  getRequestConfig() {
    const config = {};
    if (this.adminSessionCookies) {
      config.headers = { Cookie: this.adminSessionCookies.join('; ') };
    }
    return config;
  }
}

// Export the main function
export async function runSmartHierarchySeeder() {
  const seeder = new SmartHierarchySeeder();
  await seeder.run();
}

// Export class for direct use
export { SmartHierarchySeeder };

// Run directly if this file is executed
if (import.meta.url === `file://${process.argv[1]}`) {
  runSmartHierarchySeeder()
    .catch((error) => {
      console.error('❌ Smart Hierarchy Seeder failed:', error);
      process.exit(1);
    });
}
