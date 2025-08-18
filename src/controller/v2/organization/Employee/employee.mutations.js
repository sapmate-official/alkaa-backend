import prisma from "../../../../db/connectDb.js";
import { sendNewEmployeeWelcomeEmail } from "../../../../util/sendEmail.js";
import { logUserDepartmentAssignment } from "../../../../util/activityLogger.js";

const createEmployee = async (req, res) => {
    try {
        console.log('Creating new employee with request body:', req.body);

        const {
            firstName,
            lastName,
            email,
            mobileNumber,
            emergencyContact,
            dateOfBirth,
            hiredDate,
            address,
            adharNumber,
            panNumber,
            employeeId,
            accountHolder,
            accountNumber,
            ifscCode,
            bankName,
            annualPackage,
            monthlySalary,
            hraPercentage,
            daPercentage,
            taPercentage,
            pfPercentage,
            taxPercentage,
            insuranceFixed,
            departmentId, // Legacy support: primary department
            departmentIds, // NEW: Array of departments for multi-department assignment
            roleIds,
            managerId,
        } = req.body.data;
        const orgId = req.body.orgId;

        // Add this check before the validation
        const existingEmployee = await prisma.user.findFirst({
            where: {
                orgId,
                email
            }
        });
        console.log(existingEmployee);
        
        if (existingEmployee) {
            console.log("existing",existingEmployee);
            return res.status(400).json({ 
                error: 'An employee with this email already exists in your organization' 
            });
        }

        // Add this check after the email check
        const existingEmployeeId = await prisma.user.findFirst({
            where: {
                orgId,
                employeeId
            }
        });
        console.log("existing",existingEmployeeId);
        
        if (existingEmployeeId) {
            return res.status(400).json({ 
                error: 'An employee with this Employee ID already exists in your organization' 
            });
        }

        // Basic validation
        console.log('Validating required fields...');
        if (!firstName || !lastName || !email || !mobileNumber || !employeeId  || !roleIds.length>0 || !orgId || !hiredDate || !emergencyContact ) {
            console.log(firstName, lastName, email, mobileNumber, employeeId, departmentId, departmentIds, roleIds, orgId, emergencyContact);
            console.log('Validation failed: Missing required fields', firstName?true:false, lastName?true:false, email?true:false, mobileNumber?true:false, employeeId?true:false, departmentId?true:false, departmentIds?true:false, roleIds?true:false,orgId?true:false);
            return res.status(400).json({ error: 'Required fields are missing' });
        }

        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            console.log('Validation failed: Invalid email format:', email);
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // NEW: Handle department assignment logic
        // Priority: departmentIds array > single departmentId > no department
        let finalDepartmentIds = [];
        let primaryDepartmentId = null;

        if (departmentIds && Array.isArray(departmentIds) && departmentIds.length > 0) {
            finalDepartmentIds = departmentIds;
            primaryDepartmentId = departmentIds[0]; // First department is primary
        } else if (departmentId) {
            finalDepartmentIds = [departmentId];
            primaryDepartmentId = departmentId;
        }

        console.log('Creating employee in database with data:', {
            orgId,
            primaryDepartmentId,
            finalDepartmentIds,
            managerId,
            email,
            employeeId,
            roleIds
        });
        const organizationValidation = await prisma.organization.findUnique({
            where:{
                id:orgId
            },
            select:{
                name:true
            }
        })
        if(!organizationValidation){
            return res.status(400).json({ error: 'Organization not found' });
        }

        // Create user with nested creates for related data
        const employee = await prisma.user.create({
            data: {
                orgId,
                departmentId: primaryDepartmentId, // Legacy field for backward compatibility
                managerId,
                email,
                firstName,
                lastName,
                employeeId,
                mobileNumber,
                hiredDate: hiredDate ? new Date(hiredDate) : new Date(),
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
                address,
                adharNumber,
                emergencyContact,
                panNumber,
                status:'inactive',
                annualPackage: annualPackage || 0,
                monthlySalary: monthlySalary || 0,
                roles: {
                    create: roleIds?.map(roleId => ({
                        role: { connect: { id: roleId } }
                    }))
                },
                ...(accountHolder && accountNumber && ifscCode && bankName ? {
                    bankDetails: {
                        create: {
                            accountHolder,
                            accountNumber,
                            ifscCode,
                            bankName
                        }
                    }
                } : {}),
                ...(annualPackage || monthlySalary ? {
                    salaryParameter: {
                        create: {
                            hraPercentage: hraPercentage ?? 40,
                            daPercentage: daPercentage ?? 10,
                            taPercentage: taPercentage ?? 10,
                            pfPercentage: pfPercentage ?? 12,
                            taxPercentage: taxPercentage ?? 10,
                            insuranceFixed: insuranceFixed ?? 1000
                        }
                    }
                } : {})
            },
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
                // NEW: Include multi-department assignments
                userDepartments: {
                    include: {
                        department: {
                            select: {
                                id: true,
                                name: true,
                                code: true
                            }
                        }
                    }
                },
                roles: {
                    include: {
                        role: true
                    }
                },
                bankDetails: true,
                salaryParameter: true,
                manager:{
                    select:{
                        firstName:true,
                        lastName:true,
                        email:true
                    }
                }
            }
        });

        // NEW: Create UserDepartment records for multi-department assignment
        if (finalDepartmentIds.length > 0) {
            await Promise.all(finalDepartmentIds.map(async (deptId, index) => {
                const userDepartmentRecord = await prisma.userDepartment.create({
                    data: {
                        userId: employee.id,
                        departmentId: deptId,
                        isPrimary: index === 0, // First department is primary
                        assignedAt: new Date(),
                        assignedBy: req.user?.id // Assuming auth middleware provides user
                    }
                });

                // Log department assignment activity
                await logUserDepartmentAssignment(
                    employee.id,
                    deptId,
                    'ASSIGN',
                    req.user?.id,
                    { isPrimary: index === 0 }
                );

                return userDepartmentRecord;
            }));
        }
        const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        
        // Fetch team members from the same department
        const teamMembers = await prisma.user.findMany({
            where: {
                departmentId: employee.departmentId,
                id: { not: employee.id }
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
        const formattedTeamMembers = teamMembers.map(member => ({
            name: `${member.firstName} ${member.lastName}`,
            role: member.roles.length > 0 ? member.roles[0].role.name : 'Team Member',
            department: member.department?.name || 'No Department'
        }));
        
        // Only send email if manager exists
        if (employee.manager && employee.manager.email) {
            await sendNewEmployeeWelcomeEmail(
                employee.email,
                `${employee.firstName} ${employee.lastName}`,
                employee.manager.email,
                employee.manager.firstName + ' ' + employee.manager.lastName,
                employee.department?.departmentHead ? {
                    email: employee.department.departmentHead.email,
                    name: employee.department.departmentHead.firstName + ' ' + employee.department.departmentHead.lastName
                } : null,
                formattedTeamMembers,
                {
                    employeeId: employee.employeeId,
                    department: employee.department?.name || 'Not Assigned',
                    departments: finalDepartmentIds.length > 1 ? 
                        finalDepartmentIds.map(id => {
                            const dept = employee.userDepartments?.find(ud => ud.departmentId === id);
                            return dept?.department?.name || 'Unknown';
                        }).join(', ') : undefined,
                    hiredDate: employee.hiredDate,
                    verificationToken: verificationToken
                },
                organizationValidation.name
            );
        }
        
        await prisma.user.update({
            where: { id: employee.id },
            data: { verificationToken },
        });
        const leaveTypes = await prisma.leaveType.findMany({
            where: { orgId },
            
        });
        const leaveBalances = await prisma.leaveBalance.createMany({
            data: leaveTypes.map(leaveType => ({
                userId: employee.id,
                leaveTypeId: leaveType.id,
                usedDays: 0,
                remainingDays: leaveType.annualLimit,
                year: new Date().getFullYear()
            }))
        });

        console.log('Employee created successfully:', employee);
        res.status(201).json(employee);
    } catch (error) {
        console.error('Error creating employee:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update employee
const updateEmployee = async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ error: 'Employee ID is required' });
        }

        const {
            departmentId, // Legacy support
            departmentIds, // NEW: Multi-department update
            email,
            firstName,
            lastName,
            employeeId,
            mobileNumber,
            emergencyContact,
            status,
            bankDetails,
            salaryDetails
        } = req.body;

        // NEW: Handle department updates
        let updateData = {
            email,
            firstName,
            lastName,
            employeeId,
            mobileNumber,
            emergencyContact,
            status,
            bankDetails: bankDetails ? {
                upsert: {
                    create: bankDetails,
                    update: bankDetails
                }
            } : undefined,
            salaryParameter: salaryDetails ? {
                upsert: {
                    create: salaryDetails,
                    update: salaryDetails
                }
            } : undefined
        };

        // Handle department updates
        if (departmentIds && Array.isArray(departmentIds) && departmentIds.length > 0) {
            // Multi-department update: Set primary department for legacy compatibility
            updateData.departmentId = departmentIds[0];
        } else if (departmentId !== undefined) {
            // Legacy single department update
            updateData.departmentId = departmentId;
        }

        const employee = await prisma.user.update({
            where: { id },
            data: updateData,
            include: {
                department: true,
                userDepartments: {
                    include: {
                        department: {
                            select: {
                                id: true,
                                name: true,
                                code: true
                            }
                        }
                    }
                },
                roles: {
                    include: {
                        role: true
                    }
                },
                bankDetails: true,
                salaryParameter: true
            }
        });

        // NEW: Handle multi-department assignment updates
        if (departmentIds && Array.isArray(departmentIds) && departmentIds.length > 0) {
            // Remove existing department assignments
            await prisma.userDepartment.deleteMany({
                where: { userId: id }
            });

            // Create new department assignments
            await Promise.all(departmentIds.map(async (deptId, index) => {
                const userDepartmentRecord = await prisma.userDepartment.create({
                    data: {
                        userId: id,
                        departmentId: deptId,
                        isPrimary: index === 0, // First department is primary
                        assignedAt: new Date(),
                        assignedBy: req.user?.id
                    }
                });

                // Log department assignment activity
                await logUserDepartmentAssignment(
                    id,
                    deptId,
                    'UPDATE',
                    req.user?.id,
                    { isPrimary: index === 0 }
                );

                return userDepartmentRecord;
            }));
        }

        res.json(employee);
    } catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({ error: error.message });
    }
};

