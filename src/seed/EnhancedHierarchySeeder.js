import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// Base URL for API calls
const BASE_URL = 'http://localhost:3000/api/v2';

// Admin credentials
const ADMIN_CREDENTIALS = {
  email: 'admin@techvantage.com',
  password: 'password'
};

/**
 * Enhanced Hierarchy Analyzer & Seeder
 * 
 * This seeder uses direct database access to analyze relationships and make intelligent
 * decisions about department heads and manager assignments based on:
 * - Role hierarchy and permissions
 * - Department structure and budget
 * - Employee experience and salary levels
 * - Organizational reporting structure
 */

class EnhancedHierarchySeeder {
  constructor() {
    this.adminSessionCookies = null;
    this.organizationId = null;
    this.departmentAnalysis = new Map();
    this.userAnalysis = new Map();
    this.hierarchyDecisions = [];
  }

  async run() {
    try {
      console.log('🚀 Starting Enhanced Hierarchy Analyzer & Seeder...');
      console.log('=' .repeat(70));
      
      // Step 1: Database analysis
      await this.analyzeOrganizationalStructure();
      
      // Step 2: Login as admin for API operations
      await this.loginAsAdmin();
      
      // Step 3: Make intelligent hierarchy decisions
      await this.makeHierarchyDecisions();
      
      // Step 4: Execute department head assignments
      await this.executeDepartmentHeadAssignments();
      
      // Step 5: Execute manager assignments
      await this.executeManagerAssignments();
      
      // Step 6: Generate comprehensive analysis report
      await this.generateAnalysisReport();
      
      console.log('\n🎉 Enhanced Hierarchy Seeder completed successfully!');
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  async analyzeOrganizationalStructure() {
    console.log('🔍 Analyzing organizational structure from database...');
    
    try {
      // Get organization
      const organization = await prisma.organization.findFirst({
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
              employmentInfo: true
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
      console.log(`📋 Organization: ${organization.name}`);
      console.log(`🏢 Departments: ${organization.departments.length}`);
      console.log(`👥 Users: ${organization.users.length}`);
      console.log(`🎭 Roles: ${organization.roles.length}`);

      // Analyze departments
      await this.analyzeDepartments(organization.departments, organization.users);
      
      // Analyze users and their potential for leadership
      await this.analyzeUsers(organization.users, organization.roles);
      
    } catch (error) {
      console.error('❌ Database analysis failed:', error);
      throw error;
    }
  }

  async analyzeDepartments(departments, allUsers) {
    console.log('\n🏢 Department Analysis:');
    console.log('-' .repeat(50));
    
    for (const dept of departments) {
      const deptUsers = allUsers.filter(user => user.departmentId === dept.id);
      
      const analysis = {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        budget: dept.budget,
        currentHead: dept.departmentHead,
        employeeCount: deptUsers.length,
        employees: deptUsers,
        roleDistribution: this.analyzeRoleDistribution(deptUsers),
        experienceAnalysis: this.analyzeExperienceDistribution(deptUsers),
        salaryAnalysis: this.analyzeSalaryDistribution(deptUsers),
        leadershipCandidates: this.identifyLeadershipCandidates(deptUsers),
        parentDepartment: departments.find(d => d.id === dept.parentId),
        childDepartments: departments.filter(d => d.parentId === dept.id)
      };
      
      this.departmentAnalysis.set(dept.id, analysis);
      
      console.log(`\n🏢 ${dept.name} (${dept.code || 'No Code'})`);
      console.log(`   👥 Employees: ${analysis.employeeCount}`);
      console.log(`   💰 Budget: ₹${(dept.budget / 1000000).toFixed(1)}M`);
      console.log(`   🎭 Roles: ${Object.entries(analysis.roleDistribution).map(([role, count]) => `${role}(${count})`).join(', ')}`);
      
      if (analysis.currentHead) {
        console.log(`   👑 Current Head: ${analysis.currentHead.firstName} ${analysis.currentHead.lastName}`);
      } else {
        console.log(`   👑 Current Head: None assigned`);
      }
      
      if (analysis.leadershipCandidates.length > 0) {
        const best = analysis.leadershipCandidates[0];
        console.log(`   🎯 Best Candidate: ${best.user.firstName} ${best.user.lastName} (Score: ${best.score})`);
      }
    }
  }

  analyzeRoleDistribution(users) {
    const distribution = {};
    users.forEach(user => {
      if (user.roles && user.roles.length > 0) {
        user.roles.forEach(userRole => {
          const roleName = userRole.role.name;
          distribution[roleName] = (distribution[roleName] || 0) + 1;
        });
      }
    });
    return distribution;
  }

  analyzeExperienceDistribution(users) {
    const experiences = users
      .filter(user => user.employmentInfo && user.employmentInfo.experience)
      .map(user => user.employmentInfo.experience);
    
    if (experiences.length === 0) return { avg: 0, max: 0, min: 0 };
    
    return {
      avg: experiences.reduce((sum, exp) => sum + exp, 0) / experiences.length,
      max: Math.max(...experiences),
      min: Math.min(...experiences)
    };
  }

  analyzeSalaryDistribution(users) {
    const salaries = users
      .filter(user => user.employmentInfo && user.employmentInfo.salary)
      .map(user => user.employmentInfo.salary);
    
    if (salaries.length === 0) return { avg: 0, max: 0, min: 0 };
    
    return {
      avg: salaries.reduce((sum, sal) => sum + sal, 0) / salaries.length,
      max: Math.max(...salaries),
      min: Math.min(...salaries)
    };
  }

  identifyLeadershipCandidates(users) {
    const candidates = users.map(user => {
      const score = this.calculateLeadershipScore(user);
      return { user, score };
    });
    
    return candidates
      .filter(candidate => candidate.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  calculateLeadershipScore(user) {
    let score = 0;
    
    // Role-based scoring
    if (user.roles && user.roles.length > 0) {
      const roleScores = {
        'CEO': 1000,
        'CTO': 900,
        'HR Director': 850,
        'Engineering Manager': 800,
        'Finance Manager': 750,
        'Sales Manager': 750,
        'HR Manager': 700,
        'Talent Acquisition Specialist': 650,
        'Senior Software Engineer': 600,
        'DevOps Engineer': 450,
        'Software Engineer': 400,
        'QA Engineer': 400,
        'UI/UX Designer': 400,
        'Sales Executive': 350,
        'Accountant': 300
      };
      
      user.roles.forEach(userRole => {
        score += roleScores[userRole.role.name] || 0;
      });
    }
    
    // Experience bonus
    if (user.employmentInfo?.experience) {
      score += user.employmentInfo.experience * 15;
    }
    
    // Salary indicator (higher salary often indicates seniority)
    if (user.employmentInfo?.salary) {
      score += user.employmentInfo.salary / 100000;
    }
    
    // Penalty for already being a department head
    if (user.departmentHead && user.departmentHead.length > 0) {
      score += 100; // Slight bonus for existing heads
    }
    
    return Math.round(score);
  }

  async analyzeUsers(users, roles) {
    console.log('\n👥 User Analysis:');
    console.log('-' .repeat(50));
    
    for (const user of users) {
      const analysis = {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        currentManager: user.manager,
        subordinates: user.subordinates,
        roles: user.roles,
        employmentInfo: user.employmentInfo,
        leadershipScore: this.calculateLeadershipScore(user),
        isCurrentHead: user.departmentHead && user.departmentHead.length > 0
      };
      
      this.userAnalysis.set(user.id, analysis);
    }
    
    // Show top leadership candidates
    const topCandidates = Array.from(this.userAnalysis.values())
      .sort((a, b) => b.leadershipScore - a.leadershipScore)
      .slice(0, 10);
    
    console.log('\n🏆 Top Leadership Candidates:');
    topCandidates.forEach((candidate, index) => {
      const roleNames = candidate.roles.map(r => r.role.name).join(', ');
      console.log(`${index + 1}. ${candidate.name} - Score: ${candidate.leadershipScore} (${roleNames})`);
    });
  }

  async makeHierarchyDecisions() {
    console.log('\n🧠 Making Hierarchy Decisions...');
    console.log('-' .repeat(50));
    
    // Define organizational hierarchy structure
    const organizationalHierarchy = {
      'EXEC-01': { reportsTo: null, priority: 1 },
      'IT-01': { reportsTo: 'EXEC-01', priority: 2 },
      'HR-01': { reportsTo: 'EXEC-01', priority: 2 },
      'FIN-01': { reportsTo: 'EXEC-01', priority: 2 },
      'SALES-01': { reportsTo: 'EXEC-01', priority: 2 },
      'BE-01': { reportsTo: 'IT-01', priority: 3 },
      'FE-01': { reportsTo: 'IT-01', priority: 3 },
      'QA-01': { reportsTo: 'IT-01', priority: 3 },
      'DEVOPS-01': { reportsTo: 'IT-01', priority: 3 },
      'TA-01': { reportsTo: 'HR-01', priority: 3 }
    };
    
    // Make decisions for each department
    for (const [deptId, analysis] of this.departmentAnalysis) {
      const hierarchyInfo = organizationalHierarchy[analysis.code];
      
      let decision = {
        departmentId: deptId,
        departmentName: analysis.name,
        departmentCode: analysis.code,
        currentHead: analysis.currentHead,
        recommendedHead: null,
        headReason: '',
        managerAssignments: [],
        priority: hierarchyInfo?.priority || 999
      };
      
      // Decide on department head
      if (!analysis.currentHead && analysis.leadershipCandidates.length > 0) {
        const bestCandidate = analysis.leadershipCandidates[0];
        decision.recommendedHead = bestCandidate.user;
        decision.headReason = `Highest leadership score (${bestCandidate.score}) based on role, experience, and salary`;
      } else if (analysis.currentHead) {
        decision.headReason = 'Already has assigned head';
      } else {
        decision.headReason = 'No suitable candidates found';
      }
      
      // Decide on manager assignments for department employees
      const departmentHead = decision.recommendedHead || analysis.currentHead;
      
      if (departmentHead) {
        // Regular employees report to department head
        analysis.employees.forEach(emp => {
          if (emp.id !== departmentHead.id && !emp.managerId) {
            decision.managerAssignments.push({
              employeeId: emp.id,
              employeeName: `${emp.firstName} ${emp.lastName}`,
              managerId: departmentHead.id,
              managerName: `${departmentHead.firstName} ${departmentHead.lastName}`,
              reason: 'Reports to department head'
            });
          }
        });
        
        // Department head reports to parent department head
        if (hierarchyInfo?.reportsTo) {
          const parentDept = Array.from(this.departmentAnalysis.values())
            .find(dept => dept.code === hierarchyInfo.reportsTo);
          
          if (parentDept) {
            const parentHead = parentDept.currentHead || 
              (parentDept.leadershipCandidates.length > 0 ? parentDept.leadershipCandidates[0].user : null);
            
            if (parentHead && parentHead.id !== departmentHead.id) {
              decision.managerAssignments.push({
                employeeId: departmentHead.id,
                employeeName: `${departmentHead.firstName} ${departmentHead.lastName}`,
                managerId: parentHead.id,
                managerName: `${parentHead.firstName} ${parentHead.lastName}`,
                reason: 'Department head reports to parent department head'
              });
            }
          }
        }
      }
      
      this.hierarchyDecisions.push(decision);
    }
    
    // Sort decisions by priority
    this.hierarchyDecisions.sort((a, b) => a.priority - b.priority);
    
    console.log('\n📋 Hierarchy Decisions Summary:');
    this.hierarchyDecisions.forEach(decision => {
      console.log(`\n🏢 ${decision.departmentName}:`);
      if (decision.recommendedHead) {
        console.log(`   👑 Recommended Head: ${decision.recommendedHead.firstName} ${decision.recommendedHead.lastName}`);
        console.log(`   📝 Reason: ${decision.headReason}`);
      }
      console.log(`   👥 Manager Assignments: ${decision.managerAssignments.length}`);
    });
  }

  async loginAsAdmin() {
    try {
      console.log('\n🔐 Logging in as admin...');
      const response = await axios.post(`${BASE_URL.replace('/v2', '/v1')}/general/login`, ADMIN_CREDENTIALS);
      this.adminSessionCookies = response.headers['set-cookie'];
      console.log('✅ Admin login successful');
    } catch (error) {
      console.error('❌ Admin login failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async executeDepartmentHeadAssignments() {
    console.log('\n👑 Executing Department Head Assignments...');
    console.log('-' .repeat(50));
    
    const config = this.getRequestConfig();
    let headsAssigned = 0;
    
    for (const decision of this.hierarchyDecisions) {
      if (decision.recommendedHead && !decision.currentHead) {
        try {
          await axios.put(
            `${BASE_URL}/department/${decision.departmentId}/head/${decision.recommendedHead.id}`,
            {},
            config
          );
          
          console.log(`✅ ${decision.departmentName}: Assigned ${decision.recommendedHead.firstName} ${decision.recommendedHead.lastName} as head`);
          headsAssigned++;
          
          // Small delay
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`❌ Failed to assign head for ${decision.departmentName}:`, error.response?.data || error.message);
        }
      }
    }
    
    console.log(`📊 Total department heads assigned: ${headsAssigned}`);
  }

  async executeManagerAssignments() {
    console.log('\n👨‍💼 Executing Manager Assignments...');
    console.log('-' .repeat(50));
    
    const config = this.getRequestConfig();
    let managersAssigned = 0;
    
    for (const decision of this.hierarchyDecisions) {
      for (const assignment of decision.managerAssignments) {
        try {
          await axios.put(
            `${BASE_URL}/user/${assignment.employeeId}/manager/${assignment.managerId}`,
            {},
            config
          );
          
          console.log(`✅ ${assignment.employeeName} → Manager: ${assignment.managerName}`);
          managersAssigned++;
          
          // Small delay
          await new Promise(resolve => setTimeout(resolve, 50));
          
        } catch (error) {
          console.error(`❌ Failed to assign manager for ${assignment.employeeName}:`, error.response?.data || error.message);
        }
      }
    }
    
    console.log(`📊 Total manager assignments: ${managersAssigned}`);
  }

  async generateAnalysisReport() {
    console.log('\n📊 Enhanced Hierarchy Analysis Report');
    console.log('=' .repeat(70));
    
    // Organization Overview
    console.log('\n🏢 Organization Overview:');
    console.log('-' .repeat(30));
    console.log(`Total Departments: ${this.departmentAnalysis.size}`);
    console.log(`Total Users: ${this.userAnalysis.size}`);
    console.log(`Hierarchy Decisions Made: ${this.hierarchyDecisions.length}`);
    
    // Department Budget Analysis
    console.log('\n💰 Department Budget Analysis:');
    console.log('-' .repeat(30));
    const sortedByBudget = Array.from(this.departmentAnalysis.values())
      .sort((a, b) => (b.budget || 0) - (a.budget || 0));
    
    sortedByBudget.forEach(dept => {
      if (dept.budget) {
        console.log(`${dept.name}: ₹${(dept.budget / 1000000).toFixed(1)}M (${dept.employeeCount} employees)`);
      }
    });
    
    // Leadership Distribution
    console.log('\n🎯 Leadership Score Distribution:');
    console.log('-' .repeat(30));
    const scoreRanges = { 'High (800+)': 0, 'Medium (400-799)': 0, 'Low (0-399)': 0 };
    
    Array.from(this.userAnalysis.values()).forEach(user => {
      if (user.leadershipScore >= 800) scoreRanges['High (800+)']++;
      else if (user.leadershipScore >= 400) scoreRanges['Medium (400-799)']++;
      else scoreRanges['Low (0-399)']++;
    });
    
    Object.entries(scoreRanges).forEach(([range, count]) => {
      console.log(`${range}: ${count} users`);
    });
    
    // Final Organizational Tree
    console.log('\n🌳 Final Organizational Structure:');
    console.log('-' .repeat(30));
    await this.printFinalOrganizationalTree();
  }

  async printFinalOrganizationalTree() {
    const ceoDecision = this.hierarchyDecisions.find(d => d.departmentCode === 'EXEC-01');
    if (!ceoDecision) {
      console.log('CEO department not found');
      return;
    }
    
    const ceoUser = ceoDecision.recommendedHead || ceoDecision.currentHead;
    if (!ceoUser) {
      console.log('CEO not assigned');
      return;
    }
    
    this.printDecisionTree(ceoUser.id, 0);
  }

  printDecisionTree(userId, level = 0) {
    const userAnalysis = this.userAnalysis.get(userId);
    if (!userAnalysis) return;
    
    const indent = '  '.repeat(level);
    const roleName = userAnalysis.roles.map(r => r.role.name).join(', ');
    
    console.log(`${indent}${level === 0 ? '👑' : '├─'} ${userAnalysis.name} (${roleName})`);
    
    // Find all users who should report to this user
    const directReports = [];
    
    this.hierarchyDecisions.forEach(decision => {
      decision.managerAssignments.forEach(assignment => {
        if (assignment.managerId === userId) {
          directReports.push(assignment.employeeId);
        }
      });
    });
    
    directReports.forEach(reportId => {
      this.printDecisionTree(reportId, level + 1);
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
export async function runEnhancedHierarchySeeder() {
  const seeder = new EnhancedHierarchySeeder();
  await seeder.run();
}

// Export class for direct use
export { EnhancedHierarchySeeder };

// Run directly if this file is executed
if (import.meta.url === `file://${process.argv[1]}`) {
  runEnhancedHierarchySeeder()
    .catch((error) => {
      console.error('❌ Enhanced Hierarchy Seeder failed:', error);
      process.exit(1);
    });
}
