import prisma from '../../../db/connectDb.js';
import { body, validationResult } from 'express-validator';
import { initializePresetsForOrg } from '../../../seed/PermissionPreset.js';
import { sendEmailWithCustomContent, sendPasswordResetEmail } from '../../../util/sendEmail.js';

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
            // Use a transaction to ensure either all deletes succeed or none do
            await prisma.$transaction(async (tx) => {
                // 1. Delete organization settings
                await tx.organizationSettings.deleteMany({
                    where: { orgId: id }
                });
                
                // 2. Find all users belonging to this organization
                const users = await tx.user.findMany({
                    where: { orgId: id },
                    select: { id: true }
                });
                
                const userIds = users.map(user => user.id);
                
                if (userIds.length > 0) {
                    // 3. Delete user related records - fixing the non-existent function
                    
                    // Delete UserDailyReports first (they reference AttendanceRecord)
                    await tx.userDailyReport.deleteMany({
                        where: {
                            attendance: {
                                userId: { in: userIds }
                            }
                        }
                    });
                    
                    // Delete attendance records
                    await tx.attendanceRecord.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    // 4. Delete push subscriptions
                    await tx.pushSubscription.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    // 5. Delete notifications
                    await tx.notification.deleteMany({ 
                        where: { userId: { in: userIds } }
                    });
                    
                    // 6. Delete leave balances and requests
                    await tx.leaveBalance.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    await tx.leaveRequest.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    // 7. Delete salary records and transactions
                    await tx.salaryTransactionTable.deleteMany({
                        where: { 
                            salaryRecord: { 
                                userId: { in: userIds } 
                            } 
                        }
                    });
                    
                    await tx.salaryRecord.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    // 8. Delete salary parameters
                    await tx.salaryParameter.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    // 9. Delete bank details
                    await tx.bankDetails.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    // 10. Delete all transactions
                    await tx.transactionTable.deleteMany({
                        where: { 
                            OR: [
                                { senderUserId: { in: userIds } },
                                { recieverUserId: { in: userIds } }
                            ]
                        }
                    });
                    
                    // 11. Delete user roles
                    await tx.userRole.deleteMany({
                        where: { userId: { in: userIds } }
                    });
                    
                    // 12. Delete organization admins
                    await tx.organization_admin.deleteMany({
                        where: { orgId: id }
                    });
                }
                
                // 13. Delete role permissions and roles
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
                
                // 14. Delete leave types
                await tx.leaveType.deleteMany({
                    where: { orgId: id }
                });
                
                // 15. Delete notification templates
                await tx.notificationTemplate.deleteMany({
                    where: { orgId: id }
                });
                
                // 16. Delete holidays and holiday types
                await tx.holiday.deleteMany({
                    where: { orgId: id }
                });
                
                await tx.holidayType.deleteMany({
                    where: { orgId: id }
                });
                
                // 17. Delete departments
                await tx.department.deleteMany({
                    where: { orgId: id }
                });
                
                // 18. Delete users
                await tx.user.deleteMany({
                    where: { orgId: id }
                });
                
                // Delete permission presets before deleting the organization
                await tx.permissionPreset.deleteMany({
                    where: { orgId: id }
                });
                
                // 19. Delete billing records
                await tx.billingRecord.deleteMany({
                    where: { organizationId: id }
                });
                
                // 20. Delete activity logs
                await tx.activityLog.deleteMany({
                    where: { orgId: id }
                });
                
                // 21. Finally delete the organization itself
                await tx.organization.delete({
                    where: { id }
                });
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

// Create complete organization with admin role and admin user in single transaction
const createCompleteOrganization = [
    // Organization validation
    body('organization.name').notEmpty().withMessage('Organization name is required'),
    body('organization.industry').optional().notEmpty().withMessage('Industry is required'),
    body('organization.subscriptionPlanId').notEmpty().withMessage('Subscription Plan is required'),
    body('organization.subscriptionEnd').optional().isISO8601().withMessage('Subscription End must be a valid date'),
    body('organization.isActive').optional().isBoolean().withMessage('IsActive must be a boolean'),
    body('organization.settings').optional().isJSON().withMessage('Settings must be a valid JSON'),
    
    // Admin user validation
    body('admin.email').isEmail().withMessage('Valid admin email is required'),
    body('admin.firstName').notEmpty().withMessage('Admin first name is required'),
    body('admin.lastName').notEmpty().withMessage('Admin last name is required'),
    
    // Admin role permissions validation
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

                // Step 3: Check if admin email already exists
                console.log('Checking for existing admin email...');
                const existingUser = await tx.user.findFirst({
                    where: {
                        email: admin.email
                    }
                });

                if (existingUser) {
                    throw new Error(`User with email ${admin.email} already exists`);
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
                maxWait: 10000, // 10 seconds
                timeout: 20000, // 20 seconds
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
            try {
                // Send welcome email to admin with password reset link
                const resetToken = result.verificationToken;
                const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
cmcaoet8t0001tg1cz9asq6go
cmcaof3i1002ttg1c5qfvpjzv
                const emailSubject = "Welcome to Alkaa - Your Organization Setup is Complete";

                const emailContent = `
                <div style="font-family: 'Helvetica', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333333;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <img src="${process.env.VITE_ALKAA_LOGO || 'https://alkaa.online/logo.svg'}" alt="Alkaa Logo" style="max-width: 150px;">
                    </div>
                    
                    <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
                        <h1 style="color: #3f51b5; font-size: 24px; margin-bottom: 20px; text-align: center;">Welcome to Alkaa!</h1>
                        
                        <p style="margin-bottom: 15px; line-height: 1.6;">Dear ${admin.firstName} ${admin.lastName},</p>
                        
                        <p style="margin-bottom: 15px; line-height: 1.6;">Congratulations! Your organization <strong>${organization.name}</strong> has been successfully set up on the Alkaa platform. We're excited to have you onboard.</p>
                        
                        <p style="margin-bottom: 15px; line-height: 1.6;">As the administrator, you now have access to powerful tools to manage your workforce, streamline processes, and boost productivity.</p>
                        
                        <h2 style="color: #3f51b5; font-size: 18px; margin: 25px 0 15px;">Get Started in 3 Simple Steps:</h2>
                        
                        <ol style="margin-bottom: 25px; padding-left: 20px; line-height: 1.6;">
                            <li style="margin-bottom: 10px;"><strong>Set your password</strong> using the button below</li>
                            <li style="margin-bottom: 10px;"><strong>Complete your profile</strong> and organization details</li>
                            <li style="margin-bottom: 10px;"><strong>Invite team members</strong> to join your organization</li>
                        </ol>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="background-color: #3f51b5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Set Your Password</a>
                        </div>
                        
                        <p style="margin-bottom: 15px; line-height: 1.6;">This link will expire in 24 hours for security reasons. If you need assistance, our support team is available at <a href="mailto:support@alkaa.io" style="color: #3f51b5; text-decoration: none;">support@alkaa.io</a>.</p>
                        
                        <p style="margin-bottom: 25px; line-height: 1.6;">We look forward to seeing how ${organization.name} grows with Alkaa!</p>
                        
                        <p style="line-height: 1.6;">Best regards,<br>The Alkaa Team</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #666666;">
                        <p>© ${new Date().getFullYear()} Alkaa. All rights reserved.</p>
                        <p>If you didn't create an account with us, please ignore this email.</p>
                    </div>
                </div>
                `;
                console.log('Sending welcome email to admin:', admin.email);
                
                await sendEmailWithCustomContent(admin.email, emailSubject, emailContent);
                console.log('Welcome email sent to admin');
            } catch (emailError) {
                console.warn('Failed to send welcome email:', emailError.message);
                // Don't fail the entire operation for email failure
            }

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