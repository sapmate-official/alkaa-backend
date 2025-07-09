# Smart Hierarchy Seeders

This directory contains intelligent hierarchy seeders that analyze your existing organizational structure and automatically assign department heads and managers based on role hierarchy, experience, and organizational best practices.

## 📋 Overview

After running the basic `OrganizationSeeder.js`, you'll have departments and employees, but no department heads or manager assignments. These smart seeders solve that problem by:

1. **Analyzing** existing organizational data
2. **Identifying** the best candidates for leadership roles
3. **Assigning** department heads based on intelligent scoring
4. **Setting up** proper manager-employee relationships
5. **Establishing** organizational reporting hierarchy

## 🔧 Available Seeders

### 1. SmartHierarchySeeder.js (API-based)
- **Approach**: Uses API calls to fetch and analyze data
- **Best for**: Standard setups where API access is preferred
- **Features**:
  - Role-based leadership scoring
  - Experience and salary analysis
  - Automatic department head assignment
  - Manager-employee relationship setup
  - Organizational tree generation

### 2. EnhancedHierarchySeeder.js (Database + API)
- **Approach**: Direct database analysis combined with API operations
- **Best for**: More complex analysis and detailed insights
- **Features**:
  - Deep organizational structure analysis
  - Budget and department correlation analysis
  - Advanced leadership candidate scoring
  - Comprehensive reporting and insights
  - Multi-level hierarchy decision making

## 🚀 Quick Start

### Prerequisites
1. ✅ Backend server running on `http://localhost:3000`
2. ✅ `OrganizationSeeder.js` has been run successfully
3. ✅ Admin user exists: `admin@techvantage.com` / `password`
4. ✅ All employees are activated with password: `password`

### Run the Seeder

```bash
# Navigate to the seed directory
cd alkaa-backend/src/seed

# Option 1: Run the Enhanced Seeder (Recommended)
node HierarchySeederRunner.js enhanced

# Option 2: Run the Smart Seeder (API-only)
node HierarchySeederRunner.js smart

# Option 3: Run individual seeders directly
node EnhancedHierarchySeeder.js
# or
node SmartHierarchySeeder.js
```

## 🎯 How It Works

### Leadership Scoring Algorithm

The seeders use an intelligent scoring system to identify the best candidates for department heads:

```javascript
Role Weights:
- CEO: 1000 points
- CTO: 900 points
- HR Director: 850 points
- Engineering Manager: 800 points
- Finance Manager: 750 points
- Sales Manager: 750 points
- Senior Software Engineer: 600 points
- Software Engineer: 400 points
- QA Engineer: 400 points
// ... and more

Experience Bonus: +15 points per year
Salary Indicator: +1 point per ₹100,000
```

### Organizational Hierarchy

The seeders establish this organizational structure:

```
CEO (Rajesh Sharma) - Executive Leadership
├── CTO (Priya Patel) - Information Technology
│   ├── Backend Manager (Arjun Kumar) - Backend Development
│   ├── Frontend Manager (Karan Malhotra) - Frontend Development
│   ├── QA Manager (Shweta Bansal) - Quality Assurance
│   └── DevOps Manager (Sanjay Iyer) - DevOps & Infrastructure
├── HR Director (Anita Reddy) - Human Resources
│   └── TA Lead (Sneha Agarwal) - Talent Acquisition
├── Finance Manager (Madhuri Kulkarni) - Finance & Accounting
└── Sales Manager (Gaurav Sinha) - Sales & Marketing
```

## 📊 What Gets Assigned

### Department Heads
- Automatically identifies the best candidate for each department
- Based on role hierarchy, experience, and organizational fit
- Uses API: `PUT /api/v2/department/{id}/head/{userId}`

### Manager Assignments
- **Regular Employees** → Report to their department head
- **Department Heads** → Report to parent department head
- **CEO** → Reports to no one (top of hierarchy)
- Uses API: `PUT /api/v2/user/{id}/manager/{managerId}`

## 📈 Sample Output

