import prisma from "../../../../db/connectDb.js";
import { sanitizeUser } from "../../../../util/sanitize.js";


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
                manager: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        personalEmail: true,
                        businessEmail: true,
                        employeeId: true,
                        jobTitle: true
                    }
                },
                roles: {
                    include: {
                        role: true
                    }
                },
                bankDetails: true,
            }
        });
        console.log(employees);

        res.json(employees.map(sanitizeUser));
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
                manager: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        personalEmail: true,
                        businessEmail: true,
                        employeeId: true,
                        jobTitle: true
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

        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        res.json(sanitizeUser(employee));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export {
    listOfEmployees,
    getEmployeeById
};