// NEW: Assign employee to additional departments
const assignEmployeeToDepartments = async (req, res) => {
    try {
        const { id } = req.params; // Employee ID
        const { departmentIds, replacePrimary } = req.body;

        if (!departmentIds || !Array.isArray(departmentIds) || departmentIds.length === 0) {
            return res.status(400).json({ error: 'Department IDs array is required' });
        }

        // Verify employee exists
        const employee = await prisma.user.findUnique({
            where: { id },
            include: {
                userDepartments: true
            }
        });

        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        // Get current department assignments
        const currentDeptIds = employee.userDepartments.map(ud => ud.departmentId);
        const newDeptIds = departmentIds.filter(deptId => !currentDeptIds.includes(deptId));

        // Create new department assignments
        const newAssignments = await Promise.all(newDeptIds.map(async (deptId, index) => {
            const isFirstNew = index === 0 && replacePrimary;
            
            const userDepartmentRecord = await prisma.userDepartment.create({
                data: {
                    userId: id,
                    departmentId: deptId,
                    isPrimary: isFirstNew, // Only if replacing primary
                    assignedAt: new Date(),
                    assignedBy: req.user?.id
                }
            });

            // Log assignment activity
            await logUserDepartmentAssignment(
                id,
                deptId,
                'ASSIGN',
                req.user?.id,
                { isPrimary: isFirstNew }
            );

            return userDepartmentRecord;
        }));

        // If replacing primary, update existing assignments
        if (replacePrimary && newDeptIds.length > 0) {
            await prisma.userDepartment.updateMany({
                where: {
                    userId: id,
                    departmentId: { notIn: newDeptIds }
                },
                data: { isPrimary: false }
            });

            // Update legacy departmentId field
            await prisma.user.update({
                where: { id },
                data: { departmentId: newDeptIds[0] }
            });
        }

        // Fetch updated employee data
        const updatedEmployee = await prisma.user.findUnique({
            where: { id },
            include: {
                userDepartments: {
                    include: {
                        department: {
                            select: {
                                id: true,
                                name: true,
                                code: true
                            }
                        }
                    }
                }
            }
        });

        res.status(201).json({
            message: 'Employee assigned to departments successfully',
            newAssignments: newAssignments.length,
            employee: updatedEmployee
        });

    } catch (error) {
        console.error('Error assigning employee to departments:', error);
        res.status(500).json({ error: error.message });
    }
};

