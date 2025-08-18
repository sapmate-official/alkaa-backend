import prisma from '../../../db/connectDb.js';
import { validationResult } from 'express-validator';
import { sendPasswordResetEmail, sendNewEmployeeWelcomeEmail, sendDepartmentChangeEmail } from '../../../util/sendEmail.js';
import { logProfileChange, logUserCreation, logUserStatusChange, logAuthActivity, logRoleChange, logUserDeletion, logDepartmentChange, logUserActivity } from '../../../util/activityLogger.js';
import bcrypt from 'bcrypt';

export const getUser = async (req, res) => {
    try {
        const { orgId } = req.query;
        const users = await prisma.user.findMany({ 
            where: { orgId },
            include: {
                organization: true,
                department: true,
                // NEW: Include multi-department data
                userDepartments: {
                    include: {
                        department: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                description: true
                            }
                        }
                    },
                    orderBy: [
                        { isPrimary: 'desc' },
                        { assignedAt: 'desc' }
                    ]
                },
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
        
        // Format response to include both legacy and new structure
        const formattedUsers = users.map(user => ({
            ...user,
            // Add computed fields for easier frontend consumption
            departments: user.userDepartments.map(ud => ({
                id: ud.id,
                departmentId: ud.department.id,
                departmentName: ud.department.name,
                departmentCode: ud.department.code,
                isPrimary: ud.isPrimary,
                role: ud.role,
                assignedAt: ud.assignedAt
            })),
            primaryDepartment: user.userDepartments.find(ud => ud.isPrimary)?.department || user.department
        }));
        
        res.status(200).json(formattedUsers);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getUserById = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await prisma.user.findUnique({ where: { id } ,
        include:{
            organization:true,
            roles:{
                include:{
                    role:{
                        include:{
                            permissions:{
                                include:{
                                    permission:true
                                }
                            }
                        }
                    }
                }
            }
        }});
        if (!user) {
            const superAdmin = await prisma.superAdmin.findUnique({ where: { id } });
            if (superAdmin) {
                return res.status(200).json({
                    superAdmin});
            }
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({user});
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const createUser = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { 
        email, 
        orgId, 
        firstName, 
        lastName, 
        departmentId, 
        managerId, 
        status = 'active', 
        dateOfBirth,
        address,
        mobileNumber,
        emergencyContact,
        adharNumber,
        panNumber
    } = req.body;

    // Check for required fields
    if (!email || !orgId || !firstName || !lastName) {
        return res.status(400).json({ 
            error: 'Required fields missing', 
            requiredFields: ['email', 'orgId', 'firstName', 'lastName'] 
        });
    }

    try {
        // Verify organization exists
        const organization = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { name: true }
        });

        if (!organization) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Generate employee ID
        const date_ = new Date();
        const nameInitials = organization.name.split(' ').map(word => word.charAt(0)).join('');
        const employeeId = nameInitials + 
            date_.getFullYear().toString().slice(-2) + 
            (date_.getMonth() + 1).toString().padStart(2, '0');

        // Prepare user data
        const userData = {
            email,
            firstName,
            lastName,
            orgId,
            employeeId,
            status: status || 'active',
            hiredDate: new Date()
        };

        // Add optional fields if provided
        if (departmentId)
            userData.departmentId = departmentId;
        if (managerId)
            userData.managerId = managerId;
        if (dateOfBirth)
            userData.dateOfBirth = new Date(dateOfBirth);
        if (address)
            userData.address = address;
        if (mobileNumber)
            userData.mobileNumber = mobileNumber;
        if (emergencyContact)
            userData.emergencyContact = emergencyContact;
        if (adharNumber)
            userData.adharNumber = adharNumber;
        if (panNumber)
            userData.panNumber = panNumber;

        // Create user and UserDepartment record in transaction
        const result = await prisma.$transaction(async (prisma) => {
            // Create user
            const newUser = await prisma.user.create({
                data: userData,
                include: {
                    department: {
                        include:{
                            departmentHead:{
                                select:{
                                    firstName:true,
                                    lastName:true,
                                    email:true
                                }
                            }
                        }
                    },
                    manager: {
                        select:{
                            firstName:true,
                            lastName:true,
                            email:true
                        }
                    }
                }
            });

            // NEW: Create UserDepartment record if department is assigned
            if (newUser.departmentId) {
                await prisma.userDepartment.create({
                    data: {
                        userId: newUser.id,
                        departmentId: newUser.departmentId,
                        isPrimary: true, // First department is always primary
                        assignedBy: req.user?.id, // The user who created this user
                        assignedAt: new Date(),
                        role: null // No specific role initially
                    }
                });
            }

            return newUser;
        });

        const newUser = result;

        // Generate verification token and update user
        const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const hiredDate = new Date(newUser.createdAt);
        const defaultPassword = 'password'; // Default password
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        
        // Update user with verification token
        await prisma.user.update({
            where: { id: newUser.id },
            data: { 
                verificationToken,
                hashedPassword
            },
        });

        // Fetch team members from the same department (if department is provided)
        let formattedTeamMembers = [];
        if (newUser.departmentId) {
            const teamMembers = await prisma.user.findMany({
                where: {
                    departmentId: newUser.departmentId,
                    id: { not: newUser.id }
                },
                take: 5,
                select: {
                    firstName: true,
                    lastName: true,
                    roles: {
                        include: {
                            role: true
                        }
                    }
                }
            });
            
            // Format team members array
            formattedTeamMembers = teamMembers.map(member => ({
                name: `${member.firstName} ${member.lastName}`,
                role: member.roles.length > 0 ? member.roles[0].role.name : 'Team Member'
            }));
        }
        
        // Prepare manager and department head information
        const managerInfo = newUser.manager ? {
            email: newUser.manager.email,
            name: `${newUser.manager.firstName} ${newUser.manager.lastName}`
        } : null;
        
        const departmentHeadInfo = newUser.department?.departmentHead ? {
            email: newUser.department.departmentHead.email,
            name: `${newUser.department.departmentHead.firstName} ${newUser.department.departmentHead.lastName}`
        } : null;
        
        // Send welcome email if we have manager info
        if (managerInfo) {
            await sendNewEmployeeWelcomeEmail(
                newUser.email,
                `${newUser.firstName} ${newUser.lastName}`,
                managerInfo.email,
                managerInfo.name,
                departmentHeadInfo || { email: '', name: 'Not Assigned' },
                formattedTeamMembers,
                {
                    employeeId: newUser.employeeId,
                    department: newUser.department?.name || 'Not Assigned',
                    hiredDate: newUser.hiredDate,
                    verificationToken: verificationToken
                },
                organization.name
            );
        } else {
            // Fall back to password reset email if no manager is assigned
            await sendPasswordResetEmail(
                newUser.email,
                verificationToken,
                organization,
                hiredDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
            );
        }
        
        // Log user creation activity

            await logUserCreation(
                req.user.id, // Actor (the user who created this user)
                newUser.id,  // Target user
                {
                    employeeId: newUser.employeeId,
                    department: newUser.department?.name || 'Not Assigned',
                    manager: managerInfo?.name || 'Not Assigned',
                    status: newUser.status
                }
            );
    
        // Return success response
        res.status(201).json({
            message: 'User created successfully',
            user: newUser
        });
    } catch (error) {
        console.error('Error creating user:', error);
        
        // Handle duplicate email error
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            return res.status(409).json({ error: 'Email already exists in this organization' });
        }
        
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const updateUser = async (req, res) => {
    console.log('Request received:', req.method, req.params, req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const isPutRequest = req.method === 'PUT';
    
    // Create initial update data object
    const updateData = {};
    
    // Handle fields with proper validation
    
    // Required fields for PUT requests
    if (req.body.email) updateData.email = req.body.email;
    if (req.body.orgId) updateData.orgId = req.body.orgId;
    
    // Handle optional fields only if they are provided
    if (req.body.firstName !== undefined) updateData.firstName = req.body.firstName || null;
    if (req.body.lastName !== undefined) updateData.lastName = req.body.lastName || null;
    if (req.body.status !== undefined) updateData.status = req.body.status;
    if (req.body.verificationToken !== undefined) updateData.verificationToken = req.body.verificationToken || null;
    if (req.body.address !== undefined) updateData.address = req.body.address || null;
    if (req.body.mobileNumber !== undefined) updateData.mobileNumber = req.body.mobileNumber || null;
    if (req.body.emergencyContact !== undefined) updateData.emergencyContact = req.body.emergencyContact || null;
    if (req.body.adharNumber !== undefined) updateData.adharNumber = req.body.adharNumber || null;
    if (req.body.panNumber !== undefined) updateData.panNumber = req.body.panNumber || null;
    if (req.body.employeeId !== undefined) updateData.employeeId = req.body.employeeId || null;

    // Handle relationship fields - only include if valid values are provided
    if (req.body.departmentId) {
        updateData.departmentId = req.body.departmentId;
    } else if (req.body.departmentId === null || req.body.departmentId === '') {
        updateData.departmentId = null;
    }
    
    if (req.body.managerId) {
        updateData.managerId = req.body.managerId;
    } else if (req.body.managerId === null || req.body.managerId === '') {
        updateData.managerId = null;
    }
    
    // Handle date fields
    if (req.body.dateOfBirth) {
        updateData.dateOfBirth = new Date(req.body.dateOfBirth);
    } else if (req.body.dateOfBirth === null || req.body.dateOfBirth === '') {
        updateData.dateOfBirth = null;
    }
    
    if (req.body.hiredDate) {
        updateData.hiredDate = new Date(req.body.hiredDate);
    } else if (req.body.hiredDate === null || req.body.hiredDate === '') {
        updateData.hiredDate = null;
    }
    
    if (req.body.terminationDate) {
        updateData.terminationDate = new Date(req.body.terminationDate);
    } else if (req.body.terminationDate === null || req.body.terminationDate === '') {
        updateData.terminationDate = null;
    }
    
    // Handle numeric fields
    if (req.body.annualPackage !== undefined && req.body.annualPackage !== '') {
        updateData.annualPackage = parseFloat(req.body.annualPackage);
    }
    
    if (req.body.monthlySalary !== undefined && req.body.monthlySalary !== '') {
        updateData.monthlySalary = parseFloat(req.body.monthlySalary);
    }

    // For PUT requests, validate required fields
    if (isPutRequest && (!updateData.email || !updateData.orgId)) {
        console.log('Missing required fields for PUT request');
        return res.status(400).json({ error: 'Email and orgId are required for PUT requests' });
    }
    
    try {
        console.log('Updating user with data:', updateData);
        
        // Get original user data for comparison
        const originalUser = await prisma.user.findUnique({
            where: { id },
            include: {
                department: { 
                    select: { 
                        id: true, 
                        name: true 
                    } 
                },
                manager: { 
                    select: { 
                        id: true, 
                        firstName: true, 
                        lastName: true, 
                        email: true 
                    } 
                },
                organization: {
                    select: {
                        id: true,
                        name: true,
                        Organization_admin: {
                            select: {
                                admin_user: {
                                    select: {
                                        email: true,
                                        firstName: true,
                                        lastName: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!originalUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if department is changing
        const departmentChanging = updateData.departmentId !== undefined && 
                                   updateData.departmentId !== originalUser.departmentId;
        
        // Update user and handle department changes in transaction
        const updatedUser = await prisma.$transaction(async (prisma) => {
            // Update the user
            const user = await prisma.user.update({
                where: { id },
                data: updateData,
                include: {
                    department: { 
                        select: { 
                            id: true, 
                            name: true 
                        } 
                    },
                    manager: { 
                        select: { 
                            id: true, 
                            firstName: true, 
                            lastName: true, 
                            email: true 
                        } 
                    },
                    organization: {
                        select: {
                            name: true
                        }
                    }
                }
            });

            // NEW: Handle UserDepartment changes if department changed
            if (departmentChanging) {
                const actorId = req.user?.id;

                // Remove old department assignment if exists
                if (originalUser.departmentId) {
                    await prisma.userDepartment.deleteMany({
                        where: {
                            userId: id,
                            departmentId: originalUser.departmentId
                        }
                    });
                }

                // Add new department assignment if new department is provided
                if (updateData.departmentId) {
                    await prisma.userDepartment.create({
                        data: {
                            userId: id,
                            departmentId: updateData.departmentId,
                            isPrimary: true, // Make this the primary department
                            assignedBy: actorId,
                            assignedAt: new Date(),
                            role: null
                        }
                    });
                }
            }

            return user;
        });
        
        // Log activity changes
        const actorId = req.user?.id || id; // Use the authenticated user ID if available
        const changes = {};
        
        // Track department change separately for email notification
        let departmentChanged = false;
        let oldDepartment = null;
        let newDepartment = null;
        
        // Check for profile changes
        const fieldsToCheck = ['firstName', 'lastName', 'email', 'mobileNumber', 'address', 'emergencyContact', 'employeeId','departmentId', 'managerId', 'status', 'dateOfBirth', 'adharNumber', 'panNumber', 'annualPackage', 'monthlySalary'];
        fieldsToCheck.forEach(field => {
            if (updateData[field] !== undefined && originalUser[field] !== updateData[field]) {
                if(field === 'managerId'){
                    let oldManagerName = 'Not Assigned';
                    let newManagerName = 'Not Assigned';
                    if(originalUser.manager){
                        oldManagerName = `${originalUser.manager.firstName} ${originalUser.manager.lastName}`;
                    }
                    if(updatedUser.manager){
                        newManagerName = `${updatedUser.manager.firstName} ${updatedUser.manager.lastName}`;
                    }
                    changes[field] = {
                        old: oldManagerName,
                        new: newManagerName
                    };
                    return;
                }
                if( field === 'departmentId' ) {
                    let oldDepartmentName = 'Not Assigned';
                    let newDepartmentName = 'Not Assigned';
                    
                    if(originalUser.department){
                        oldDepartmentName = originalUser.department.name;
                        oldDepartment = {
                            id: originalUser.department.id,
                            name: originalUser.department.name
                        };
                    }
                    if(updatedUser.department){
                        newDepartmentName = updatedUser.department.name;
                        newDepartment = {
                            id: updatedUser.department.id,
                            name: updatedUser.department.name
                        };
                    }
                    
                    changes[field] = {
                        old: oldDepartmentName,
                        new: newDepartmentName
                    };
                    
                    // Mark department as changed for email notification
                    departmentChanged = true;
                    return;
                }
                changes[field] = {
                    old: originalUser[field] || '',
                    new: updateData[field] || ''
                };
            }
        });

        // Log profile changes if any
        if (Object.keys(changes).length > 0) {
            await logProfileChange(actorId, id, originalUser.orgId, changes, req);
        }

        // Send department change email notification
        if (departmentChanged && oldDepartment && newDepartment) {
            try {
                // Get HR admin email
                const hrAdmin = originalUser.organization.Organization_admin?.[0]?.admin_user ? {
                    email: originalUser.organization.Organization_admin[0].admin_user.email,
                    name: `${originalUser.organization.Organization_admin[0].admin_user.firstName} ${originalUser.organization.Organization_admin[0].admin_user.lastName}`
                } : null;

                // Prepare old and new manager information
                const oldManager = originalUser.manager ? {
                    name: `${originalUser.manager.firstName} ${originalUser.manager.lastName}`,
                    email: originalUser.manager.email
                } : null;

                const newManager = updatedUser.manager ? {
                    name: `${updatedUser.manager.firstName} ${updatedUser.manager.lastName}`,
                    email: updatedUser.manager.email
                } : null;

                await sendDepartmentChangeEmail(
                    updatedUser.email,
                    `${updatedUser.firstName} ${updatedUser.lastName}`,
                    oldDepartment,
                    newDepartment,
                    oldManager,
                    newManager,
                    hrAdmin,
                    new Date(), // Effective date (current date)
                    originalUser.organization.name
                );

                // Log department change activity
                await logDepartmentChange(
                    actorId,
                    id,
                    originalUser.orgId,
                    oldDepartment.name,
                    newDepartment.name,
                    req
                );

                console.log(`Department change email sent to ${updatedUser.email}`);
            } catch (emailError) {
                console.error('Error sending department change email:', emailError);
                // Don't fail the request if email fails
            }
        }

        // Log status changes
        if (updateData.status && originalUser.status !== updateData.status) {
            await logUserStatusChange(actorId, id, originalUser.orgId, originalUser.status, updateData.status, req);
        }
        
        console.log('User updated successfully:', updatedUser);
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error('Error updating user:', error);
        
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Email already exists' });
        }
        
        if (error.code === 'P2003') {
            return res.status(400).json({ error: 'Invalid relationship reference. Check departmentId or managerId' });
        }
        
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const deleteUser = async (req, res) => {
    const { id } = req.body;
    try {
        // Get user information before deletion for logging
        const userToDelete = await prisma.user.findUnique({
            where: { id },
            include: {
                roles: {
                    include: {
                        role: true
                    }
                },
                department: true
            }
        });
        
        if (!userToDelete) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await prisma.user.delete({ where: { id } });
        
        // Log user deletion
        await logUserDeletion(
            req.user.id,
            id,
            userToDelete.orgId,
            userToDelete,
            req
        );
        
        res.status(204).send();
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const hardDeleteUser = async (req, res) => {
    const { id } = req.body;
    
    if (!id) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        // Check if user exists
        const userExists = await prisma.user.findUnique({
            where: { id },
            include: {
                roles: true,
                department: true,
                organization: true
            }
        });

        if (!userExists) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Use Prisma transaction to ensure all operations are atomic
        const result = await prisma.$transaction(async (prismaClient) => {
            console.log(`Starting hard delete for user ${id} (${userExists.firstName} ${userExists.lastName})`);
            
            // Delete Organization_admin records
            await prismaClient.organization_admin.deleteMany({
                where: { adminId: id }
            });
            
            // Delete all UserRoles
            await prismaClient.userRole.deleteMany({
                where: { userId: id }
            });

            // Delete PushSubscriptions
            await prismaClient.pushSubscription.deleteMany({
                where: { userId: id }
            });

            // Delete all Notifications
            await prismaClient.notification.deleteMany({
                where: { userId: id }
            });

            // Delete all LeaveBalances
            await prismaClient.leaveBalance.deleteMany({
                where: { userId: id }
            });

            // Delete all LeaveRequests
            await prismaClient.leaveRequest.deleteMany({
                where: { userId: id }
            });

            // Delete BankDetails if exists
            await prismaClient.bankDetails.deleteMany({
                where: { userId: id }
            });

            // Delete SalaryParameter if exists
            await prismaClient.salaryParameter.deleteMany({
                where: { userId: id }
            });

            // Process SalaryRecords and their transactions
            const salaryRecords = await prismaClient.salaryRecord.findMany({
                where: { userId: id },
                select: { id: true }
            });

            for (const record of salaryRecords) {
                await prismaClient.salaryTransactionTable.deleteMany({
                    where: { salaryRecordId: record.id }
                });
            }

            await prismaClient.salaryRecord.deleteMany({
                where: { userId: id }
            });

            // For UserDailyReports connected to attendances
            const attendances = await prismaClient.attendanceRecord.findMany({
                where: { userId: id },
                select: { id: true }
            });

            for (const attendance of attendances) {
                await prismaClient.userDailyReport.deleteMany({
                    where: { attendanceId: attendance.id }
                });
            }

            // Delete attendance records
            await prismaClient.attendanceRecord.deleteMany({
                where: { userId: id }
            });

            // Check and update departments where user is head
            await prismaClient.department.updateMany({
                where: { headId: id },
                data: { headId: null }
            });

            // Update users who had this user as manager
            await prismaClient.user.updateMany({
                where: { managerId: id },
                data: { managerId: null }
            });

            // Delete all transactions
            await prismaClient.transactionTable.deleteMany({
                where: {
                    OR: [
                        { senderUserId: id },
                        { recieverUserId: id }
                    ]
                }
            });

            // Finally delete the user
            const deletedUser = await prismaClient.user.delete({
                where: { id }
            });

            return deletedUser;
        });

        // Log user hard deletion
        await logUserDeletion(
            req.user.id,
            id,
            userExists.orgId,
            userExists,
            req
        );

        console.log(`User ${id} successfully hard deleted`);
        res.status(200).json({ 
            message: 'User and all related data successfully deleted',
            deletedUser: {
                id: result.id,
                email: result.email,
                firstName: result.firstName,
                lastName: result.lastName
            }
        });
    } catch (error) {
        console.error('Error during hard delete:', error);
        res.status(500).json({ 
            error: 'Internal Server Error during hard delete operation',
            details: error.message 
        });
    }
};

/**
 * Hard delete a user from a specific organization
 * This will permanently remove the user and all associated data from the system
 * 
 * @route DELETE /api/v2/user/org/:orgId/user/:userId
 * @access Private (requires authentication)
 * @param {string} orgId - Organization ID
 * @param {string} userId - User ID to be deleted
 * @returns {Object} Success message with deleted user details
 */
export const hardDeleteUserFromOrg = async (req, res) => {
    const { orgId, userId } = req.params;
    
    // Validate required parameters
    if (!orgId || !userId) {
        return res.status(400).json({ 
            error: 'Bad Request',
            message: 'Organization ID and User ID are required',
            required: ['orgId', 'userId']
        });
    }

    // Validate UUID format (assuming UUIDs are used)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orgId) || !uuidRegex.test(userId)) {
        return res.status(400).json({ 
            error: 'Bad Request',
            message: 'Invalid UUID format for orgId or userId'
        });
    }

    try {
        // Check if user exists and belongs to the specified organization
        const userExists = await prisma.user.findFirst({
            where: { 
                id: userId,
                orgId: orgId 
            },
            include: {
                roles: {
                    include: {
                        role: true
                    }
                },
                department: true,
                organization: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        if (!userExists) {
            return res.status(404).json({ 
                error: 'Not Found',
                message: 'User not found in the specified organization',
                orgId: orgId,
                userId: userId
            });
        }

        // Additional security check: Prevent deletion of the last admin
        const adminRoles = userExists.roles.filter(userRole => 
            userRole.role.name.toLowerCase().includes('admin') || 
            userRole.role.isDefault === true
        );

        if (adminRoles.length > 0) {
            // Check if this is the last admin in the organization
            const totalAdmins = await prisma.user.count({
                where: {
                    orgId: orgId,
                    roles: {
                        some: {
                            role: {
                                OR: [
                                    { name: { contains: 'admin', mode: 'insensitive' } },
                                    { isDefault: true }
                                ]
                            }
                        }
                    }
                }
            });

            if (totalAdmins <= 1) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Cannot delete the last administrator of the organization',
                    userId: userId,
                    orgId: orgId
                });
            }
        }

        // Use Prisma transaction to ensure all operations are atomic
        const result = await prisma.$transaction(async (prismaClient) => {
            console.log(`Starting hard delete for user ${userId} from organization ${orgId} (${userExists.firstName} ${userExists.lastName})`);
            
            // Delete Organization_admin records
            await prismaClient.organization_admin.deleteMany({
                where: { adminId: userId }
            });
            
            // Delete all UserRoles
            await prismaClient.userRole.deleteMany({
                where: { userId: userId }
            });

            // Delete PushSubscriptions
            await prismaClient.pushSubscription.deleteMany({
                where: { userId: userId }
            });

            // Delete all Notifications
            await prismaClient.notification.deleteMany({
                where: { userId: userId }
            });

            // Delete all LeaveBalances
            await prismaClient.leaveBalance.deleteMany({
                where: { userId: userId }
            });

            // Delete all LeaveRequests
            await prismaClient.leaveRequest.deleteMany({
                where: { userId: userId }
            });

            // Delete BankDetails if exists
            await prismaClient.bankDetails.deleteMany({
                where: { userId: userId }
            });

            // Delete SalaryParameter if exists
            await prismaClient.salaryParameter.deleteMany({
                where: { userId: userId }
            });

            // Process SalaryRecords and their transactions
            const salaryRecords = await prismaClient.salaryRecord.findMany({
                where: { userId: userId },
                select: { id: true }
            });

            for (const record of salaryRecords) {
                await prismaClient.salaryTransactionTable.deleteMany({
                    where: { salaryRecordId: record.id }
                });
            }

            await prismaClient.salaryRecord.deleteMany({
                where: { userId: userId }
            });

            // For UserDailyReports connected to attendances
            const attendances = await prismaClient.attendanceRecord.findMany({
                where: { userId: userId },
                select: { id: true }
            });

            for (const attendance of attendances) {
                await prismaClient.userDailyReport.deleteMany({
                    where: { attendanceId: attendance.id }
                });
            }

            // Delete attendance records
            await prismaClient.attendanceRecord.deleteMany({
                where: { userId: userId }
            });

            // Check and update departments where user is head
            const departmentsAffected = await prismaClient.department.updateMany({
                where: { 
                    headId: userId,
                    orgId: orgId 
                },
                data: { headId: null }
            });

            // Update users who had this user as manager (only within the same organization)
            const subordinatesAffected = await prismaClient.user.updateMany({
                where: { 
                    managerId: userId,
                    orgId: orgId 
                },
                data: { managerId: null }
            });

            // Delete all transactions
            await prismaClient.transactionTable.deleteMany({
                where: {
                    OR: [
                        { senderUserId: userId },
                        { recieverUserId: userId }
                    ]
                }
            });

            // Finally delete the user
            const deletedUser = await prismaClient.user.delete({
                where: { id: userId }
            });

            return {
                deletedUser,
                departmentsAffected: departmentsAffected.count,
                subordinatesAffected: subordinatesAffected.count
            };
        });

        // Log user hard deletion
        if (req.user && req.user.id) {
            try {
                await logUserDeletion(
                    req.user.id,
                    userId,
                    orgId,
                    userExists,
                    req
                );
            } catch (logError) {
                console.warn('Failed to log user deletion:', logError.message);
                // Don't fail the entire operation for logging issues
            }
        }

        console.log(`User ${userId} successfully hard deleted from organization ${orgId}`);
        res.status(200).json({ 
            success: true,
            message: 'User and all related data successfully deleted from organization',
            data: {
                deletedUser: {
                    id: result.deletedUser.id,
                    email: result.deletedUser.email,
                    firstName: result.deletedUser.firstName,
                    lastName: result.deletedUser.lastName,
                    organizationId: orgId,
                    organizationName: userExists.organization.name
                },
                impact: {
                    departmentsAffected: result.departmentsAffected,
                    subordinatesAffected: result.subordinatesAffected
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error during organization user hard delete:', error);
        
        // Handle specific Prisma errors
        if (error.code === 'P2025') {
            return res.status(404).json({
                error: 'Not Found',
                message: 'User not found or already deleted'
            });
        }
        
        if (error.code === 'P2003') {
            return res.status(409).json({
                error: 'Conflict',
                message: 'Cannot delete user due to foreign key constraints'
            });
        }
        
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: 'An error occurred during the hard delete operation',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const updateUserRole = async (req, res) => {
    const { userId, prevRole, roleId } = req.params;
    try {
        console.log(userId, prevRole, roleId);
        
        // Get user and org information for logging
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: {
                    include: {
                        role: true
                    }
                }
            }
        });
        
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        let user;
        let oldRoleName = null;
        let newRoleName = null;
        
        // Get role names for logging
        if (prevRole && prevRole !== 'null') {
            const oldRole = await prisma.role.findUnique({ where: { id: prevRole } });
            oldRoleName = oldRole?.name || 'Unknown Role';
        }
        
        if (roleId && roleId !== 'null') {
            const newRole = await prisma.role.findUnique({ where: { id: roleId } });
            newRoleName = newRole?.name || 'Unknown Role';
        }
        
        if (roleId == 'null') {
            // Removing a role
            user = await prisma.userRole.delete({
                where: {
                    userId_roleId: {
                        userId: userId,
                        roleId: prevRole
                    }
                }
            });
            
            // Log role removal
            await logRoleChange(
                req.user.id,
                userId,
                targetUser.orgId,
                oldRoleName,
                'None',
                req
            );
        }
        else if (prevRole == 'null') {
            // Adding a new role
            user = await prisma.userRole.create({
                data: {
                    userId: userId,
                    roleId: roleId
                }
            });
            
            // Log role assignment
            await logRoleChange(
                req.user.id,
                userId,
                targetUser.orgId,
                'None',
                newRoleName,
                req
            );
        } else {
            // Updating existing role
            user = await prisma.userRole.update({
                where: {
                    userId_roleId: {
                        userId: userId,
                        roleId: prevRole
                    }
                },
                data: {
                    roleId: roleId,
                },
            });
            
            // Log role change
            await logRoleChange(
                req.user.id,
                userId,
                targetUser.orgId,
                oldRoleName,
                newRoleName,
                req
            );
        }
        
        res.status(200).json(user);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
export const fetchAllSubordinates = async (req, res) => {
    try {
        let managerId = req.params.managerId;
        
        if(!managerId) {
            if (!req.user || !req.user.id) {
                console.log("User information not available in token");
                return res.status(401).json({ error: 'User authentication required' });
            }
            
            managerId = req.user.id;
            console.log("Using ID from token:", managerId);
        }
        
        // Check for view_subordinates_attendance permission
        const userWithRoles = await prisma.user.findUnique({
            where: { id: req.user.id },
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

        const hasViewSubordinatesPermission = userWithRoles?.roles.some(userRole => 
            userRole.role.permissions.some(permission => 
                permission.permission.key === 'view_subordinates_attendance'
            )
        );

        // If managerId is not the user's own ID, ensure they have permission to view subordinates
        if (managerId !== req.user.id && !hasViewSubordinatesPermission) {
            return res.status(403).json({ error: 'Access denied: Required permission not found' });
        }

        // Check if manager exists
        const managerExists = await prisma.user.findUnique({
            where: { id: managerId }
        });
        
        if (!managerExists) {
            console.log(`Manager with ID ${managerId} not found`);
            return res.status(404).json({ error: 'Manager not found' });
        }
        
        const subordinates = await prisma.user.findMany({
            where: {
                managerId: managerId,
                status: 'active'
            },
            include: {
                department: true,
                roles: {
                    include: {
                        role: true
                    }
                }
            }
        });
        
        res.status(200).json(subordinates);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal Server Error', error });
    }
}

export const fetchAllUsersFromOrg = async (req, res) => {
    try {
        // Check if the user has necessary permissions
        const { user } = req;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Check for permissions
        const userWithRoles = await prisma.user.findUnique({
            where: { id: user.id },
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

        // Check if user has view_all_user_attendance permission
        const hasViewAllPermission = userWithRoles?.roles.some(userRole => 
            userRole.role.permissions.some(permission => 
                permission.permission.key === 'view_all_user_attendance'
            )
        );

        if (!hasViewAllPermission) {
            return res.status(403).json({ error: 'Access denied: Required permission not found' });
        }

        // Use orgId from params or from the authenticated user
        const orgId = req.params.orgId || user.orgId;
        
        const users = await prisma.user.findMany({
            where: {
                orgId: orgId,
                status: 'active'
            },
            include: {
                department: true,
                roles: {
                    include: {
                        role: true
                    }
                }
            }
        });
        
        res.status(200).json(users);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal Server Error', error });
    }
}

export const fetchManagers = async (req, res) => {

    // manager are those whose has permission of manager sub category level of all category ..
    try {
        const { orgId } = req.params;
        
        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID is required' });
        }
        
        // Find users with manager permissions
        const managersWithPermissions = await prisma.user.findMany({
            where: {
                orgId,
                status: 'active',
                
            },
            include: {
                department: true,
            }
        });
        
        if (!managersWithPermissions.length) {
            return res.status(200).json([]);
        }
        
        return res.status(200).json(managersWithPermissions);
    } catch (error) {
        console.error("Error fetching managers:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
export const updateUserDepartment = async (req, res) => {
    const { userId, departmentId } = req.params;
    
    try {
        // Get original user data for comparison
        const originalUser = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                department: { 
                    select: { 
                        id: true, 
                        name: true 
                    } 
                },
                manager: { 
                    select: { 
                        id: true, 
                        firstName: true, 
                        lastName: true, 
                        email: true 
                    } 
                },
                organization: {
                    select: {
                        id: true,
                        name: true,
                        Organization_admin: {
                            select: {
                                admin_user: {
                                    select: {
                                        email: true,
                                        firstName: true,
                                        lastName: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!originalUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get new department info
        const newDepartmentInfo = await prisma.department.findUnique({
            where: { id: departmentId },
            select: { 
                id: true, 
                name: true,
                departmentHead: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });

        if (!newDepartmentInfo) {
            return res.status(404).json({ error: 'Department not found' });
        }

        // Update user department
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { 
                departmentId,
                // Optionally update manager to department head if no manager is assigned
                ...((!originalUser.managerId && newDepartmentInfo.departmentHead) && {
                    managerId: newDepartmentInfo.departmentHead.id
                })
            },
            include: {
                department: { 
                    select: { 
                        id: true, 
                        name: true 
                    } 
                },
                manager: { 
                    select: { 
                        id: true, 
                        firstName: true, 
                        lastName: true, 
                        email: true 
                    } 
                }
            }
        });

        // Prepare department change data
        const oldDepartment = originalUser.department ? {
            id: originalUser.department.id,
            name: originalUser.department.name
        } : null;

        const newDepartment = {
            id: newDepartmentInfo.id,
            name: newDepartmentInfo.name
        };

        // Send department change email notification
        try {
            // Get HR admin email
            const hrAdmin = originalUser.organization.Organization_admin?.[0]?.admin_user ? {
                email: originalUser.organization.Organization_admin[0].admin_user.email,
                name: `${originalUser.organization.Organization_admin[0].admin_user.firstName} ${originalUser.organization.Organization_admin[0].admin_user.lastName}`
            } : null;

            // Prepare old and new manager information
            const oldManager = originalUser.manager ? {
                name: `${originalUser.manager.firstName} ${originalUser.manager.lastName}`,
                email: originalUser.manager.email
            } : null;

            const newManager = updatedUser.manager ? {
                name: `${updatedUser.manager.firstName} ${updatedUser.manager.lastName}`,
                email: updatedUser.manager.email
            } : null;

            await sendDepartmentChangeEmail(
                updatedUser.email,
                `${updatedUser.firstName} ${updatedUser.lastName}`,
                oldDepartment,
                newDepartment,
                oldManager,
                newManager,
                hrAdmin,
                new Date(), // Effective date (current date)
                originalUser.organization.name
            );

            // Log department change activity
            const actorId = req.user?.id || userId;
            await logDepartmentChange(
                actorId,
                userId,
                originalUser.orgId,
                oldDepartment?.name || 'Not Assigned',
                newDepartment.name,
                req
            );

            console.log(`Department change email sent to ${updatedUser.email}`);
        } catch (emailError) {
            console.error('Error sending department change email:', emailError);
            // Don't fail the request if email fails
        }
        
        res.status(200).json({
            message: "User department updated successfully",
            user: updatedUser,
            departmentChange: {
                from: oldDepartment?.name || 'Not Assigned',
                to: newDepartment.name,
                effectiveDate: new Date()
            }
        });
    } catch (error) {
        console.error("Error updating user department:", error);
        
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (error.code === 'P2003') {
            return res.status(400).json({ error: 'Invalid department ID' });
        }
        
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// NEW MULTI-DEPARTMENT API ENDPOINTS

/**
 * Get all departments for a specific user
 * GET /user/:id/departments
 */
export const getUserDepartments = async (req, res) => {
    const { id } = req.params;
    
    try {
        const userWithDepartments = await prisma.user.findUnique({
            where: { id },
            include: {
                userDepartments: {
                    include: {
                        department: {
                            include: {
                                departmentHead: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        email: true
                                    }
                                },
                                parentDepartment: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        },
                        assignedByUser: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        }
                    },
                    orderBy: [
                        { isPrimary: 'desc' },
                        { assignedAt: 'desc' }
                    ]
                },
                // Keep backward compatibility - include single department
                department: {
                    select: {
                        id: true,
                        name: true,
                        code: true
                    }
                }
            }
        });
        
        if (!userWithDepartments) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const response = {
            userId: id,
            legacyDepartment: userWithDepartments.department, // For backward compatibility
            departments: userWithDepartments.userDepartments.map(ud => ({
                id: ud.id,
                departmentId: ud.department.id,
                departmentName: ud.department.name,
                departmentCode: ud.department.code,
                isPrimary: ud.isPrimary,
                role: ud.role,
                assignedAt: ud.assignedAt,
                assignedBy: ud.assignedByUser,
                departmentHead: ud.department.departmentHead,
                parentDepartment: ud.department.parentDepartment
            })),
            primaryDepartment: userWithDepartments.userDepartments.find(ud => ud.isPrimary)
        };
        
        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching user departments:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Assign user to multiple departments
 * POST /user/:id/departments
 */
export const assignUserToDepartments = async (req, res) => {
    const { id: userId } = req.params;
    const { departments, primaryDepartmentId } = req.body;
    
    // Validate input
    if (!departments || !Array.isArray(departments) || departments.length === 0) {
        return res.status(400).json({ 
            error: 'departments array is required and must contain at least one department' 
        });
    }
    
    try {
        // Verify user exists
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, orgId: true, firstName: true, lastName: true }
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Validate departments exist and belong to user's organization
        const departmentIds = departments.map(d => d.departmentId);
        const validDepartments = await prisma.department.findMany({
            where: {
                id: { in: departmentIds },
                orgId: user.orgId
            }
        });
        
        if (validDepartments.length !== departmentIds.length) {
            return res.status(400).json({ 
                error: 'One or more departments not found or not in user organization' 
            });
        }
        
        // Validate primary department is in the list
        if (primaryDepartmentId && !departmentIds.includes(primaryDepartmentId)) {
            return res.status(400).json({ 
                error: 'Primary department must be included in departments list' 
            });
        }
        
        const actorId = req.user?.id;
        const assignments = [];
        
        // Create department assignments in transaction
        await prisma.$transaction(async (prisma) => {
            // Remove existing assignments
            await prisma.userDepartment.deleteMany({
                where: { userId }
            });
            
            // Create new assignments
            for (const dept of departments) {
                const assignment = await prisma.userDepartment.create({
                    data: {
                        userId,
                        departmentId: dept.departmentId,
                        isPrimary: dept.departmentId === (primaryDepartmentId || departments[0].departmentId),
                        role: dept.role || null,
                        assignedBy: actorId,
                        assignedAt: new Date()
                    },
                    include: {
                        department: {
                            select: {
                                id: true,
                                name: true,
                                code: true
                            }
                        }
                    }
                });
                assignments.push(assignment);
            }
            
            // Update legacy departmentId to primary department for backward compatibility
            const primaryDeptId = primaryDepartmentId || departments[0].departmentId;
            await prisma.user.update({
                where: { id: userId },
                data: { departmentId: primaryDeptId }
            });
        });
        
        // Log activity for each department assignment
        for (const assignment of assignments) {
            await logUserActivity(
                actorId,
                user.orgId,
                'ASSIGN',
                'USER_DEPARTMENT',
                assignment.id,
                `Assigned ${user.firstName} ${user.lastName} to department ${assignment.department.name}${assignment.isPrimary ? ' (Primary)' : ''}`,
                { 
                    departmentId: assignment.departmentId,
                    departmentName: assignment.department.name,
                    isPrimary: assignment.isPrimary,
                    role: assignment.role
                },
                req
            );
        }
        
        res.status(201).json({
            message: 'User assigned to departments successfully',
            userId,
            assignments: assignments.map(a => ({
                id: a.id,
                departmentId: a.departmentId,
                departmentName: a.department.name,
                isPrimary: a.isPrimary,
                role: a.role,
                assignedAt: a.assignedAt
            }))
        });
        
    } catch (error) {
        console.error('Error assigning user to departments:', error);
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'User already assigned to one of the departments' });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Update user's department assignments
 * PUT /user/:id/departments
 */
export const updateUserDepartments = async (req, res) => {
    const { id: userId } = req.params;
    const { departments, primaryDepartmentId } = req.body;
    
    if (!departments || !Array.isArray(departments)) {
        return res.status(400).json({ 
            error: 'departments array is required' 
        });
    }
    
    try {
        // Get current assignments for comparison
        const currentAssignments = await prisma.userDepartment.findMany({
            where: { userId },
            include: {
                department: { select: { name: true } }
            }
        });
        
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, orgId: true, firstName: true, lastName: true }
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Track changes for activity logging
        const changes = {
            added: [],
            removed: [],
            updated: []
        };
        
        const actorId = req.user?.id;
        
        await prisma.$transaction(async (prisma) => {
            // Process each department in the request
            for (const dept of departments) {
                const existing = currentAssignments.find(ca => ca.departmentId === dept.departmentId);
                
                if (existing) {
                    // Update existing assignment
                    const updateData = {};
                    if (dept.role !== existing.role) updateData.role = dept.role;
                    if ((dept.departmentId === primaryDepartmentId) !== existing.isPrimary) {
                        updateData.isPrimary = dept.departmentId === primaryDepartmentId;
                    }
                    
                    if (Object.keys(updateData).length > 0) {
                        await prisma.userDepartment.update({
                            where: { id: existing.id },
                            data: updateData
                        });
                        changes.updated.push({
                            departmentId: dept.departmentId,
                            departmentName: existing.department.name,
                            changes: updateData
                        });
                    }
                } else {
                    // Add new assignment
                    const newAssignment = await prisma.userDepartment.create({
                        data: {
                            userId,
                            departmentId: dept.departmentId,
                            isPrimary: dept.departmentId === primaryDepartmentId,
                            role: dept.role || null,
                            assignedBy: actorId,
                            assignedAt: new Date()
                        },
                        include: {
                            department: { select: { name: true } }
                        }
                    });
                    changes.added.push({
                        departmentId: dept.departmentId,
                        departmentName: newAssignment.department.name,
                        isPrimary: newAssignment.isPrimary,
                        role: newAssignment.role
                    });
                }
            }
            
            // Remove departments not in the request
            const requestDeptIds = departments.map(d => d.departmentId);
            const toRemove = currentAssignments.filter(ca => !requestDeptIds.includes(ca.departmentId));
            
            for (const assignment of toRemove) {
                await prisma.userDepartment.delete({
                    where: { id: assignment.id }
                });
                changes.removed.push({
                    departmentId: assignment.departmentId,
                    departmentName: assignment.department.name
                });
            }
            
            // Update legacy departmentId field
            if (primaryDepartmentId) {
                await prisma.user.update({
                    where: { id: userId },
                    data: { departmentId: primaryDepartmentId }
                });
            }
        });
        
        // Log activities
        for (const change of changes.added) {
            await logUserActivity(
                actorId,
                user.orgId,
                'ASSIGN',
                'USER_DEPARTMENT',
                change.departmentId,
                `Added ${user.firstName} ${user.lastName} to department ${change.departmentName}`,
                change,
                req
            );
        }
        
        for (const change of changes.removed) {
            await logUserActivity(
                actorId,
                user.orgId,
                'UNASSIGN',
                'USER_DEPARTMENT',
                change.departmentId,
                `Removed ${user.firstName} ${user.lastName} from department ${change.departmentName}`,
                change,
                req
            );
        }
        
        for (const change of changes.updated) {
            await logUserActivity(
                actorId,
                user.orgId,
                'UPDATE',
                'USER_DEPARTMENT',
                change.departmentId,
                `Updated ${user.firstName} ${user.lastName}'s assignment in department ${change.departmentName}`,
                change,
                req
            );
        }
        
        res.status(200).json({
            message: 'User department assignments updated successfully',
            userId,
            changes
        });
        
    } catch (error) {
        console.error('Error updating user departments:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Remove user from specific department
 * DELETE /user/:id/departments/:departmentId
 */
export const removeUserFromDepartment = async (req, res) => {
    const { id: userId, departmentId } = req.params;
    
    try {
        const assignment = await prisma.userDepartment.findUnique({
            where: {
                userId_departmentId: {
                    userId,
                    departmentId
                }
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        orgId: true
                    }
                },
                department: {
                    select: {
                        name: true
                    }
                }
            }
        });
        
        if (!assignment) {
            return res.status(404).json({ error: 'User department assignment not found' });
        }
        
        // Check if this is the primary department
        if (assignment.isPrimary) {
            // Check if user has other departments
            const otherDepartments = await prisma.userDepartment.findMany({
                where: {
                    userId,
                    departmentId: { not: departmentId }
                }
            });
            
            if (otherDepartments.length > 0) {
                // Make another department primary
                await prisma.userDepartment.update({
                    where: { id: otherDepartments[0].id },
                    data: { isPrimary: true }
                });
                
                // Update legacy departmentId
                await prisma.user.update({
                    where: { id: userId },
                    data: { departmentId: otherDepartments[0].departmentId }
                });
            } else {
                // This is the last department, clear legacy departmentId
                await prisma.user.update({
                    where: { id: userId },
                    data: { departmentId: null }
                });
            }
        }
        
        // Remove the assignment
        await prisma.userDepartment.delete({
            where: { id: assignment.id }
        });
        
        // Log activity
        const actorId = req.user?.id;
        await logUserActivity(
            actorId,
            assignment.user.orgId,
            'UNASSIGN',
            'USER_DEPARTMENT',
            departmentId,
            `Removed ${assignment.user.firstName} ${assignment.user.lastName} from department ${assignment.department.name}`,
            {
                departmentId,
                departmentName: assignment.department.name,
                wasPrimary: assignment.isPrimary
            },
            req
        );
        
        res.status(200).json({
            message: 'User removed from department successfully',
            userId,
            departmentId,
            departmentName: assignment.department.name,
            wasPrimary: assignment.isPrimary
        });
        
    } catch (error) {
        console.error('Error removing user from department:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
