import prisma from '../../../db/connectDb.js';
import { body, validationResult } from 'express-validator';

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
                }
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
    body('subscriptionPlan').notEmpty().withMessage('Subscription Plan is required'),
    body('subscriptionEnd').optional().isISO8601().withMessage('Subscription End must be a valid date'),
    body('isActive').optional().isBoolean().withMessage('IsActive must be a boolean'),
    body('settings').optional().isJSON().withMessage('Settings must be a valid JSON'),

    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, industry, subscriptionPlan, subscriptionEnd, isActive, settings } = req.body;
        try {
            const newOrganization = await prisma.organization.create({
                data: {
                    name,
                    industry,
                    subscriptionPlan,
                    subscriptionEnd,
                    isActive,
                    settings
                }
            });
            const newSettings = await prisma.organizationSettings.create({
                data: {
                    orgId: newOrganization.id,
                    settings: {
                        weekof: [0, 6]
                    }   
                }
            });
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
    body('subscriptionPlan').optional().notEmpty().withMessage('Subscription Plan is required'),
    body('subscriptionEnd').optional().isISO8601().withMessage('Subscription End must be a valid date'),
    body('isActive').optional().isBoolean().withMessage('IsActive must be a boolean'),

    async (req, res) => {
        const errors = validationResult(req);
        console.log(req.body);
        
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id, name, industry, subscriptionPlan, subscriptionEnd, isActive, settings } = req.body;
        try {
            const updatedOrganization = await prisma.organization.update({
                where: { id },
                data: {
                    ...(name && { name }),
                    ...(industry && { industry }),
                    ...(subscriptionPlan && { subscriptionPlan }),
                    ...(subscriptionEnd && { subscriptionEnd }),
                    ...(isActive !== undefined && { isActive }),
                    ...(settings && { settings })
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
                
                // 19. Finally delete the organization itself
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

export {
    getOrganization,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    getOrganizationById,
    setOrgAdmin,
    getOrganizationAdmins,
    removeOrganizationAdmin
};