// NEW: Remove employee from departments
const removeEmployeeFromDepartments = async (req, res) => {
    try {
        const { id } = req.params; // Employee ID
        const { departmentIds } = req.body;

        if (!departmentIds || !Array.isArray(departmentIds) || departmentIds.length === 0) {
            return res.status(400).json({ error: 'Department IDs array is required' });
        }

        // Verify employee exists
        const employee = await prisma.user.findUnique({
            where: { id },
            include: {
                userDepartments: true
            }
        });

        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        // Check if removing primary department
        const primaryDept = employee.userDepartments.find(ud => ud.isPrimary);
        const removingPrimary = primaryDept && departmentIds.includes(primaryDept.departmentId);

        // Remove department assignments
        const removedCount = await prisma.userDepartment.deleteMany({
            where: {
                userId: id,
                departmentId: { in: departmentIds }
            }
        });

        // Log removal activities
        await Promise.all(departmentIds.map(deptId => 
            logUserDepartmentAssignment(
                id,
                deptId,
                'UNASSIGN',
                req.user?.id,
                { wasPrimary: removingPrimary && deptId === primaryDept?.departmentId }
            )
        ));

        // If primary department was removed, assign new primary
        if (removingPrimary) {
            const remainingDepartments = await prisma.userDepartment.findMany({
                where: { userId: id }
            });

            if (remainingDepartments.length > 0) {
                // Set first remaining department as primary
                await prisma.userDepartment.update({
                    where: { id: remainingDepartments[0].id },
                    data: { isPrimary: true }
                });

                // Update legacy departmentId field
                await prisma.user.update({
                    where: { id },
                    data: { departmentId: remainingDepartments[0].departmentId }
                });
            } else {
                // No departments left - clear legacy field
                await prisma.user.update({
                    where: { id },
                    data: { departmentId: null }
                });
            }
        }

        res.json({
            message: 'Employee removed from departments successfully',
            removedCount: removedCount.count
        });

    } catch (error) {
        console.error('Error removing employee from departments:', error);
        res.status(500).json({ error: error.message });
    }
};

