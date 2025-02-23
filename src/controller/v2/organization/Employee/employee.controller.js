import prisma from "../../../../db/connectDb.js";
import { sendPasswordResetEmail } from "../../../../util/sendEmail.js";

// List all employees
const listOfEmployees = async (req, res) => {
    try {
        console.log(req.params);
        
        const { orgId } = req.params;
        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID is required' });
        }
        
        const employees = await prisma.user.findMany({
            where: { orgId },
            include: {
                department: true,
                roles: {
                    include: {
                        role: true
                    }
                },
                bankDetails: true,
            }
        });
        console.log(employees);

        res.json(employees);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get employee by ID
const getEmployeeById = async (req, res) => {
    try {
        const { id } = req.params;
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
                salaryParameter: true
            }
        });

        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        res.json(employee);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create new employee
const createEmployee = async (req, res) => {
    try {
        console.log('Creating new employee with request body:', req.body);

        const {
            firstName,
            lastName,
            email,
            mobileNumber,
            dateOfBirth,
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
            departmentId,
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
        if (!firstName || !lastName || !email || !mobileNumber || !employeeId || !departmentId || !roleIds || !orgId || !managerId ) {
            console.log(firstName, lastName, email, mobileNumber, employeeId, departmentId);
            console.log('Validation failed: Missing required fields');
            return res.status(400).json({ error: 'Required fields are missing' });
        }

        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            console.log('Validation failed: Invalid email format:', email);
            return res.status(400).json({ error: 'Invalid email format' });
        }

        console.log('Creating employee in database with data:', {
            orgId,
            departmentId,
            managerId,
            email,
            employeeId,
            roleIds
        });

        // Create user with nested creates for related data
        const employee = await prisma.user.create({
            data: {
                orgId,
                departmentId,
                managerId,
                email,
                firstName,
                lastName,
                employeeId,
                mobileNumber,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
                address,
                adharNumber,
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
                            hraPercentage: hraPercentage || 40,
                            daPercentage: daPercentage || 10,
                            taPercentage: taPercentage || 10,
                            pfPercentage: pfPercentage || 12,
                            taxPercentage: taxPercentage || 10,
                            insuranceFixed: insuranceFixed || 1000
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
                salaryParameter: true
            }
        });
        const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        sendPasswordResetEmail(employee.email,verificationToken)
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
            departmentId,
            email,
            firstName,
            lastName,
            employeeId,
            mobileNumber,
            status,
            bankDetails,
            salaryDetails
        } = req.body;

        const employee = await prisma.user.update({
            where: { id },
            data: {
                departmentId,
                email,
                firstName,
                lastName,
                employeeId,
                mobileNumber,
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
            },
            include: {
                department: true,
                roles: {
                    include: {
                        role: true
                    }
                },
                bankDetails: true,
                salaryParameter: true
            }
        });

        res.json(employee);
    } catch (error) {
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
    listOfEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee
};