# Payroll Permission Seeder

This seeder creates all the necessary payroll permissions in the database using API endpoints.

## Permissions Created

The seeder creates 14 payroll-related permissions:

### Salary Generation
- **Generate Self Salary** (`generate_salary_to_myself`) - Permission to generate own salary
- **Generate All Salaries** (`generate_salary_of_all`) - Permission to generate salary for all employees
- **Bulk Generate Salaries** (`bulk_generate_salaries`) - Permission to perform bulk salary generation

### Payroll Cycle Management
- **Create Payroll Cycle** (`create_payroll_cycle`) - Permission to create new payroll cycles
- **Start Payroll Cycle** (`start_payroll_cycle`) - Permission to start payroll cycle processing
- **Approve Payroll Cycle** (`approve_payroll_cycle`) - Permission to approve completed payroll cycles
- **View Payroll Cycles** (`view_payroll_cycles`) - Permission to view payroll cycles
- **Review Payroll Cycles** (`review_payroll_cycles`) - Permission to review payroll cycles for approval

### Salary Slip Access
- **View Own Salary Slip** (`view_salary_slip_to_myself`) - Permission to view own salary slip
- **View Subordinate Salary Slips** (`view_salary_slip_of_subordinates`) - Permission to view salary slips of subordinates
- **View All Salary Slips** (`view_salary_slip_of_all`) - Permission to view salary slips of all employees

### General Access
- **Access Payroll** (`access_payroll`) - Basic permission to access payroll module
- **View Payroll Statistics** (`view_payroll_statistics`) - Permission to view payroll statistics and analytics
- **Admin Access** (`admin_access`) - Full administrative access to all modules

## Usage

### Prerequisites

1. Ensure the backend server is running
2. Have admin credentials ready
3. Ensure categories and subcategories exist in the database

### Environment Variables

Create a `.env` file or set the following environment variables:

```bash
BACKEND_URL=http://localhost:8000  # Backend server URL
ADMIN_EMAIL=admin@example.com      # Admin user email
ADMIN_PASSWORD=admin123            # Admin user password
```

### Running the Seeder

#### Option 1: Using npm script (Recommended)
```bash
npm run seed:payroll-permissions
```

#### Option 2: Direct execution
```bash
node src/seed/runPayrollSeeder.js
```

#### Option 3: Using the seeder class directly
```javascript
import PayrollPermissionSeeder from './PayrollPermissionSeeder.js';

const seeder = new PayrollPermissionSeeder();
await seeder.run();
```

## How It Works

1. **Authentication**: Authenticates using admin credentials via `/api/v2/auth/login`
2. **Structure Check**: Fetches existing categories and subcategories
3. **Permission Creation**: Creates each permission using `/api/v3/permission/permission` endpoint
4. **Duplicate Handling**: Skips permissions that already exist
5. **Error Handling**: Provides detailed logging and error reporting

## Output

The seeder provides detailed console output including:
- Authentication status
- Permission creation progress
- Duplicate detection
- Final summary with counts of created, skipped, and failed permissions

## Error Handling

- **Authentication Failures**: Stops execution with clear error message
- **Missing Subcategories**: Warns and attempts to use available subcategories
- **Duplicate Permissions**: Skips existing permissions without error
- **API Errors**: Logs detailed error information and continues with remaining permissions

## Files

- `PayrollPermissionSeeder.js` - Main seeder class with all functionality
- `runPayrollSeeder.js` - Runner script for easy execution
- `PAYROLL_PERMISSIONS_SEEDER_README.md` - This documentation

## Integration

This seeder integrates with the existing permission system and uses the same API endpoints that the frontend uses, ensuring consistency with the application's permission management workflow.