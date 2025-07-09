import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// Base URL for API calls
const BASE_URL = 'http://localhost:3000/api/v1';

// Admin credentials
const ADMIN_CREDENTIALS = {
  email: 'admin@techvantage.com',
  password: 'password'
};

/**
 * Intelligent Manager & Department Head Assigner
 * 
 * This seeder analyzes the existing organizational structure and intelligently assigns:
 * 1. Department heads based on role hierarchy, salary, and experience
 * 2. Managers for all employees within departments
 * 3. Cross-departmental reporting structure
 */

class IntelligentManagerAssigner {
  constructor() {
    this.adminSessionCookies = null;
    this.organizationId = null;
    this.departments = new Map();
    this.users = new Map();
    this.roles = new Map();
    this.assignments = [];
  }

  async run() {
    try {
      console.log('🚀 Starting Intelligent Manager & Department Head Assignment...');
      console.log('=' .repeat(80));
      
      // Step 1: Analyze current organizational structure
      await this.analyzeOrganizationalStructure();
      
      // Step 2: Login as admin for API operations
      await this.loginAsAdmin();
      
      // Step 3: Analyze and assign department heads
      await this.assignDepartmentHeads();
      
      // Step 4: Assign managers for all employees
      await this.assignManagers();
      
      // Step 5: Validate and report final structure
      await this.generateFinalReport();
      
      console.log('\n🎉 Intelligent Manager Assignment completed successfully!');
      
    } catch (error) {
      console.error('❌ Enhanced Hierarchy Seeder failed:', error.message);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  async analyzeOrganizationalStructure() {
    console.log('🔍 Analyzing organizational structure from database...');
    
    try {
      // Get organization with all related data
      const organization = await prisma.organization.findUnique({
        where:{
            id:"cmbtr8y9i0001tlpwtvjjsftz"
        },
        include: {
          departments: {
            include: {
              departmentHead: {
                include: {
                  roles: {
                    include: {
                      role: true
                    }
                  }
                }
              },
              users: {
                include: {
                  roles: {
                    include: {
                      role: true
                    }
                  },
                  manager: true,
                  subordinates: true,
                  salaryParameter: true
                }
              }
            }
          },
          users: {
            include: {
              roles: {
                include: {
                  role: true
                }
              },
              manager: true,
              subordinates: true,
              department: true,
              salaryParameter: true
            }
          },
          roles: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      });

      if (!organization) {
        throw new Error('No organization found in database');
      }

      this.organizationId = organization.id;
      console.log(`📊 Found organization: ${organization.name}`);
      console.log(`🏢 Departments: ${organization.departments.length}`);
      console.log(`👥 Users: ${organization.users.length}`);
      console.log(`🎭 Roles: ${organization.roles.length}`);

      // Process departments
      for (const dept of organization.departments) {
        this.departments.set(dept.id, {
          ...dept,
          employees: dept.users || []
        });
      }

      // Process users
      for (const user of organization.users) {
        this.users.set(user.id, user);
      }

      // Process roles
      for (const role of organization.roles) {
        this.roles.set(role.id, role);
      }

      await this.analyzeDepartmentStructure();

    } catch (error) {
      console.error('❌ Database analysis failed:', error.message);
      throw error;
    }
  }

  async analyzeDepartmentStructure() {
    console.log('\n🏢 Department Structure Analysis:');
    console.log('-' .repeat(60));

    for (const [deptId, dept] of this.departments) {
      const employees = Array.from(this.users.values()).filter(user => user.departmentId === deptId);
      
      console.log(`\n📍 ${dept.name} (${dept.code || 'No Code'})`);
      console.log(`   👥 Employees: ${employees.length}`);
      console.log(`   💰 Budget: ₹${dept.budget?.toLocaleString() || 'Not set'}`);
      console.log(`   👑 Current Head: ${dept.departmentHead ? `${dept.departmentHead.firstName} ${dept.departmentHead.lastName}` : 'None'}`);
      
      if (employees.length > 0) {
        const roleDistribution = this.analyzeRoleDistribution(employees);
        const salaryStats = this.analyzeSalaryDistribution(employees);
        
        console.log(`   🎭 Role Distribution:`);
        Object.entries(roleDistribution).forEach(([role, count]) => {
          console.log(`      - ${role}: ${count}`);
        });
        
        if (salaryStats.count > 0) {
          console.log(`   💵 Salary Range: ₹${salaryStats.min?.toLocaleString()} - ₹${salaryStats.max?.toLocaleString()}`);
          console.log(`   💵 Average Salary: ₹${salaryStats.avg?.toLocaleString()}`);
        }

        // Identify best candidate for department head
        const bestCandidate = this.identifyBestDepartmentHead(employees);
        if (bestCandidate) {
          console.log(`   🌟 Best Head Candidate: ${bestCandidate.firstName} ${bestCandidate.lastName} (Score: ${bestCandidate.score})`);
          console.log(`      Role: ${this.getUserRoles(bestCandidate)}`);
          console.log(`      Salary: ₹${bestCandidate.annualPackage?.toLocaleString() || 'Not set'}`);
        }
      }
    }
  }

  analyzeRoleDistribution(employees) {
    const distribution = {};
    employees.forEach(emp => {
      const roles = this.getUserRoles(emp);
      if (roles) {
        distribution[roles] = (distribution[roles] || 0) + 1;
      }
    });
    return distribution;
  }

  analyzeSalaryDistribution(employees) {
    const salaries = employees
      .map(emp => emp.annualPackage)
      .filter(salary => salary && salary > 0);
    
    if (salaries.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0 };
    }

    return {
      count: salaries.length,
      min: Math.min(...salaries),
      max: Math.max(...salaries),
      avg: Math.round(salaries.reduce((sum, sal) => sum + sal, 0) / salaries.length)
    };
  }

  identifyBestDepartmentHead(employees) {
    if (employees.length === 0) return null;

    // Define role weights for leadership potential
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

    // Score each employee
    const scoredEmployees = employees.map(emp => {
      let score = 0;
      
      // Role-based scoring
      const roles = this.getUserRoles(emp);
      if (roles && roleWeights[roles]) {
        score += roleWeights[roles];
      }
      
      // Salary-based scoring (higher salary indicates seniority)
      if (emp.annualPackage && emp.annualPackage > 0) {
        score += Math.round(emp.annualPackage / 100000); // Each lakh adds 1 point
      }
      
      // Experience-based scoring (using hire date as proxy)
      if (emp.hiredDate) {
        const yearsOfService = (new Date() - new Date(emp.hiredDate)) / (365 * 24 * 60 * 60 * 1000);
        score += Math.round(yearsOfService * 10); // 10 points per year of service
      }
      
      return { ...emp, score };
    });

    // Sort by score and return the best candidate
    scoredEmployees.sort((a, b) => b.score - a.score);
    return scoredEmployees[0];
  }

  getUserRoles(user) {
    if (user.roles && user.roles.length > 0) {
      return user.roles.map(ur => ur.role.name).join(', ');
    }
    return 'No Role';
  }

  async loginAsAdmin() {
    console.log('\n🔐 Logging in as admin...');
    
    try {
      const response = await axios.post(`${BASE_URL}/general/login`, ADMIN_CREDENTIALS);
      
      if (response.status === 200) {
        // Extract cookies from response headers
        const cookies = response.headers['set-cookie'];
        if (cookies) {
          this.adminSessionCookies = cookies.join('; ');
        }
        console.log('✅ Admin login successful');
      }
    } catch (error) {
      console.error('❌ Admin login failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async assignDepartmentHeads() {
    console.log('\n👑 Assigning Department Heads...');
    console.log('-' .repeat(50));

    const config = this.getRequestConfig();

    for (const [deptId, dept] of this.departments) {
      // Skip if department already has a head
      if (dept.headId) {
        console.log(`⏭️ ${dept.name} already has a department head, skipping...`);
        continue;
      }

      const employees = Array.from(this.users.values()).filter(user => user.departmentId === deptId);
      
      if (employees.length === 0) {
        console.log(`⚠️ ${dept.name} has no employees, skipping...`);
        continue;
      }

      const bestCandidate = this.identifyBestDepartmentHead(employees);
      
      if (bestCandidate) {
        try {
          // Update department with head using the specific endpoint
          await axios.put(
            `http://localhost:3000/api/v2/department/${deptId}/head/${bestCandidate.id}`,
            {},
            config
          );

          console.log(`✅ Assigned ${bestCandidate.firstName} ${bestCandidate.lastName} as head of ${dept.name}`);
          
          this.assignments.push({
            type: 'department_head',
            department: dept.name,
            employee: `${bestCandidate.firstName} ${bestCandidate.lastName}`,
            role: this.getUserRoles(bestCandidate),
            score: bestCandidate.score
          });

          // Update local data
          dept.headId = bestCandidate.id;
          dept.departmentHead = bestCandidate;

        } catch (error) {
          console.error(`❌ Failed to assign head for ${dept.name}:`, error.response?.data || error.message);
        }
      }
    }
  }

  async assignManagers() {
    console.log('\n👨‍💼 Assigning Managers to Employees...');
    console.log('-' .repeat(50));

    const config = this.getRequestConfig();

    for (const [deptId, dept] of this.departments) {
      const employees = Array.from(this.users.values()).filter(user => user.departmentId === deptId);
      
      if (employees.length === 0 || !dept.headId) {
        continue;
      }

      // Assign department head as manager for all employees in the department
      // (except the department head themselves)
      for (const employee of employees) {
        if (employee.id === dept.headId) {
          continue; // Skip the department head
        }

        // Skip if employee already has a manager
        if (employee.managerId) {
          console.log(`⏭️ ${employee.firstName} ${employee.lastName} already has a manager, skipping...`);
          continue;
        }

        try {
          await axios.patch(
            `http://localhost:3000/api/v2/user/${employee.id}`,
            { managerId: dept.headId },
            config
          );

          const manager = this.users.get(dept.headId);
          console.log(`✅ Assigned ${manager.firstName} ${manager.lastName} as manager of ${employee.firstName} ${employee.lastName}`);
          
          this.assignments.push({
            type: 'manager_assignment',
            department: dept.name,
            employee: `${employee.firstName} ${employee.lastName}`,
            manager: `${manager.firstName} ${manager.lastName}`,
            role: this.getUserRoles(employee)
          });

          // Update local data
          employee.managerId = dept.headId;

        } catch (error) {
          console.error(`❌ Failed to assign manager for ${employee.firstName} ${employee.lastName}:`, error.response?.data || error.message);
        }
      }
    }

    // Handle cross-departmental management (e.g., CTO managing department heads)
    await this.assignCrossDepartmentalManagers();
  }

  async assignCrossDepartmentalManagers() {
    console.log('\n🔗 Setting up Cross-Departmental Management...');
    
    const config = this.getRequestConfig();

    // Define hierarchical relationships
    const hierarchicalAssignments = [
      // CEO manages other department heads
      { managerRole: 'CEO', subordinateRoles: ['CTO', 'HR Director', 'Finance Manager', 'Sales Manager'] },
      // CTO manages engineering department heads  
      { managerRole: 'CTO', subordinateRoles: ['Engineering Manager'] },
      // HR Director manages talent acquisition
      { managerRole: 'HR Director', subordinateRoles: ['Talent Acquisition Specialist'] }
    ];

    for (const assignment of hierarchicalAssignments) {
      // Find manager
      const manager = Array.from(this.users.values()).find(user => {
        const roles = this.getUserRoles(user);
        return roles.includes(assignment.managerRole);
      });

      if (!manager) {
        console.log(`⚠️ Could not find user with role: ${assignment.managerRole}`);
        continue;
      }

      // Find subordinates
      for (const subordinateRole of assignment.subordinateRoles) {
        const subordinates = Array.from(this.users.values()).filter(user => {
          const roles = this.getUserRoles(user);
          return roles.includes(subordinateRole) && user.id !== manager.id;
        });

        for (const subordinate of subordinates) {
          // Skip if subordinate already has a manager
          if (subordinate.managerId) {
            continue;
          }

          try {
            await axios.patch(
              `http://localhost:3000/api/v2/user/${subordinate.id}`,
              { managerId: manager.id },
              config
            );

            console.log(`✅ ${manager.firstName} ${manager.lastName} (${assignment.managerRole}) now manages ${subordinate.firstName} ${subordinate.lastName} (${subordinateRole})`);
            
            this.assignments.push({
              type: 'cross_departmental_assignment',
              manager: `${manager.firstName} ${manager.lastName}`,
              subordinate: `${subordinate.firstName} ${subordinate.lastName}`,
              managerRole: assignment.managerRole,
              subordinateRole: subordinateRole
            });

            // Update local data
            subordinate.managerId = manager.id;

          } catch (error) {
            console.error(`❌ Failed to assign cross-departmental manager:`, error.response?.data || error.message);
          }
        }
      }
    }
  }

  async generateFinalReport() {
    console.log('\n📊 Final Assignment Report');
    console.log('=' .repeat(80));
    
    // Department heads summary
    const departmentHeads = this.assignments.filter(a => a.type === 'department_head');
    console.log(`\n👑 Department Heads Assigned: ${departmentHeads.length}`);
    console.log('-' .repeat(50));
    departmentHeads.forEach(assignment => {
      console.log(`${assignment.department}: ${assignment.employee} (${assignment.role}) - Score: ${assignment.score}`);
    });

    // Manager assignments summary
    const managerAssignments = this.assignments.filter(a => a.type === 'manager_assignment');
    console.log(`\n👨‍💼 Manager Assignments: ${managerAssignments.length}`);
    console.log('-' .repeat(50));
    const managerGroups = {};
    managerAssignments.forEach(assignment => {
      if (!managerGroups[assignment.manager]) {
        managerGroups[assignment.manager] = [];
      }
      managerGroups[assignment.manager].push(assignment.employee);
    });
    
    Object.entries(managerGroups).forEach(([manager, subordinates]) => {
      console.log(`${manager} manages:`);
      subordinates.forEach(sub => console.log(`  - ${sub}`));
    });

    // Cross-departmental assignments
    const crossDepartmentalAssignments = this.assignments.filter(a => a.type === 'cross_departmental_assignment');
    if (crossDepartmentalAssignments.length > 0) {
      console.log(`\n🔗 Cross-Departmental Management: ${crossDepartmentalAssignments.length}`);
      console.log('-' .repeat(50));
      crossDepartmentalAssignments.forEach(assignment => {
        console.log(`${assignment.manager} (${assignment.managerRole}) → ${assignment.subordinate} (${assignment.subordinateRole})`);
      });
    }

    // Print organizational tree
    await this.printOrganizationalTree();
  }

  async printOrganizationalTree() {
    console.log('\n🌳 Organizational Hierarchy Tree');
    console.log('=' .repeat(50));

    // Find root users (users without managers)
    const rootUsers = Array.from(this.users.values()).filter(user => !user.managerId);
    
    for (const rootUser of rootUsers) {
      this.printUserTree(rootUser.id, 0);
    }
  }

  printUserTree(userId, level = 0) {
    const user = this.users.get(userId);
    if (!user) return;

    const indent = '  '.repeat(level);
    const roles = this.getUserRoles(user);
    const dept = user.department ? user.department.name : 'No Department';
    
    console.log(`${indent}${level === 0 ? '👑' : '👤'} ${user.firstName} ${user.lastName} (${roles}) - ${dept}`);
    
    // Find and print subordinates
    const subordinates = Array.from(this.users.values()).filter(u => u.managerId === userId);
    subordinates.forEach(subordinate => {
      this.printUserTree(subordinate.id, level + 1);
    });
  }

  getRequestConfig() {
    const config = {
      withCredentials: true
    };
    if (this.adminSessionCookies) {
      config.headers = {
        'Cookie': this.adminSessionCookies
      };
    }
    return config;
  }
}

// Export the main function
export async function runIntelligentManagerAssigner() {
  const assigner = new IntelligentManagerAssigner();
  await assigner.run();
}

// Export class for direct use
export { IntelligentManagerAssigner };

// Run directly if this file is executed
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntelligentManagerAssigner()
    .catch((error) => {
      console.error('❌ Intelligent Manager Assignment failed:', error);
      process.exit(1);
    });
}
