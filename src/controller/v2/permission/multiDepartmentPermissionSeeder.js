import prisma from "../../../db/connectDb.js";

/**
 * Multi-Department Permission Seeder
 * Creates permissions specific to multi-department functionality
 */

export const seedMultiDepartmentPermissions = async () => {
    try {
        const multiDepartmentPermissions = [
            // Department Assignment Permissions
            {
                key: 'assign_user_to_multiple_departments',
                name: 'assign_user_to_multiple_departments',
                description: 'Assign users to multiple departments',
                module: 'Department',
                action: 'Multi-Assign'
            },
            {
                key: 'remove_user_from_department',
                name: 'remove_user_from_department', 
                description: 'Remove users from departments',
                module: 'Department',
                action: 'Remove'
            },
            {
                key: 'set_primary_department',
                name: 'set_primary_department',
                description: 'Set primary department for users',
                module: 'Department', 
                action: 'Set Primary'
            },
            {
                key: 'view_multi_department_assignments',
                name: 'view_multi_department_assignments',
                description: 'View multi-department assignments',
                module: 'Department',
                action: 'View Assignments'
            },

            // Enhanced Department Viewing Permissions
            {
                key: 'view_department_attendance',
                name: 'view_department_attendance',
                description: 'View attendance for specific departments',
                module: 'Attendance',
                action: 'View Department'
            },
            {
                key: 'view_cross_department_reports',
                name: 'view_cross_department_reports',
                description: 'View reports across multiple departments',
                module: 'Reports',
                action: 'Cross Department'
            },

            // Department Management Permissions
            {
                key: 'manage_department_hierarchy',
                name: 'manage_department_hierarchy',
                description: 'Manage department hierarchy and relationships',
                module: 'Department',
                action: 'Manage Hierarchy'
            },
            {
                key: 'view_department_analytics',
                name: 'view_department_analytics',
                description: 'View department-specific analytics',
                module: 'Analytics',
                action: 'Department Analytics'
            },

            // Leave Management with Multi-Department Context
            {
                key: 'approve_cross_department_leaves',
                name: 'approve_cross_department_leaves',
                description: 'Approve leaves for users across multiple departments',
                module: 'Leave',
                action: 'Cross Department Approval'
            },
            {
                key: 'view_department_leave_summary',
                name: 'view_department_leave_summary',
                description: 'View leave summaries for specific departments',
                module: 'Leave',
                action: 'Department Summary'
            }
        ];

        console.log('Seeding multi-department permissions...');

        for (const permission of multiDepartmentPermissions) {
            const existingPermission = await prisma.permission.findFirst({
                where: { key: permission.key }
            });

            if (!existingPermission) {
                await prisma.permission.create({
                    data: permission
                });
                console.log(`✓ Created permission: ${permission.key}`);
            } else {
                console.log(`- Permission already exists: ${permission.key}`);
            }
        }

        console.log('Multi-department permissions seeding completed!');

    } catch (error) {
        console.error('Error seeding multi-department permissions:', error);
        throw error;
    }
};

/**
 * Create permission presets for multi-department roles
 */
export const createMultiDepartmentRolePresets = async (orgId) => {
    try {
        const presets = [
            {
                name: 'Department Head - Multi Department',
                description: 'Department head with multi-department oversight capabilities',
                permissions: [
                    'view_multi_department_assignments',
                    'view_department_attendance', 
                    'view_department_analytics',
                    'approve_cross_department_leaves',
                    'view_department_leave_summary'
                ]
            },
            {
                name: 'HR Manager - Multi Department',
                description: 'HR manager with full multi-department management capabilities',
                permissions: [
                    'assign_user_to_multiple_departments',
                    'remove_user_from_department',
                    'set_primary_department',
                    'view_multi_department_assignments',
                    'view_cross_department_reports',
                    'manage_department_hierarchy',
                    'view_department_analytics',
                    'approve_cross_department_leaves'
                ]
            },
            {
                name: 'Operations Manager - Cross Department',
                description: 'Operations manager with cross-departmental oversight',
                permissions: [
                    'view_multi_department_assignments',
                    'view_cross_department_reports',
                    'view_department_attendance',
                    'view_department_analytics'
                ]
            }
        ];

        for (const preset of presets) {
            const existingPreset = await prisma.permissionPreset.findFirst({
                where: { 
                    orgId,
                    name: preset.name
                }
            });

            if (!existingPreset) {
                await prisma.permissionPreset.create({
                    data: {
                        orgId,
                        ...preset
                    }
                });
                console.log(`✓ Created role preset: ${preset.name}`);
            } else {
                console.log(`- Role preset already exists: ${preset.name}`);
            }
        }

    } catch (error) {
        console.error('Error creating multi-department role presets:', error);
        throw error;
    }
};

// Export function to run the seeder
export default async function runMultiDepartmentSeeder() {
    try {
        await seedMultiDepartmentPermissions();
        console.log('Multi-department permission seeder completed successfully!');
    } catch (error) {
        console.error('Multi-department permission seeder failed:', error);
        process.exit(1);
    }
}

// Run seeder if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runMultiDepartmentSeeder();
}
