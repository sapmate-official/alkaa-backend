# Department Hierarchy & Manager Assignment Setup

This directory contains scripts to set up a complete organizational hierarchy with department heads and manager assignments using only API calls.

## Files Overview

### 1. `DepartmentHeadAssigner.js`
- **Purpose**: Assigns department heads and sets up basic manager relationships
- **Features**:
  - Assigns specific employees as department heads
  - Makes department heads managers of their team members
  - Uses only API endpoints (no direct database manipulation)

### 2. `CompleteHierarchySetup.js`
- **Purpose**: Comprehensive organizational hierarchy setup
- **Features**:
  - Assigns department heads based on organizational structure
  - Sets up hierarchical reporting (CTO reports to CEO, managers report to directors, etc.)
  - Assigns all department employees to their respective heads as managers
  - Validates the complete hierarchy
  - Generates detailed hierarchy reports

### 3. `MasterOrganizationSetup.js`
- **Purpose**: Master script that runs the complete organization setup process
- **Features**:
  - Runs OrganizationSeeder first to create base data
  - Then runs CompleteHierarchySetup to establish relationships
  - Provides comprehensive status reporting

## Organizational Hierarchy Structure

The scripts implement the following hierarchy:

```
CEO (Rajesh Sharma)
├── CTO (Priya Patel)  
│   ├── Backend Engineering Manager (Arjun Kumar)
│   │   └── Backend Engineers
│   ├── Frontend Engineering Manager (Karan Malhotra)
│   │   └── Frontend Engineers & Designers
│   ├── QA Engineering Manager (Shweta Bansal)
│   │   └── QA Engineers
│   └── DevOps Engineering Manager (Sanjay Iyer)
│       └── DevOps Engineers
├── HR Director (Anita Reddy)
│   ├── HR Manager (Vikram Singh)
│   └── Talent Acquisition Specialist (Sneha Agarwal)
│       └── TA Team
├── Finance Manager (Madhuri Kulkarni)
│   └── Accountants
└── Sales Manager (Gaurav Sinha)
    └── Sales Executives
```

## Usage Instructions

### Prerequisites
1. Backend server running on `localhost:3000`
2. Database properly configured and accessible
3. Super admin account created with credentials:
   - Email: `superadmin-test@alkaa.com`
   - Password: `superAdmin-test@2025`

### Running the Scripts

#### Option 1: Complete Setup (Recommended)
```bash
# Run the master script that does everything
node src/seed/MasterOrganizationSetup.js
```

#### Option 2: Step-by-Step Setup
```bash
# Step 1: Create organization, departments, roles, and employees
node src/seed/OrganizationSeeder.js

# Step 2: Set up department heads and manager relationships
node src/seed/CompleteHierarchySetup.js
```

#### Option 3: Just Department Head Assignment
```bash
# If you only want to assign department heads (simpler version)
node src/seed/DepartmentHeadAssigner.js
```

### What Each Script Does

#### DepartmentHeadAssigner.js
1. Logs in as admin user
2. Fetches organization and department data
3. Fetches all users in the organization
4. Assigns department heads using the `/department/:id/head/:userId` API
5. Updates manager assignments for department employees

#### CompleteHierarchySetup.js
1. **Phase 1**: Assigns department heads
2. **Phase 2**: Sets up hierarchical reporting structure
3. **Phase 3**: Assigns department employee managers
4. **Phase 4**: Validates the hierarchy
5. **Phase 5**: Generates comprehensive reports

#### MasterOrganizationSetup.js
1. Runs the complete OrganizationSeeder
2. Waits for data persistence
3. Runs the CompleteHierarchySetup
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
Update the `ORGANIZATIONAL_HIERARCHY` array in `CompleteHierarchySetup.js`:

```javascript
{
  departmentCode: "NEW-DEPT",
  headEmail: "head@company.com",
  headRole: "Department Head",
  reportsTo: "manager@company.com",
  manageDepartments: []
}
```

### Modifying Hierarchy
Change the `reportsTo` and `manageDepartments` fields to adjust reporting structure.

### Different Organization
Update the employee email addresses and department codes to match your organization structure.

## Notes

- All operations use API calls only (no direct database manipulation)
- Scripts include proper error handling and validation
- Delays are added between API calls to avoid overwhelming the server
- Session cookies are properly maintained throughout the process
- Comprehensive logging provides visibility into the setup process
