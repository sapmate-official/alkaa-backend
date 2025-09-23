import prisma from '../../../db/connectDb.js';
import { body, validationResult } from 'express-validator';
import { initializePresetsForOrg } from '../../../seed/PermissionPreset.js';
import { sendEmailWithCustomContent, sendPasswordResetEmail, sendWelcomeEmailToAdmin } from '../../../util/sendEmail.js';

// Get all organizations
const getOrganization = async (req, res) => {
    try {
        const organizations = await prisma.organization.findMany({
            include: {
                users: {
                    select:{
                        firstName: true,
                        lastName: true,
                    }
                },
                subscriptionPlan: true,
            }
        });
        res.status(200).json(organizations);
    } catch (error) {
        console.log(error);
        
        res.status(500).json({ error: error.message });
    }
};
//get organisation by id
const getOrganizationById = async (req, res) => {
    try {
        const id = req.params.id;
        const organization = await prisma.organization.findUnique({
            where: {
                id: id
            },
            include: {
                users: true,
                departments: true,
                subscriptionPlan: true,
            }
        });
        res.status(200).json(organization);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create a new organization
const createOrganization = [
    body('name').notEmpty().withMessage('Name is required'),
    body('industry').optional().notEmpty().withMessage('Industry is required'),
    body('subscriptionPlanId').notEmpty().withMessage('Subscription Plan is required'),
    body('subscriptionEnd').optional().isISO8601().withMessage('Subscription End must be a valid date'),
    body('isActive').optional().isBoolean().withMessage('IsActive must be a boolean'),
    body('settings').optional().isJSON().withMessage('Settings must be a valid JSON'),

    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, industry, subscriptionPlanId, subscriptionEnd, isActive, settings } = req.body;
        try {
            const newOrganization = await prisma.organization.create({
                data: {
                    name,
                    industry,
                    subscriptionPlanId,
                    subscriptionEnd,
                    isActive,
                    settings
                }
            });
            const newSettings = await prisma.organizationSettings.create({
                data: {
                    orgId: newOrganization.id,
                    settings: {
                        weekoff: [0, 6]
                    }   
                }
            });
            initializePresetsForOrg(newOrganization.id);
            console.log("New organization created with ID:", newOrganization.id);
            console.log(newSettings);
            console.log(newOrganization);
            
            res.status(201).json(newOrganization);
        } catch (error) {
            console.log(error);
            
            res.status(500).json({ error: error.message });
        }
    }
];