// NEW: Set primary department for employee
const setEmployeePrimaryDepartment = async (req, res) => {
    try {
        const { id } = req.params; // Employee ID
        const { departmentId } = req.body;

        if (!departmentId) {
            return res.status(400).json({ error: 'Department ID is required' });
        }

        // Verify employee is assigned to this department
        const existingAssignment = await prisma.userDepartment.findFirst({
            where: {
                userId: id,
                departmentId: departmentId
            }
        });

        if (!existingAssignment) {
            return res.status(400).json({ 
                error: 'Employee is not assigned to this department' 
            });
        }

        // Update primary assignments
        await prisma.$transaction([
            // Remove primary flag from all current assignments
            prisma.userDepartment.updateMany({
                where: { userId: id },
                data: { isPrimary: false }
            }),
            // Set new primary department
            prisma.userDepartment.update({
                where: { id: existingAssignment.id },
                data: { isPrimary: true }
            }),
            // Update legacy departmentId field
            prisma.user.update({
                where: { id },
                data: { departmentId: departmentId }
            })
        ]);

        // Log activity
        await logUserDepartmentAssignment(
            id,
            departmentId,
            'UPDATE',
            req.user?.id,
            { setPrimary: true }
        );

        res.json({
            message: 'Primary department updated successfully'
        });

    } catch (error) {
        console.error('Error setting primary department:', error);
        res.status(500).json({ error: error.message });
    }
};

// Delete employee
const deleteEmployee = async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ error: 'Employee ID is required' });
        }

        await prisma.user.delete({
            where: { id }
        });

        res.json({ message: 'Employee deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export {
    createEmployee,
    updateEmployee,
    deleteEmployee,
    // NEW: Multi-department management functions
    assignEmployeeToDepartments,
    removeEmployeeFromDepartments,
    setEmployeePrimaryDepartment
};
