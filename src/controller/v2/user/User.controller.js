import prisma from '../../../db/connectDb.js';
import { validationResult } from 'express-validator';
import { sendPasswordResetEmail } from '../../../util/sendEmail.js';



export const getUser = async (req, res) => {
    try {
        const { orgId } = req.params;
        const users = await prisma.user.findMany({ where: { orgId } ,
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
    if (!errors.isEmpty())   {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, name, orgId, role } = req.body;
    
    try {
        const organizationName = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { name: true }
        });
        const date_ = new Date();
        const nameInitials = organizationName.name.split(' ').map(word=>word.charAt(0)).join('');
        const employeeId = nameInitials+date_.getFullYear().toString().slice(-2)+date_.getMonth().toString().padStart(2, '0');

        const newUser = await prisma.user.create({
            data: {
                email,
                name,
                orgId,
                role,
                employeeId
            },
        });
        const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        sendPasswordResetEmail(newUser.email,verificationToken)
        await prisma.user.update({
            where: { id: newUser.id },
            data: { verificationToken },
        });
        res.status(201).json(newUser);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const updateUser = async (req, res) => {
    console.log('Request received:', req.method, req.params, req.body); // Debugging step

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array()); // Debugging step
        return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const isPutRequest = req.method === 'PUT';
    const updateData = {
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        departmentId: req.body.departmentId,
        managerId: req.body.managerId,
        status: req.body.status,
        verificationToken: req.body.verificationToken,
        dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : undefined,
        address: req.body.address,
        mobileNumber: req.body.mobileNumber,
        adharNumber: req.body.adharNumber,
        panNumber: req.body.panNumber,
        employeeId: req.body.employeeId,
        hiredDate: req.body.hiredDate ? new Date(req.body.hiredDate) : undefined,
        terminationDate: req.body.terminationDate ? new Date(req.body.terminationDate) : undefined,
        annualPackage: req.body.annualPackage ? parseFloat(req.body.annualPackage) : undefined,
        monthlySalary: req.body.monthlySalary ? parseFloat(req.body.monthlySalary) : undefined,
        orgId: req.body.orgId,
    };

    // For PUT requests, validate required fields
    if (isPutRequest && (!updateData.email || !updateData.orgId)) {
        console.log(isPutRequest, updateData); // Debugging step
        
        console.log('Missing required fields for PUT request'); // Debugging step
        return res.status(400).json({ error: 'Email and orgId are required for PUT requests' });
    }

    // Remove undefined fields for PATCH requests
    if (!isPutRequest) {
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined || updateData[key] === '') {
                delete updateData[key];
            }
        });
    }
    
    try {
        console.log('Updating user:', id, updateData); // Debugging step
        
        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData
        });
        console.log('User updated successfully:', updatedUser); // Debugging step
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error('Error updating user:', error); // Debugging step
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Email already exists' });
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