import prisma from "../../db/connectDb.js";

// Generate employee ID
const generateEmployeeId = () => {
    const prefix = "EMP";
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${timestamp}${random}`;
};

// Create employee
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
            accountHolder,
            accountNumber,
            ifscCode,
            bankName,
            annualPackage,
            hraPercentage,
            daPercentage,
            taPercentage,
            pfPercentage,
            taxPercentage,
            insuranceFixed,
            departmentId,
            roleIds,
            managerId,
        } = req.body;

        // Basic validation for required fields
        if (!firstName || !lastName || !email || !mobileNumber || !dateOfBirth || !hiredDate || !address || !annualPackage) {
            return res.status(400).json({ error: 'Required fields are missing: firstName, lastName, email, mobileNumber, dateOfBirth, hiredDate, address, annualPackage' });
        }

        // Email format validation
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Generate employee ID
        const employeeId = generateEmployeeId();

        // Calculate monthly salary from annual package
        const monthlySalary = annualPackage / 12;

        // Set default values for optional fields
        const bankDetailsData = {
            accountHolder: accountHolder || `${firstName} ${lastName}`,
            accountNumber: accountNumber || `ACC${Date.now()}`,
            ifscCode: ifscCode || 'DEMO0001234',
            bankName: bankName || 'Demo Bank'
        };
        let organizationId ;
        if(!req.body.orgId){
            const organization = await prisma.organization.findFirst({
                include: {
                    users: {
                        where: {
                            roles: {
                                some: {
                                    role: {
                                        name: "Org_Admin"
                                    }
                                }
                            }
                        },
                        include: {
                            roles: {
                                include: {
                                    role: true
                                }
                            }
                        }
                    }
                }
            })
            organizationId = organization ? organization.id : null;
            if(!organizationId){
                res.status(404).json({
                    message:"No organization exists in database."
                })
            }
        }
        // Create employee with nested creates for related data
        const employee = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email,
                employeeId,
                mobileNumber,
                emergencyContact: emergencyContact || null,
                dateOfBirth: new Date(dateOfBirth),
                hiredDate: new Date(hiredDate),
                address,
                adharNumber: adharNumber || null,
                panNumber: panNumber || null,
                annualPackage: parseFloat(annualPackage),
                monthlySalary: monthlySalary,
                departmentId: departmentId || null,
                managerId: managerId || null,
                status: 'active',
                orgId: req.body.orgId || organizationId, // Default org ID for demo
                bankDetails: {
                    create: bankDetailsData
                },
                salaryParameter: {
                    create: {
                        hraPercentage: hraPercentage || 0,
                        daPercentage: daPercentage || 0,
                        taPercentage: taPercentage || 0,
                        pfPercentage: pfPercentage || 0,
                        taxPercentage: taxPercentage || 0,
                        insuranceFixed: insuranceFixed || 0
                    }
                },
                ...(roleIds && roleIds.length > 0 ? {
                    roles: {
                        create: roleIds.map(roleId => ({
                            role: { connect: { id: roleId } }
                        }))
                    }
                } : {})
            },
            include: {
                department: true,
                roles: {
                    include: {
                        role: true
                    }
                },
                bankDetails: true,
                salaryParameter: true,
                manager: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });

        console.log('Employee created successfully:', employee);
        res.status(201).json({
            message: 'Employee created successfully',
            employee
        });
    } catch (error) {
        console.error('Error creating employee:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: error.message });
    }
};

// Update employee
const updateEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'Employee ID is required' });
        }

        const {
            firstName,
            lastName,
            email,
            mobileNumber,
            emergencyContact,
            dateOfBirth,
            address,
            adharNumber,
            panNumber,
            annualPackage,
            departmentId,
            managerId,
            status,
            bankDetails,
            salaryDetails
        } = req.body;

        // Calculate monthly salary if annual package is updated
        const updateData = {
            firstName,
            lastName,
            email,
            mobileNumber,
            emergencyContact,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            address,
            adharNumber,
            panNumber,
            departmentId,
            managerId,
            status
        };

        if (annualPackage) {
            updateData.annualPackage = parseFloat(annualPackage);
            updateData.monthlySalary = parseFloat(annualPackage) / 12;
        }

        // Remove undefined values
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });

        const employee = await prisma.user.update({
            where: { id },
            data: {
                ...updateData,
                ...(bankDetails ? {
                    bankDetails: {
                        upsert: {
                            create: bankDetails,
                            update: bankDetails
                        }
                    }
                } : {}),
                ...(salaryDetails ? {
                    salaryParameter: {
                        upsert: {
                            create: salaryDetails,
                            update: salaryDetails
                        }
                    }
                } : {})
            },
            include: {
                department: true,
                roles: {
                    include: {
                        role: true
                    }
                },
                bankDetails: true,
                salaryParameter: true,
                manager: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });

        res.json({
            message: 'Employee updated successfully',
            employee
        });
    } catch (error) {
        console.error('Error updating employee:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.status(500).json({ error: error.message });
    }
};

// Delete employee
const deleteEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'Employee ID is required' });
        }

        // Check if employee exists
        const existingEmployee = await prisma.user.findUnique({
            where: { id },
            include: {
                bankDetails: true,
                salaryParameter: true,
                roles: true
            }
        });

        if (!existingEmployee) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        // Delete related records first
        await prisma.$transaction(async (tx) => {
            // Delete user roles
            await tx.userRole.deleteMany({
                where: { userId: id }
            });

            // Delete bank details
            if (existingEmployee.bankDetails) {
                await tx.bankDetails.delete({
                    where: { userId: id }
                });
            }

            // Delete salary parameters
            if (existingEmployee.salaryParameter) {
                await tx.salaryParameter.delete({
                    where: { userId: id }
                });
            }

            // Delete the employee
            await tx.user.delete({
                where: { id }
            });
        });

        res.json({
            message: 'Employee deleted successfully',
            deletedEmployeeId: id
        });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ error: error.message });
    }
};

// View employee (with id or without id)
const viewEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 10, search, departmentId, status } = req.query;

        if (id) {
            // Get specific employee by ID
            const employee = await prisma.user.findUnique({
                where: { id },
                include: {
                    department: true,
                    roles: {
                        include: {
                            role: true
                        }
                    },
                    bankDetails: true,
                    salaryParameter: true,
                    manager: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true,
                            employeeId: true
                        }
                    },
                    subordinates: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            employeeId: true
                        }
                    }
                }
            });

            if (!employee) {
                return res.status(404).json({ error: 'Employee not found' });
            }

            res.json({
                message: 'Employee retrieved successfully',
                employee
            });
        } else {
            // Get all employees with pagination and filters
            const skip = (parseInt(page) - 1) * parseInt(limit);
            
            const whereClause = {
                ...(search ? {
                    OR: [
                        { firstName: { contains: search, mode: 'insensitive' } },
                        { lastName: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                        { employeeId: { contains: search, mode: 'insensitive' } }
                    ]
                } : {}),
                ...(departmentId ? { departmentId } : {}),
                ...(status ? { status } : {})
            };

            const [employees, totalCount] = await Promise.all([
                prisma.user.findMany({
                    where: whereClause,
                    skip,
                    take: parseInt(limit),
                    include: {
                        department: {
                            select: {
                                name: true
                            }
                        },
                        roles: {
                            include: {
                                role: {
                                    select: {
                                        name: true
                                    }
                                }
                            }
                        },
                        manager: {
                            select: {
                                firstName: true,
                                lastName: true,
                                employeeId: true
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                }),
                prisma.user.count({ where: whereClause })
            ]);

            const totalPages = Math.ceil(totalCount / parseInt(limit));

            res.json({
                message: 'Employees retrieved successfully',
                employees,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalCount,
                    limit: parseInt(limit)
                }
            });
        }
    } catch (error) {
        console.error('Error retrieving employee(s):', error);
        res.status(500).json({ error: error.message });
    }
};

export { createEmployee, updateEmployee, deleteEmployee, viewEmployee };
// import prisma from "../../../../db/connectDb.js";
// import { sendNewEmployeeWelcomeEmail } from "../../../../util/sendEmail.js";
// //working solution
// // Create new employee
// const createEmployee = async (req, res) => {
//     try {
//         console.log('Creating new employee with request body:', req.body);

//         const {
//             firstName,
//             lastName,
//             email,
//             mobileNumber,
//             emergencyContact,
//             dateOfBirth,
//             hiredDate,
//             address,
//             adharNumber,
//             panNumber,
//             employeeId,
//             accountHolder,
//             accountNumber,
//             ifscCode,
//             bankName,
//             annualPackage,
//             monthlySalary,
//             hraPercentage,
//             daPercentage,
//             taPercentage,
//             pfPercentage,
//             taxPercentage,
//             insuranceFixed,
//             departmentId,
//             roleIds,
//             managerId,
//         } = req.body.data;
//         const orgId = req.body.orgId;

//         // Add this check before the validation
//         const existingEmployee = await prisma.user.findFirst({
//             where: {
//                 orgId,
//                 email
//             }
//         });
//         console.log(existingEmployee);
        
//         if (existingEmployee) {
//             console.log("existing",existingEmployee);
//             return res.status(400).json({ 
//                 error: 'An employee with this email already exists in your organization' 
//             });
//         }

//         // Add this check after the email check
//         const existingEmployeeId = await prisma.user.findFirst({
//             where: {
//                 orgId,
//                 employeeId
//             }
//         });
//         console.log("existing",existingEmployeeId);
        
//         if (existingEmployeeId) {
//             return res.status(400).json({ 
//                 error: 'An employee with this Employee ID already exists in your organization' 
//             });
//         }

//         // Basic validation
//         console.log('Validating required fields...');
//         if (!firstName || !lastName || !email || !mobileNumber || !employeeId  || !roleIds.length>0 || !orgId || !hiredDate || !emergencyContact ) {
//             console.log(firstName, lastName, email, mobileNumber, employeeId, departmentId,roleIds,orgId,emergencyContact);
//             console.log('Validation failed: Missing required fields', firstName?true:false, lastName?true:false, email?true:false, mobileNumber?true:false, employeeId?true:false, departmentId?true:false,roleIds?true:false,orgId?true:false);
//             return res.status(400).json({ error: 'Required fields are missing' });
//         }

//         if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
//             console.log('Validation failed: Invalid email format:', email);
//             return res.status(400).json({ error: 'Invalid email format' });
//         }

//         console.log('Creating employee in database with data:', {
//             orgId,
//             departmentId,
//             managerId,
//             email,
//             employeeId,
//             roleIds
//         });
//         const organizationValidation = await prisma.organization.findUnique({
//             where:{
//                 id:orgId
//             },
//             select:{
//                 name:true
//             }
//         })
//         if(!organizationValidation){
//             return res.status(400).json({ error: 'Organization not found' });
//         }

//         // Create user with nested creates for related data
//         const employee = await prisma.user.create({
//             data: {
//                 orgId,
//                 departmentId:departmentId?departmentId:null,
//                 managerId,
//                 email,
//                 firstName,
//                 lastName,
//                 employeeId,
//                 mobileNumber,
//                 hiredDate: hiredDate ? new Date(hiredDate) : new Date(),
//                 dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
//                 address,
//                 adharNumber,
//                 emergencyContact,
//                 panNumber,
//                 status:'inactive',
//                 annualPackage: annualPackage || 0,
//                 monthlySalary: monthlySalary || 0,
//                 roles: {
//                     create: roleIds?.map(roleId => ({
//                         role: { connect: { id: roleId } }
//                     }))
//                 },
//                 ...(accountHolder && accountNumber && ifscCode && bankName ? {
//                     bankDetails: {
//                         create: {
//                             accountHolder,
//                             accountNumber,
//                             ifscCode,
//                             bankName
//                         }
//                     }
//                 } : {}),
//                 ...(annualPackage || monthlySalary ? {
//                     salaryParameter: {
//                         create: {
//                             hraPercentage: hraPercentage ?? 40,
//                             daPercentage: daPercentage ?? 10,
//                             taPercentage: taPercentage ?? 10,
//                             pfPercentage: pfPercentage ?? 12,
//                             taxPercentage: taxPercentage ?? 10,
//                             insuranceFixed: insuranceFixed ?? 1000
//                         }
//                     }
//                 } : {})
//             },
//             include: {
//                 department: {
//                     include:{
//                         departmentHead:{
//                             select:{
//                                 firstName:true,
//                                 lastName:true,
//                                 email:true
//                             }
//                         }
//                     }
//                 },
//                 roles: {
//                     include: {
//                         role: true
//                     }
//                 },
//                 bankDetails: true,
//                 salaryParameter: true,
//                 manager:{
//                     select:{
//                         firstName:true,
//                         lastName:true,
//                         email:true
//                     }
//                 }
//             }
//         });
//         const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        
//         // Fetch team members from the same department
//         const teamMembers = await prisma.user.findMany({
//             where: {
//                 departmentId: employee.departmentId,
//                 id: { not: employee.id }
//             },
//             take: 5, 
//             select: {
//                 firstName: true,
//                 lastName: true,
//                 roles: {
//                     include: {
//                         role: true
//                     }
//                 }
//             }
//         });
        
//         // Format team members array
//         const formattedTeamMembers = teamMembers.map(member => ({
//             name: `${member.firstName} ${member.lastName}`,
//             role: member.roles.length > 0 ? member.roles[0].role.name : 'Team Member'
//         }));
        
//         // Only send email if manager exists
//         if (employee.manager && employee.manager.email) {
//             await sendNewEmployeeWelcomeEmail(
//                 employee.email,
//                 `${employee.firstName} ${employee.lastName}`,
//                 employee.manager.email,
//                 employee.manager.firstName + ' ' + employee.manager.lastName,
//                 employee.department?.departmentHead ? {
//                     email: employee.department.departmentHead.email,
//                     name: employee.department.departmentHead.firstName + ' ' + employee.department.departmentHead.lastName
//                 } : null,
//                 formattedTeamMembers,
//                 {
//                     employeeId: employee.employeeId,
//                     department: employee.department?.name || 'Not Assigned',
//                     hiredDate: employee.hiredDate,
//                     verificationToken: verificationToken
//                 },
//                 organizationValidation.name
//             );
//         }
        
//         await prisma.user.update({
//             where: { id: employee.id },
//             data: { verificationToken },
//         });
//         const leaveTypes = await prisma.leaveType.findMany({
//             where: { orgId },
            
//         });
//         const leaveBalances = await prisma.leaveBalance.createMany({
//             data: leaveTypes.map(leaveType => ({
//                 userId: employee.id,
//                 leaveTypeId: leaveType.id,
//                 usedDays: 0,
//                 remainingDays: leaveType.annualLimit,
//                 year: new Date().getFullYear()
//             }))
//         });

//         console.log('Employee created successfully:', employee);
//         res.status(201).json(employee);
//     } catch (error) {
//         console.error('Error creating employee:', error);
//         res.status(500).json({ error: error.message });
//     }
// };

// // Update employee
// const updateEmployee = async (req, res) => {
//     try {
//         const { id } = req.query;
//         if (!id) {
//             return res.status(400).json({ error: 'Employee ID is required' });
//         }

//         const {
//             departmentId,
//             email,
//             firstName,
//             lastName,
//             employeeId,
//             mobileNumber,
//             emergencyContact,
//             status,
//             bankDetails,
//             salaryDetails
//         } = req.body;

//         const employee = await prisma.user.update({
//             where: { id },
//             data: {
//                 departmentId,
//                 email,
//                 firstName,
//                 lastName,
//                 employeeId,
//                 mobileNumber,
//                 emergencyContact,
//                 status,
//                 bankDetails: bankDetails ? {
//                     upsert: {
//                         create: bankDetails,
//                         update: bankDetails
//                     }
//                 } : undefined,
//                 salaryParameter: salaryDetails ? {
//                     upsert: {
//                         create: salaryDetails,
//                         update: salaryDetails
//                     }
//                 } : undefined
//             },
//             include: {
//                 department: true,
//                 roles: {
//                     include: {
//                         role: true
//                     }
//                 },
//                 bankDetails: true,
//                 salaryParameter: true
//             }
//         });

//         res.json(employee);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };