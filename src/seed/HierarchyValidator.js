import axios from 'axios';

// Base URL for API calls
const BASE_URL = 'http://localhost:3000/api/v2';

// Admin credentials
const ADMIN_CREDENTIALS = {
  email: 'admin@techvantage.com',
  password: 'password'
};

/**
 * Hierarchy Validation and Reporting Tool
 * 
 * This script validates the organizational hierarchy setup and generates
 * comprehensive reports about the department structure and manager assignments.
 */

class HierarchyValidator {
  constructor() {
    this.adminSessionCookies = null;
    this.organizationId = null;
    this.departments = new Map();
    this.users = new Map();
    this.validationResults = {
      departmentHeads: { total: 0, assigned: 0, missing: [] },
      managerAssignments: { total: 0, assigned: 0, orphaned: [] },
      hierarchyIntegrity: { valid: true, issues: [] }
    };
  }

  async run() {
    try {
      console.log('🔍 Starting Hierarchy Validation and Reporting...');
      console.log('=' .repeat(80));
      
      await this.loginAsAdmin();
      await this.fetchOrganizationData();
      await this.fetchUsers();
      
      await this.validateDepartmentHeads();
      await this.validateManagerAssignments();
      await this.validateHierarchyIntegrity();
      
      await this.generateComprehensiveReport();
      
      console.log('\n✅ Hierarchy validation completed!');
      
    } catch (error) {
      console.error('❌ Error in hierarchy validation:', error.response?.data || error.message);
      throw error;
    }
  }

  async loginAsAdmin() {
    try {
      console.log('🔐 Logging in as admin...');
      const loginResponse = await axios.post(`http://localhost:3000/api/v1/general/login`, ADMIN_CREDENTIALS);
      this.adminSessionCookies = loginResponse.headers['set-cookie'];
      console.log('✅ Successfully logged in as admin');
    } catch (error) {
      console.error('❌ Error logging in:', error.response?.data || error.message);
      throw error;
    }
  }

