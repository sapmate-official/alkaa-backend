import prisma from '../../../db/connectDb.js';
import { validationResult } from 'express-validator';
import { sendPasswordResetEmail, sendNewEmployeeWelcomeEmail, sendDepartmentChangeEmail } from '../../../util/sendEmail.js';
import { logProfileChange, logUserCreation, logUserStatusChange, logAuthActivity, logRoleChange, logUserDeletion, logDepartmentChange } from '../../../util/activityLogger.js';
import bcrypt from 'bcrypt';

// Helper function to find user by id or employeeId
const findUserByIdOrEmployeeId = async (identifier, includeOptions = {}) => {
    // First try to find by id
    let user = await prisma.user.findUnique({
        where: { id: identifier },
        ...includeOptions
    });
    
    // If not found by id, try to find by employeeId
    if (!user) {
        user = await prisma.user.findUnique({
            where: { employeeId: identifier },
            ...includeOptions
        });
    }
    
    return user;
};

export const getUser = async (req, res) => {
    try {
    // Accept orgId from route params, query, body or authenticated user
    const orgId = req.params?.orgId || req.query?.orgId || req.body?.orgId || req.user?.orgId;
        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID is required' });
        }
        const { onlyActive } = req.query;
        const users = await prisma.user.findMany({ where: { orgId ,
            ...(onlyActive === 'true' ? { status: 'active' } : {})
        } ,
        include:{
            organization:true,
            department:true,
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
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getUserById = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await findUserByIdOrEmployeeId(id, {
            include: {
                organization: true,
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
        panNumber,
        employeeId
    } = req.body;

    // Check for required fields
    if (!email || !orgId || !firstName || !lastName || !employeeId) {
        return res.status(400).json({ 
            error: 'Required fields missing', 
            requiredFields: ['email', 'orgId', 'firstName', 'lastName', 'employeeId'] 
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
        
        // Handle duplicate employeeId error
        if (error.code === 'P2002' && error.meta?.target?.includes('employeeId')) {
            return res.status(409).json({ error: 'Employee ID already exists' });
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
        
        // Get original user data for comparison using flexible lookup
        const originalUser = await findUserByIdOrEmployeeId(id, {
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
        
        const updatedUser = await prisma.user.update({
            where: { id: originalUser.id }, // Use the actual id for update
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
            if (error.meta?.target?.includes('email')) {
                return res.status(409).json({ error: 'Email already exists' });
            }
            if (error.meta?.target?.includes('employeeId')) {
                return res.status(409).json({ error: 'Employee ID already exists' });
            }
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
        // Get user information before deletion for logging using flexible lookup
        const userToDelete = await findUserByIdOrEmployeeId(id, {
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
        
        await prisma.user.delete({ where: { id: userToDelete.id } });
        
        // Log user deletion
        await logUserDeletion(
            req.user.id,
            userToDelete.id,
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
        return res.status(400).json({ error: 'User ID or Employee ID is required' });
    }

    try {
        // Check if user exists using flexible lookup
        const userExists = await findUserByIdOrEmployeeId(id, {
            include: {
                roles: true,
                department: true,
                organization: true
            }
        });

        if (!userExists) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Use the actual user ID for all subsequent operations
        const userId = userExists.id;

        // Use Prisma transaction to ensure all operations are atomic
        const result = await prisma.$transaction(async (prismaClient) => {
            console.log(`Starting hard delete for user ${userId} (${userExists.firstName} ${userExists.lastName})`);
            
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
            await prismaClient.department.updateMany({
                where: { headId: userId },
                data: { headId: null }
            });

            // Update users who had this user as manager
            await prismaClient.user.updateMany({
                where: { managerId: userId },
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

        console.log(`User ${userId} successfully hard deleted`);
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
            message: 'Organization ID and User ID/Employee ID are required',
            required: ['orgId', 'userId']
        });
    }

    try {
        // Check if user exists and belongs to the specified organization using flexible lookup
        const userExists = await findUserByIdOrEmployeeId(userId, {
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

        if (!userExists || userExists.orgId !== orgId) {
            return res.status(404).json({ 
                error: 'Not Found',
                message: 'User not found in the specified organization',
                orgId: orgId,
                userId: userId
            });
        }

        // Use the actual user ID for all subsequent operations
        const actualUserId = userExists.id;

        // Use Prisma transaction to ensure all operations are atomic
        const result = await prisma.$transaction(async (prismaClient) => {
            console.log(`Starting hard delete for user ${actualUserId} from organization ${orgId} (${userExists.firstName} ${userExists.lastName})`);
            
            // Delete Organization_admin records
            await prismaClient.organization_admin.deleteMany({
                where: { adminId: actualUserId }
            });
            
            // Delete all UserRoles
            await prismaClient.userRole.deleteMany({
                where: { userId: actualUserId }
            });

            // Delete PushSubscriptions
            await prismaClient.pushSubscription.deleteMany({
                where: { userId: actualUserId }
            });

            // Delete all Notifications
            await prismaClient.notification.deleteMany({
                where: { userId: actualUserId }
            });

            // Delete all LeaveBalances
            await prismaClient.leaveBalance.deleteMany({
                where: { userId: actualUserId }
            });

            // Delete all LeaveRequests
            await prismaClient.leaveRequest.deleteMany({
                where: { userId: actualUserId }
            });

            // Delete BankDetails if exists
            await prismaClient.bankDetails.deleteMany({
                where: { userId: actualUserId }
            });

            // Delete SalaryParameter if exists
            await prismaClient.salaryParameter.deleteMany({
                where: { userId: actualUserId }
            });

            // Process SalaryRecords and their transactions
            const salaryRecords = await prismaClient.salaryRecord.findMany({
                where: { userId: actualUserId },
                select: { id: true }
            });

            for (const record of salaryRecords) {
                await prismaClient.salaryTransactionTable.deleteMany({
                    where: { salaryRecordId: record.id }
                });
            }

            await prismaClient.salaryRecord.deleteMany({
                where: { userId: actualUserId }
            });

            // For UserDailyReports connected to attendances
            const attendances = await prismaClient.attendanceRecord.findMany({
                where: { userId: actualUserId },
                select: { id: true }
            });

            for (const attendance of attendances) {
                await prismaClient.userDailyReport.deleteMany({
                    where: { attendanceId: attendance.id }
                });
            }

            // Delete attendance records
            await prismaClient.attendanceRecord.deleteMany({
                where: { userId: actualUserId }
            });

            // Check and update departments where user is head
            const departmentsAffected = await prismaClient.department.updateMany({
                where: { 
                    headId: actualUserId,
                    orgId: orgId 
                },
                data: { headId: null }
            });

            // Update users who had this user as manager (only within the same organization)
            const subordinatesAffected = await prismaClient.user.updateMany({
                where: { 
                    managerId: actualUserId,
                    orgId: orgId 
                },
                data: { managerId: null }
            });

            // Delete all transactions
            await prismaClient.transactionTable.deleteMany({
                where: {
                    OR: [
                        { senderUserId: actualUserId },
                        { recieverUserId: actualUserId }
                    ]
                }
            });

            // Finally delete the user
            const deletedUser = await prismaClient.user.delete({
                where: { id: actualUserId }
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

        console.log(`User ${actualUserId} successfully hard deleted from organization ${orgId}`);
        res.status(200).json({ 
            success: true,
            message: 'User and all related data successfully deleted from organization',
            data: {
                deletedUser: {
                    id: result.deletedUser.id,
                    employeeId: result.deletedUser.employeeId,
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
        
        // Get user and org information for logging using flexible lookup
        const targetUser = await findUserByIdOrEmployeeId(userId, {
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

        // Use the actual user ID for role operations
        const actualUserId = targetUser.id;
        
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
        // Get original user data for comparison using flexible lookup
        const originalUser = await findUserByIdOrEmployeeId(userId, {
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
            where: { id: originalUser.id },
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