// Update an organization
const updateOrganization = [
    body('id').notEmpty().withMessage('ID is required'),
    body('name').optional().notEmpty().withMessage('Name is required'),
    body('industry').optional().notEmpty().withMessage('Industry is required'),
    body('subscriptionPlanId').optional(),  // Remove notEmpty() validation to allow null
    body('subscriptionEnd').optional().isISO8601().withMessage('Subscription End must be a valid date'),
    body('isActive').optional().isBoolean().withMessage('IsActive must be a boolean'),

    async (req, res) => {
        const errors = validationResult(req);
        console.log(req.body);
        
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id, name, industry, subscriptionPlanId, subscriptionEnd, isActive, settings } = req.body;
        try {
            const updatedOrganization = await prisma.organization.update({
                where: { id },
                data: {
                    ...(name !== undefined && { name }),
                    ...(industry !== undefined && { industry }),
                    ...(subscriptionPlanId !== undefined && { subscriptionPlanId }),  // Changed from truthy check to undefined check
                    ...(subscriptionEnd !== undefined && { subscriptionEnd }),
                    ...(isActive !== undefined && { isActive }),
                    ...(settings !== undefined && { settings })
                }
            });
            res.status(200).json(updatedOrganization);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
];

// Delete an organization
const deleteOrganization = [
    body('id').notEmpty().withMessage('ID is required'),

    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.body;
        
        try {
            // Use a transaction with increased timeout to ensure either all deletes succeed or none do
            await prisma.$transaction(async (tx) => {
                console.log('Starting organization deletion transaction...');
                
                // 1. Delete organization settings
                console.log('Deleting organization settings...');
                await tx.organizationSettings.deleteMany({
                    where: { orgId: id }
                });
                
                // 2. Find all users belonging to this organization
                console.log('Finding organization users...');
                const users = await tx.user.findMany({
                    where: { orgId: id },
                    select: { id: true }
                });
                
                const userIds = users.map(user => user.id);
                console.log(`Found ${userIds.length} users to delete`);
                
                if (userIds.length > 0) {
                    // 3. Delete user-related records in batches for better performance
                    console.log('Deleting user daily reports...');
                    await tx.userDailyReport.deleteMany({
                        where: {
                            attendance: {
                                userId: { in: userIds }
                            }
                        }
                    });
                    
                    console.log('Deleting attendance records...');
                    await tx.attendanceRecord.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    console.log('Deleting push subscriptions...');
                    await tx.pushSubscription.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    console.log('Deleting notifications...');
                    await tx.notification.deleteMany({ 
                        where: { userId: { in: userIds } }
                    });
                    
                    console.log('Deleting leave balances and requests...');
                    await tx.leaveBalance.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    await tx.leaveRequest.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    console.log('Deleting salary transactions...');
                    await tx.salaryTransactionTable.deleteMany({
                        where: { 
                            salaryRecord: { 
                                userId: { in: userIds } 
                            } 
                        }
                    });
                    
                    console.log('Deleting salary records...');
                    await tx.salaryRecord.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    console.log('Deleting salary parameters...');
                    await tx.salaryParameter.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    console.log('Deleting bank details...');
                    await tx.bankDetails.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    console.log('Deleting transaction records...');
                    await tx.transactionTable.deleteMany({
                        where: { 
                            OR: [
                                { senderUserId: { in: userIds } },
                                { recieverUserId: { in: userIds } }
                            ]
                        }
                    });
                    
                    console.log('Deleting user roles...');
                    await tx.userRole.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    console.log('Deleting organization admins...');
                    await tx.organization_admin.deleteMany({
                        where: { orgId: id }
                    });
                    
                    // Delete additional user-related records from the schema
                    console.log('Deleting additional user records...');
                    
                    // Delete attendance-related records
                    await tx.attendanceAlert.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    await tx.breakRecord.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    await tx.geofenceViolation.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    await tx.progressivePenaltyHistory.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    // Delete shift and employee records
                    await tx.employeeShift.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    // Delete task-related records
                    await tx.taskUpdate.deleteMany({
                        where: { updatedById: { in: userIds } }
                    });
                    
                    await tx.taskAssignment.deleteMany({
                        where: { 
                            OR: [
                                { assignedToId: { in: userIds } },
                                { assignedById: { in: userIds } }
                            ]
                        }
                    });
                    
                    await tx.taskGroupMember.deleteMany({
                        where: { 
                            OR: [
                                { userId: { in: userIds } },
                                { addedById: { in: userIds } }
                            ]
                        }
                    });
                    
                    // Delete other user-related records
                    await tx.emailOtpVerification.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    await tx.tempLoginSession.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    await tx.salaryDispute.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    // Delete user departments
                    await tx.userDepartment.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                }
                
                // 4. Delete organization-specific records
                console.log('Deleting organization-specific records...');
                
                // Delete role permissions and roles
                const roles = await tx.role.findMany({
                    where: { orgId: id },
                    select: { id: true }
                });
                
                const roleIds = roles.map(role => role.id);
                
                if (roleIds.length > 0) {
                    await tx.rolePermission.deleteMany({
                        where: { roleId: { in: roleIds } }
                    });
                }
                
                await tx.role.deleteMany({
                    where: { orgId: id }
                });
                
                // Delete leave types
                await tx.leaveType.deleteMany({
                    where: { orgId: id }
                });
                
                // Delete notification templates
                await tx.notificationTemplate.deleteMany({
                    where: { orgId: id }
                });
                
                // Delete holidays and holiday types
                await tx.holiday.deleteMany({
                    where: { orgId: id }
                });
                
                await tx.holidayType.deleteMany({
                    where: { orgId: id }
                });
                
                // Delete attendance and geofence records
                await tx.organizationAttendanceRules.deleteMany({
                    where: { orgId: id }
                });
                
                await tx.organizationGeofence.deleteMany({
                    where: { orgId: id }
                });
                
                await tx.organizationBreakRules.deleteMany({
                    where: { orgId: id }
                });
                
                // Delete shift templates
                await tx.shiftTemplate.deleteMany({
                    where: { orgId: id }
                });
                
                // Delete payroll-related records
                await tx.payrollTemplate.deleteMany({
                    where: { orgId: id }
                });
                
                await tx.payrollCycle.deleteMany({
                    where: { orgId: id }
                });
                
                await tx.salaryTemplate.deleteMany({
                    where: { orgId: id }
                });
                
                await tx.calculationRule.deleteMany({
                    where: { orgId: id }
                });
                
                await tx.workflowStep.deleteMany({
                    where: { orgId: id }
                });
                
                // Delete tasks and task groups
                await tx.task.deleteMany({
                    where: { orgId: id }
                });
                
                await tx.taskGroup.deleteMany({
                    where: { orgId: id }
                });
                
                // Delete onboarding candidates
                await tx.onboardingCandidate.deleteMany({
                    where: { orgId: id }
                });
                
                // Delete departments
                await tx.department.deleteMany({
                    where: { orgId: id }
                });
                
                // Delete users (this should be done after all related records)
                console.log('Deleting users...');
                await tx.user.deleteMany({
                    where: { orgId: id }
                });
                
                // Delete permission presets
                await tx.permissionPreset.deleteMany({
                    where: { orgId: id }
                });
                
                // Delete billing records
                await tx.billingRecord.deleteMany({
                    where: { organizationId: id }
                });
                
                // Delete activity logs (should be last before organization)
                console.log('Deleting activity logs...');
                await tx.activityLog.deleteMany({
                    where: { orgId: id }
                });
                
                // Finally delete the organization itself
                console.log('Deleting organization...');
                await tx.organization.delete({
                    where: { id }
                });
                
                console.log('Organization deletion transaction completed successfully');
            }, {
                maxWait: 15000, // 15 seconds maximum wait
                timeout: 30000, // 30 seconds timeout
            });
            
            res.status(200).json({ message: 'Organization and all related data deleted successfully' });
        } catch (error) {
            console.error("Error deleting organization:", error);
            res.status(500).json({ 
                error: "Failed to delete organization. See server logs for details.",
                message: error.message 
            });
        }
    }
];
const setOrgAdmin = async (req, res) => {
    const { orgId, userId } = req.body;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                orgId: true,
            }
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        if (user.orgId !== orgId) {
            return res.status(403).json({ error: "User does not belong to this organization" });
        }
        
        await prisma.organization_admin.create({
            data: {
                adminId: userId,
                orgId: orgId
            }
        });
        
        res.status(201).json({ message: "User set as organization admin successfully" });
    } catch (error) {
        console.error("Error setting organization admin:", error);
        res.status(500).json({ error: "Failed to set organization admin" });
    }
};