  async fetchOrganizationData() {
    try {
      console.log('\n📋 Fetching organization data...');
      
      const config = this.getRequestConfig();
      
      const orgResponse = await axios.get(`${BASE_URL}/organization`, config);
      if (orgResponse.data && orgResponse.data.length > 0) {
        this.organizationId = orgResponse.data[0].id;
        console.log(`✅ Organization: ${orgResponse.data[0].name}`);
      }

      const deptResponse = await axios.get(`${BASE_URL}/department/org/${this.organizationId}`, config);
      if (deptResponse.data && deptResponse.data.length > 0) {
        deptResponse.data.forEach(dept => {
          this.departments.set(dept.id, {
            id: dept.id,
            name: dept.name,
            code: dept.code,
            headId: dept.headId,
            parentId: dept.parentId,
            users: []
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
      console.log('\n👥 Fetching users...');
      
      const config = this.getRequestConfig();
      const response = await axios.get(`${BASE_URL}/user/org/${this.organizationId}`, config);
      
      if (response.data && response.data.length > 0) {
        response.data.forEach(user => {
          this.users.set(user.id, {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            employeeId: user.employeeId,
            departmentId: user.departmentId,
            managerId: user.managerId,
            roles: user.roles || []
          });
          
          // Add user to department
          if (user.departmentId && this.departments.has(user.departmentId)) {
            this.departments.get(user.departmentId).users.push(user.id);
          }
        });
        console.log(`✅ Loaded ${this.users.size} users`);
      }
      
    } catch (error) {
      console.error('❌ Error fetching users:', error.response?.data || error.message);
      throw error;
    }
  }

  async validateDepartmentHeads() {
    console.log('\n👑 Validating Department Heads...');
    console.log('-' .repeat(50));
    
    this.validationResults.departmentHeads.total = this.departments.size;
    
    for (const [deptId, dept] of this.departments) {
      if (dept.headId) {
        const head = this.users.get(dept.headId);
        if (head) {
          console.log(`✅ ${dept.name}: ${head.firstName} ${head.lastName} (${head.email})`);
          this.validationResults.departmentHeads.assigned++;
        } else {
          console.log(`⚠️ ${dept.name}: Head ID exists but user not found`);
          this.validationResults.departmentHeads.missing.push({
            department: dept.name,
            issue: 'Head user not found',
            headId: dept.headId
          });
        }
      } else {
        console.log(`❌ ${dept.name}: No head assigned`);
        this.validationResults.departmentHeads.missing.push({
          department: dept.name,
          issue: 'No head assigned',
          headId: null
        });
      }
    }
  }

  async validateManagerAssignments() {
    console.log('\n👨‍💼 Validating Manager Assignments...');
    console.log('-' .repeat(50));
    
    this.validationResults.managerAssignments.total = this.users.size;
    
    for (const [userId, user] of this.users) {
      if (user.managerId) {
        const manager = this.users.get(user.managerId);
        if (manager) {
          console.log(`✅ ${user.firstName} ${user.lastName} → ${manager.firstName} ${manager.lastName}`);
          this.validationResults.managerAssignments.assigned++;
        } else {
          console.log(`⚠️ ${user.firstName} ${user.lastName}: Manager ID exists but manager not found`);
          this.validationResults.managerAssignments.orphaned.push({
            user: `${user.firstName} ${user.lastName}`,
            email: user.email,
            issue: 'Manager not found',
            managerId: user.managerId
          });
        }
      } else {
        // Check if this is the CEO (should not have a manager)
        if (user.email === 'rajesh.sharma@techvantage.com') {
          console.log(`ℹ️ ${user.firstName} ${user.lastName} (CEO): No manager (expected)`);
          this.validationResults.managerAssignments.assigned++;
        } else {
          console.log(`❌ ${user.firstName} ${user.lastName}: No manager assigned`);
          this.validationResults.managerAssignments.orphaned.push({
            user: `${user.firstName} ${user.lastName}`,
            email: user.email,
            issue: 'No manager assigned',
            managerId: null
          });
        }
      }
    }
  }

  async validateHierarchyIntegrity() {
    console.log('\n🔗 Validating Hierarchy Integrity...');
    console.log('-' .repeat(50));
    
    // Check for circular references
    for (const [userId, user] of this.users) {
      if (user.managerId && this.hasCircularReference(userId, user.managerId, new Set())) {
        this.validationResults.hierarchyIntegrity.valid = false;
        this.validationResults.hierarchyIntegrity.issues.push({
          type: 'circular_reference',
          user: `${user.firstName} ${user.lastName}`,
          description: 'Circular manager reference detected'
        });
        console.log(`❌ Circular reference: ${user.firstName} ${user.lastName}`);
      }
    }
    
    // Check department head assignments
    for (const [deptId, dept] of this.departments) {
      if (dept.headId) {
        const head = this.users.get(dept.headId);
        if (head && head.departmentId !== deptId) {
          this.validationResults.hierarchyIntegrity.valid = false;
          this.validationResults.hierarchyIntegrity.issues.push({
            type: 'department_mismatch',
            user: `${head.firstName} ${head.lastName}`,
            department: dept.name,
            description: 'Department head is not in the department they manage'
          });
          console.log(`❌ Department mismatch: ${head.firstName} ${head.lastName} heads ${dept.name} but is in different department`);
        }
      }
    }
    
    if (this.validationResults.hierarchyIntegrity.valid) {
      console.log('✅ Hierarchy integrity is valid');
    } else {
      console.log(`❌ Found ${this.validationResults.hierarchyIntegrity.issues.length} hierarchy integrity issues`);
    }
  }

  hasCircularReference(startUserId, currentManagerId, visited) {
    if (visited.has(currentManagerId)) {
      return currentManagerId === startUserId;
    }
    
    visited.add(currentManagerId);
    
    const manager = this.users.get(currentManagerId);
    if (manager && manager.managerId) {
      return this.hasCircularReference(startUserId, manager.managerId, visited);
    }
    
    return false;
  }

  async generateComprehensiveReport() {
    console.log('\n📊 Comprehensive Hierarchy Report');
    console.log('=' .repeat(80));
    
    // Overall Statistics
    console.log('\n📈 Overall Statistics:');
    console.log('-' .repeat(30));
    console.log(`🏢 Total Departments: ${this.departments.size}`);
    console.log(`👤 Total Users: ${this.users.size}`);
    console.log(`👑 Departments with Heads: ${this.validationResults.departmentHeads.assigned}/${this.validationResults.departmentHeads.total}`);
    console.log(`👨‍💼 Users with Managers: ${this.validationResults.managerAssignments.assigned}/${this.validationResults.managerAssignments.total}`);
    console.log(`🔗 Hierarchy Integrity: ${this.validationResults.hierarchyIntegrity.valid ? '✅ Valid' : '❌ Issues Found'}`);
    
    // Department Breakdown
    console.log('\n🏢 Department Breakdown:');
    console.log('-' .repeat(40));
    
    for (const [deptId, dept] of this.departments) {
      const head = dept.headId ? this.users.get(dept.headId) : null;
      const employeeCount = dept.users.length;
      const employeesWithManagers = dept.users.filter(userId => {
        const user = this.users.get(userId);
        return user && user.managerId;
      }).length;
      
      console.log(`\n📁 ${dept.name} (${dept.code}):`);
      console.log(`   👑 Head: ${head ? `${head.firstName} ${head.lastName}` : 'Not assigned'}`);
      console.log(`   👥 Employees: ${employeeCount}`);
      console.log(`   👨‍💼 With Managers: ${employeesWithManagers}/${employeeCount}`);
      
      if (employeeCount > 0 && employeesWithManagers < employeeCount) {
        const orphanedEmployees = dept.users.filter(userId => {
          const user = this.users.get(userId);
          return user && !user.managerId && user.email !== 'rajesh.sharma@techvantage.com';
        });
        
        if (orphanedEmployees.length > 0) {
          console.log(`   ⚠️ Employees without managers: ${orphanedEmployees.length}`);
          orphanedEmployees.forEach(userId => {
            const user = this.users.get(userId);
            console.log(`      - ${user.firstName} ${user.lastName} (${user.email})`);
          });
        }
      }
    }
    
    // Manager Tree
    console.log('\n🌳 Management Tree:');
    console.log('-' .repeat(25));
    
    this.printManagerTree();
    
    // Issues Summary
    if (this.validationResults.departmentHeads.missing.length > 0 || 
        this.validationResults.managerAssignments.orphaned.length > 0 ||
        !this.validationResults.hierarchyIntegrity.valid) {
      
      console.log('\n⚠️ Issues Found:');
      console.log('-' .repeat(20));
      
      if (this.validationResults.departmentHeads.missing.length > 0) {
        console.log('\n❌ Departments without heads:');
        this.validationResults.departmentHeads.missing.forEach(issue => {
          console.log(`   - ${issue.department}: ${issue.issue}`);
        });
      }
      
      if (this.validationResults.managerAssignments.orphaned.length > 0) {
        console.log('\n❌ Users without managers:');
        this.validationResults.managerAssignments.orphaned.forEach(issue => {
          console.log(`   - ${issue.user} (${issue.email}): ${issue.issue}`);
        });
      }
      
      if (!this.validationResults.hierarchyIntegrity.valid) {
        console.log('\n❌ Hierarchy integrity issues:');
        this.validationResults.hierarchyIntegrity.issues.forEach(issue => {
          console.log(`   - ${issue.type}: ${issue.user} - ${issue.description}`);
        });
      }
    } else {
      console.log('\n✅ No issues found - Hierarchy is properly configured!');
    }
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    console.log('-' .repeat(20));
    
    if (this.validationResults.departmentHeads.missing.length > 0) {
      console.log('📋 Assign department heads to all departments');
    }
    
    if (this.validationResults.managerAssignments.orphaned.length > 0) {
      console.log('👨‍💼 Assign managers to all employees (except CEO)');
    }
    
    if (this.validationResults.hierarchyIntegrity.valid && 
        this.validationResults.departmentHeads.missing.length === 0 && 
        this.validationResults.managerAssignments.orphaned.length === 0) {
      console.log('🎉 Hierarchy is fully configured and ready for production use!');
    }
  }

  printManagerTree() {
    // Find the CEO (root of the tree)
    const ceo = Array.from(this.users.values()).find(user => 
      user.email === 'rajesh.sharma@techvantage.com' || !user.managerId
    );
    
    if (ceo) {
      this.printUserTree(ceo.id, 0);
    } else {
      console.log('❌ No CEO found or multiple roots detected');
    }
  }

  printUserTree(userId, level = 0) {
    const user = this.users.get(userId);
    if (!user) return;
    
    const indent = '  '.repeat(level);
    const prefix = level === 0 ? '👑' : level === 1 ? '🔸' : '   ◦';
    
    // Get user's role/title
    const department = user.departmentId ? this.departments.get(user.departmentId) : null;
    const isHead = department && department.headId === user.id;
    const title = isHead ? `Head of ${department.name}` : department ? department.name : 'No Department';
    
    console.log(`${indent}${prefix} ${user.firstName} ${user.lastName} (${title})`);
    
    // Find direct reports
    const directReports = Array.from(this.users.values())
      .filter(u => u.managerId === userId)
      .sort((a, b) => a.firstName.localeCompare(b.firstName));
    
    directReports.forEach(report => {
      this.printUserTree(report.id, level + 1);
    });
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
export async function validateHierarchy() {
  const validator = new HierarchyValidator();
  await validator.run();
}

// Export class for direct use
export { HierarchyValidator };

// Run directly if this file is executed
if (import.meta.url === `file://${process.argv[1]}`) {
  validateHierarchy()
    .catch((error) => {
      console.error('❌ Hierarchy validation failed:', error);
      process.exit(1);
    });
}
