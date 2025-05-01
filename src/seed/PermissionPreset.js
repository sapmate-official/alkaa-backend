import prisma from "../db/connectDb.js";
import path from 'path';
import { fileURLToPath } from 'url';


export async function createPermissionPresets(orgId) {
  try {
    console.log(`Creating permission presets for organization: ${orgId}`);

    // Group keys by functional area to organize our presets
    const permissions = await prisma.permission.findMany();
    
    // Create categorized permission maps by key pattern
    const presetGroups = {
      userManagement: permissions.filter(p => 
        p.key?.includes('user') || 
        p.key?.includes('personal_info') || 
        p.key?.includes('employment_info') ||
        p.module === 'user'
      ),
      
      departmentManagement: permissions.filter(p => 
        p.key?.includes('department') || 
        p.module === 'Department'
      ),
      
      leaveManagement: permissions.filter(p => 
        p.key?.includes('leave') || 
        p.module === 'Leave'
      ),
      
      attendanceManagement: permissions.filter(p => 
        p.key?.includes('attendance') || 
        p.module === 'Attendance'
      ),
      
      salaryManagement: permissions.filter(p => 
        p.key?.includes('salary') || 
        p.module?.includes('Payroll')
      ),
      
      bankManagement: permissions.filter(p => 
        p.key?.includes('bank') || 
        p.module === 'Bank'
      ),
      
      holidayManagement: permissions.filter(p => 
        p.key?.includes('holiday') || 
        p.module === 'Holiday'
      ),
      
      organizationManagement: permissions.filter(p => 
        p.key?.includes('org_') || 
        p.key?.includes('organization') || 
        p.module === 'Organization'
      ),
      
      notificationManagement: permissions.filter(p => 
        p.module === 'Notification'
      ),
      
      selfServicePermissions: permissions.filter(p => 
        p.key?.includes('own') || 
        p.key?.includes('_to_myself') ||
        p.key === 'mark_attendance' ||
        p.key === 'leave_request' ||
        p.key?.includes('update_personal_info') ||
        p.key?.includes('view_personal_info_to_myself') ||
        p.key?.includes('view_employment_info_to_myself') ||
        p.key?.includes('update_bank_own') ||
        p.key?.includes('view_salary_slip_to_myself')
      ),
      
      teamLeadPermissions: permissions.filter(p => 
        p.key?.includes('subordinates') ||
        p.key?.includes('team') ||
        p.key === 'approve_leave' ||
        p.key === 'reject_leave'
      )
    };

    // Create preset definitions
    const presets = [
      {
        name: "Administrator",
        description: "Full access to all system features and data",
        permissions: permissions.map(p => p.id)
      },
      {
        name: "HR Manager",
        description: "Manage employees, departments, leave, and attendance",
        permissions: [
          ...presetGroups.userManagement.map(p => p.id),
          ...presetGroups.departmentManagement.map(p => p.id),
          ...presetGroups.leaveManagement.map(p => p.id),
          ...presetGroups.attendanceManagement.map(p => p.id),
          ...presetGroups.salaryManagement.map(p => p.id),
          ...presetGroups.holidayManagement.map(p => p.id),
          ...presetGroups.selfServicePermissions.map(p => p.id)
        ]
      },
      {
        name: "Department Manager",
        description: "Manage team members, approve requests, view department data",
        permissions: [
          ...presetGroups.teamLeadPermissions.map(p => p.id),
          ...presetGroups.selfServicePermissions.map(p => p.id),
          ...permissions.filter(p => 
            p.key === 'view_employee_management' ||
            p.key === 'view_organization_basic_details' ||
            p.key === 'view_own_department_info' ||
            p.key === 'view_list_of_department' ||
            p.key === 'see_team_details' ||
            p.key === 'generate_attendance_report'
          ).map(p => p.id)
        ]
      },
      {
        name: "Finance Manager",
        description: "Manage payroll and salary aspects of the organization",
        permissions: [
          ...presetGroups.salaryManagement.map(p => p.id),
          ...presetGroups.bankManagement.map(p => p.id),
          ...permissions.filter(p => 
            p.key === 'view_all_users' ||
            p.key === 'view_organization_basic_details' ||
            p.key === 'view_employment_info_of_all'
          ).map(p => p.id),
          ...presetGroups.selfServicePermissions.map(p => p.id)
        ]
      },
      {
        name: "Team Lead",
        description: "Manage team members and approve requests",
        permissions: [
          ...presetGroups.teamLeadPermissions.map(p => p.id),
          ...presetGroups.selfServicePermissions.map(p => p.id),
          ...permissions.filter(p => 
            p.key === 'view_own_department_info' ||
            p.key === 'see_team_details'
          ).map(p => p.id)
        ]
      },
      {
        name: "Employee",
        description: "Basic self-service access for regular employees",
        permissions: [
          ...presetGroups.selfServicePermissions.map(p => p.id),
          ...permissions.filter(p => 
            p.key === 'holiday_view'
          ).map(p => p.id)
        ]
      }
    ];

    // Create presets in database
    for (const preset of presets) {
      await prisma.permissionPreset.upsert({
        where: {
          orgId_name: { 
            orgId, 
            name: preset.name 
          }
        },
        update: {
          description: preset.description,
          permissions: preset.permissions
        },
        create: {
          orgId,
          name: preset.name,
          description: preset.description,
          permissions: preset.permissions,
        }
      });
      console.log(`Created/updated preset: ${preset.name}`);
    }

    return {
      success: true,
      message: `Created ${presets.length} permission presets for organization ${orgId}`
    };
  } catch (error) {
    console.error("Error creating permission presets:", error);
    return {
      success: false,
      message: error.message
    };
  }
}

// Function to initialize presets for an organization
export async function initializePresetsForOrg(orgId) {
  return createPermissionPresets(orgId);
}

// For direct execution during setup or from command line
if (process.argv[2] === "--seed") {
  const orgId = process.argv[3];
  if (!orgId) {
    console.error("Please provide an organization ID as parameter");
    process.exit(1);
  }
  
  createPermissionPresets(orgId)
    .then(result => {
      console.log(result.message);
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error("Failed to create presets:", err);
      process.exit(1);
    });
}