// Get all organization admins
const getOrganizationAdmins = async (req, res) => {
    const { id } = req.params;
    
    try {
        // Find organization admins with user details
        const organizationAdmins = await prisma.organization_admin.findMany({
            where: { orgId: id },
            include: {
                admin_user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true,
                        departmentId: true,
                        department: {
                            select: {
                                name: true
                            }
                        },
                        roles: {
                            include: {
                                role: true
                            }
                        }
                    }
                }
            }
        });
        
        res.status(200).json(organizationAdmins);
    } catch (error) {
        console.error("Error fetching organization admins:", error);
        res.status(500).json({ error: "Failed to fetch organization admins" });
    }
};

// Remove a user from organization admins
const removeOrganizationAdmin = async (req, res) => {
    const { id, adminId } = req.params;
    
    try {
        // Find the organization admin record
        const adminRecord = await prisma.organization_admin.findFirst({
            where: {
                orgId: id,
                adminId: adminId
            }
        });
        
        if (!adminRecord) {
            return res.status(404).json({ error: "Admin assignment not found" });
        }
        
        // Delete the organization admin record
        await prisma.organization_admin.delete({
            where: { id: adminRecord.id }
        });
        
        res.status(200).json({ 
            message: "Admin removed successfully",
            adminId: adminId
        });
    } catch (error) {
        console.error("Error removing organization admin:", error);
        res.status(500).json({ error: "Failed to remove admin" });
    }
};


