# Department Hierarchy Setup Scripts

This directory contains scripts to set up a complete organizational hierarchy with department heads and manager assignments using only API calls.

## Files Overview

### Core Scripts
- **`DepartmentHierarchySetup.js`** - Main script to assign department heads and set up manager relationships
- **`HierarchyValidator.js`** - Validation and reporting tool for the organizational hierarchy
- **`MasterHierarchySetup.js`** - Master script that runs both setup and validation

### Legacy Scripts (for reference)
- **`DepartmentHeadAssigner.js`** - Basic department head assignment (superseded by DepartmentHierarchySetup.js)
- **`CompleteHierarchySetup.js`** - Advanced hierarchy setup (integrated into DepartmentHierarchySetup.js)

## Organizational Hierarchy Structure

Based on the OrganizationSeeder, the following hierarchy is established:

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

## Prerequisites

1. **Backend Server**: Must be running on `http://localhost:3000`
2. **OrganizationSeeder**: Must have been run successfully to create:
   - Organization (TechVantage Solutions Pvt Ltd)
   - 10 departments with proper hierarchy
   - 50+ employees with realistic data
   - Admin user with proper permissions
3. **Database**: All users must be activated with default password: `password`

## Usage Instructions

### Quick Start (Recommended)

Run the master script that handles everything:

```bash
cd backend/src/seed
node MasterHierarchySetup.js
```

### Individual Scripts

#### 1. Setup Department Hierarchy
```bash
node DepartmentHierarchySetup.js
```
**What it does:**
- Assigns department heads based on organizational structure
- Sets up manager-employee relationships within departments
- Establishes cross-departmental reporting (e.g., managers report to CTO/CEO)

#### 2. Validate Hierarchy
```bash
node HierarchyValidator.js
```
**What it does:**
- Validates all department head assignments
- Checks manager-employee relationships
- Identifies orphaned employees or circular references
- Generates comprehensive hierarchy reports

### What Each Script Does

#### DepartmentHierarchySetup.js
1. **Phase 1**: Assigns department heads using `/department/:id/head/:userId` API
2. **Phase 2**: Sets up hierarchical reporting structure (managers report to higher-level managers)
3. **Phase 3**: Assigns department employees to their heads as managers
4. **Phase 4**: Generates final hierarchy report

#### HierarchyValidator.js
1. Validates department head assignments
2. Checks manager-employee relationships
3. Detects hierarchy integrity issues (circular references, mismatches)
4. Generates comprehensive reports with statistics and recommendations

#### MasterHierarchySetup.js
1. Runs the complete DepartmentHierarchySetup
2. Waits for data persistence
3. Runs the HierarchyValidator
4. Provides final status report

## API Endpoints Used

The scripts use the following API endpoints:

- `POST /api/v1/general/login` - Admin authentication
- `GET /api/v2/organization` - Fetch organization data
- `GET /api/v2/department/org/:orgId` - Fetch departments
- `GET /api/v2/user/org/:orgId` - Fetch organization users
- `PUT /api/v2/department/:id/head/:userId` - Assign department head
- `PUT /api/v2/user/:id` - Update user (including manager assignment)
- `GET /api/v2/organization/:orgId/chart` - Fetch organization chart

## Expected Output

### Success Indicators
- ✅ All departments have assigned heads
- ✅ All employees (except CEO) have assigned managers
- ✅ Department heads manage their respective teams
- ✅ Hierarchical reporting structure is established
- ✅ No validation errors in final check

### Login Credentials After Setup
- **Super Admin**: `superadmin-test@alkaa.com` / `superAdmin-test@2025`
- **Org Admin**: `admin@techvantage.com` / `password`
- **All Employees**: `[employee-email]` / `password`

## Validation & Testing

After running the scripts, you can verify the setup by:

1. **Frontend Testing**:
   - Login to admin panel
   - Navigate to Organization Chart
   - Verify department structure and heads
   - Check employee management screens

2. **API Testing**:
   - Use the organization chart API to verify relationships
   - Check subordinate lists for managers
   - Verify department head permissions

3. **Workflow Testing**:
   - Test leave approval workflows (employees → managers → heads)
   - Check payroll generation permissions
   - Verify attendance management access

## Troubleshooting

### Common Issues

1. **Authentication Errors**:
   - Ensure backend server is running
   - Verify super admin credentials
   - Check if admin user exists and is activated

2. **Department/User Not Found**:
   - Run OrganizationSeeder first
   - Ensure all data was created successfully
   - Check for any API endpoint changes

3. **Permission Errors**:
   - Verify admin user has proper roles
   - Check if organization was created successfully
   - Ensure proper session cookies are maintained

### Debug Mode
Add `console.log` statements in the scripts to debug:
- API response data
- Session cookie handling
- User/department lookups

## Customization

### Adding New Departments
Update the `DEPARTMENT_HEAD_ASSIGNMENTS` array in `DepartmentHierarchySetup.js`:

```javascript
{
  departmentCode: "NEW-DEPT",
  headEmail: "head@company.com",
  headRole: "Department Head",
  reportsTo: "manager@company.com"
}
```

### Modifying Hierarchy
Change the `reportsTo` field to adjust reporting structure.

### Different Organization
Update the employee email addresses and department codes to match your organization structure.

## Notes

- All operations use API calls only (no direct database manipulation)
- Scripts include proper error handling and validation
- Delays are added between API calls to avoid overwhelming the server
- Session cookies are properly maintained throughout the process
- Comprehensive logging provides visibility into the setup process

## Integration with Frontend

After running these scripts, the following frontend features will work properly:

1. **Organization Chart**: Shows complete hierarchy with proper reporting relationships
2. **Employee Management**: Allows assigning employees to departments with proper managers
3. **Leave Management**: Enables proper approval workflows through the hierarchy
4. **Department Management**: Shows department heads and employee counts
5. **Attendance Management**: Allows managers to view and approve subordinate attendance

The hierarchy setup ensures that all manager-employee relationships are properly established for workflow and permission systems to function correctly.
