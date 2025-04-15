import prisma from '../../../db/connectDb.js';
import { validationResult } from 'express-validator';
import { sendPasswordResetEmail } from '../../../util/sendEmail.js';

export const getUser = async (req, res) => {
    try {
        const { orgId } = req.params;
        const users = await prisma.user.findMany({ where: { orgId } ,
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
        if (departmentId) userData.departmentId = departmentId;
        if (managerId) userData.managerId = managerId;
        if (dateOfBirth) userData.dateOfBirth = new Date(dateOfBirth);
        if (address) userData.address = address;
        if (mobileNumber) userData.mobileNumber = mobileNumber;
        if (adharNumber) userData.adharNumber = adharNumber;
        if (panNumber) userData.panNumber = panNumber;

        // Create user
        const newUser = await prisma.user.create({
            data: userData,
        });

        // Generate verification token and update user
        const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const hiredDate = new Date(newUser.createdAt);
        
        // Update user with verification token
        await prisma.user.update({
            where: { id: newUser.id },
            data: { verificationToken },
        });

        // Send password reset email with verification token
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
        
        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData
        });
        
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
        await prisma.user.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
export const updateUserRole = async (req, res) => {
    const { userId,prevRole, roleId } = req.params;
    try {
        console.log(userId,prevRole,roleId);
        let user
        if(roleId=='null'){
             user = await prisma.userRole.delete({
                where: {
                    userId_roleId: {
                        userId: userId,
                        roleId: prevRole
                    }
                }
            });
        }
        else if(prevRole=='null'){
             user = await prisma.userRole.create({
                data: {
                    userId: userId,
                    roleId: roleId
                }
            });
        }else{

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
        }
        res.status(200).json(user);
    } catch (error) {
        console.log(error)
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
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { departmentId },
            include: {
                department: true
            }
        });
        
        res.status(200).json({
            message: "User department updated successfully",
            user: updatedUser
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