const createCompleteOrganization = [
    body('organization.name').notEmpty().withMessage('Organization name is required'),
    body('organization.industry').optional().notEmpty().withMessage('Industry is required'),
    body('organization.subscriptionPlanId').notEmpty().withMessage('Subscription Plan is required'),
    body('organization.subscriptionEnd').optional().isISO8601().withMessage('Subscription End must be a valid date'),
    body('organization.isActive').optional().isBoolean().withMessage('IsActive must be a boolean'),
    body('organization.settings').optional().isJSON().withMessage('Settings must be a valid JSON'),
    
    
    body('admin.email').isEmail().withMessage('Valid admin email is required'),
    body('admin.firstName').notEmpty().withMessage('Admin first name is required'),
    body('admin.lastName').notEmpty().withMessage('Admin last name is required'),
    
    
    body('permissions').isArray({ min: 1 }).withMessage('At least one permission is required for admin role'),

    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { organization, admin, permissions } = req.body;
        try {
            // Execute everything in a single transaction with rollback on error
            const result = await prisma.$transaction(async (tx) => {
                console.log('Starting organization creation transaction...');
                
                // Step 1: Create Organization
                console.log('Creating organization...');
                const newOrganization = await tx.organization.create({
                    data: {
                        name: organization.name,
                        industry: organization.industry,
                        subscriptionPlanId: organization.subscriptionPlanId,
                        subscriptionEnd: organization.subscriptionEnd || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                        isActive: organization.isActive ?? true,
                        settings: organization.settings || JSON.stringify({})
                    }
                });
                console.log('Organization created with ID:', newOrganization.id);

                // Step 2: Create Organization Settings
                console.log('Creating organization settings...');
                const newSettings = await tx.organizationSettings.create({
                    data: {
                        orgId: newOrganization.id,
                        settings: {
                            weekoff: [0, 6],
                            workingHours: "9:00 AM - 6:00 PM",
                            timezone: "Asia/Kolkata"
                        }   
                    }
                });
                console.log('Organization settings created');

                // Step 3: Check if admin email already exists in this organization
                console.log('Checking for existing admin email in organization...');
                const existingUser = await tx.user.findFirst({
                    where: {
                        orgId: newOrganization.id,
                        email: admin.email
                    }
                });

                if (existingUser) {
                    throw new Error(`User with email ${admin.email} already exists in this organization`);
                }

                // Step 4: Create Admin Role with permissions
                console.log('Creating admin role...');
                const adminRole = await tx.role.create({
                    data: {
                        orgId: newOrganization.id,
                        name: 'Org_Admin',
                        description: 'Full administrative access to organization',
                        isDefault: true,
                        permissions: {
                            create: permissions.map(permissionId => ({
                                permission: {
                                    connect: { id: permissionId }
                                }
                            }))
                        }
                    },
                    include: {
                        permissions: {
                            include: {
                                permission: true
                            }
                        }
                    }
                });
                console.log('Admin role created with ID:', adminRole.id);

                // Step 5: Generate verification token and create admin user
                console.log('Creating admin user...');
                const verificationToken = Math.random().toString(36).substring(2, 15) + 
                                       Math.random().toString(36).substring(2, 15);
                
                const adminUser = await tx.user.create({
                    data: {
                        orgId: newOrganization.id,
                        email: admin.email,
                        firstName: admin.firstName,
                        lastName: admin.lastName,
                        status: 'inactive', 
                        verificationToken: verificationToken,
                        hiredDate: new Date(),
                        employeeId: `EMP${Math.floor(1000 + Math.random() * 9000)}`,
                        roles: {
                            create: [{
                                role: {
                                    connect: { id: adminRole.id }
                                }
                            }]
                        }
                    },
                    include: {
                        roles: {
                            include: {
                                role: {
                                    include: {
                                        permissions: {
                                            include: {
                                                permission: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
                

                console.log('Admin user created with ID:', adminUser.id);
                const organization_admin = await tx.organization_admin.create({
                    data:{
                        adminId:adminUser.id,
                        orgId:newOrganization.id
                    }
                })
                console.log('Admin user assigned to organization admin role');

                // Step 6: Initialize permission presets for organization
                console.log('Initializing permission presets...');
                // Note: This is called outside transaction as it's a separate operation
                
                return {
                    organization: newOrganization,
                    organizationSettings: newSettings,
                    adminRole: adminRole,
                    adminUser: adminUser,
                    verificationToken: verificationToken
                };
            }, {
                maxWait: 20000, // 20 seconds
                timeout: 60000, // 60 seconds
            });

            // Step 7: Initialize permission presets (outside transaction)
            try {
                await initializePresetsForOrg(result.organization.id);
                console.log('Permission presets initialized');
            } catch (presetError) {
                console.warn('Permission preset initialization failed:', presetError.message);
                // Don't fail the entire operation for this
            }

            // Step 8: Send welcome email to admin
            await sendWelcomeEmailToAdmin(result.organization,result.adminUser,result.adminUser.verificationToken);

            console.log('Organization creation completed successfully!');
            
            // Return success response with all created data
            res.status(201).json({
                success: true,
                message: 'Organization created successfully with admin user',
                data: {
                    organization: {
                        id: result.organization.id,
                        name: result.organization.name,
                        industry: result.organization.industry,
                        isActive: result.organization.isActive
                    },
                    adminRole: {
                        id: result.adminRole.id,
                        name: result.adminRole.name,
                        permissions: result.adminRole.permissions.map(p => ({
                            id: p.permission.id,
                            name: p.permission.name,
                            description: p.permission.description
                        }))
                    },
                    adminUser: {
                        id: result.adminUser.id,
                        email: result.adminUser.email,
                        firstName: result.adminUser.firstName,
                        lastName: result.adminUser.lastName,
                        status: result.adminUser.status
                    }
                }
            });

        } catch (error) {
            console.error('Organization creation failed, transaction rolled back:', error);
            
            // Return detailed error response
            res.status(500).json({
                success: false,
                message: 'Organization creation failed',
                error: error.message,
                details: 'All changes have been rolled back automatically'
            });
        }
    }
];

export {
    getOrganization,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    getOrganizationById,
    setOrgAdmin,
    getOrganizationAdmins,
    removeOrganizationAdmin,
    createCompleteOrganization
};