```
🧠 Starting Enhanced Hierarchy Analyzer & Seeder...
======================================================================

🔍 Analyzing organizational structure from database...
📋 Organization: TechVantage Solutions Pvt Ltd
🏢 Departments: 10
👥 Users: 50
🎭 Roles: 15

🏢 Department Analysis:
--------------------------------------------------

🏢 Executive Leadership (EXEC-01)
   👥 Employees: 2
   💰 Budget: ₹50.0M
   🎭 Roles: CEO(1), CTO(1)
   👑 Current Head: None assigned
   🎯 Best Candidate: Rajesh Sharma (Score: 1250)

🏢 Information Technology (IT-01)
   👥 Employees: 15
   💰 Budget: ₹80.0M
   🎭 Roles: CTO(1), Engineering Manager(4), Senior Software Engineer(5), Software Engineer(5)
   👑 Current Head: None assigned
   🎯 Best Candidate: Priya Patel (Score: 1150)

👑 Executing Department Head Assignments...
--------------------------------------------------
✅ Executive Leadership: Assigned Rajesh Sharma as head
✅ Information Technology: Assigned Priya Patel as head
✅ Human Resources: Assigned Anita Reddy as head
✅ Finance & Accounting: Assigned Madhuri Kulkarni as head
✅ Sales & Marketing: Assigned Gaurav Sinha as head
✅ Backend Development: Assigned Arjun Kumar as head
✅ Frontend Development: Assigned Karan Malhotra as head
✅ Quality Assurance: Assigned Shweta Bansal as head
✅ DevOps & Infrastructure: Assigned Sanjay Iyer as head
✅ Talent Acquisition: Assigned Sneha Agarwal as head

👨‍💼 Executing Manager Assignments...
--------------------------------------------------
✅ Priya Patel → Manager: Rajesh Sharma
✅ Anita Reddy → Manager: Rajesh Sharma
✅ Madhuri Kulkarni → Manager: Rajesh Sharma
✅ Gaurav Sinha → Manager: Rajesh Sharma
✅ Arjun Kumar → Manager: Priya Patel
✅ Karan Malhotra → Manager: Priya Patel
... (and 40+ more assignments)

📊 Total department heads assigned: 10
📊 Total manager assignments: 48

🎉 Enhanced Hierarchy Seeder completed successfully!
```

## 🔍 Verification

After running the seeder, you can verify the assignments by:

1. **Login to Admin Panel**:
   - URL: `http://localhost:3000/admin`
   - Credentials: `admin@techvantage.com` / `password`

2. **Check Organization Chart**:
   - Navigate to Organization → Organizational Chart
   - Verify the hierarchy structure

3. **Verify Department Heads**:
   - Go to Departments → Department Management
   - Check that each department has an assigned head

4. **Check Manager Assignments**:
   - Go to Employees → Employee Management
   - Verify each employee has a manager assigned

## 🛠️ Troubleshooting

### Common Issues

1. **"No organization found"**
   - Ensure `OrganizationSeeder.js` was run successfully
   - Check that the database contains organization data

2. **"Admin login failed"**
   - Verify admin user exists: `admin@techvantage.com`
   - Confirm admin user is activated with password: `password`

3. **"No suitable candidates found"**
   - Check that employees exist in departments
   - Verify role assignments are correct

4. **API connection errors**
   - Ensure backend server is running on `localhost:3000`
   - Check that all required API endpoints are available

### Debug Mode

For more detailed logging, you can modify the seeders to add debug information:

```javascript
// Add this at the top of any seeder file for more verbose logging
console.log('DEBUG: Detailed analysis...');
```

## 📚 Related Files

- `OrganizationSeeder.js` - Creates basic organization structure (run this first)
- `SmartHierarchySeeder.js` - API-based hierarchy seeder
- `EnhancedHierarchySeeder.js` - Database + API hierarchy seeder
- `HierarchySeederRunner.js` - Convenient runner for both seeders
- `README_Hierarchy.md` - Legacy hierarchy documentation

## 🤝 Contributing

To extend the seeders:

1. **Add new role weights** in the `calculateLeadershipScore` function
2. **Modify hierarchy structure** in the organizational hierarchy maps
3. **Add new analysis criteria** in the analysis functions
4. **Extend reporting** in the report generation functions

## 📄 License

This seeder is part of the Alkaa platform and follows the same license terms.
