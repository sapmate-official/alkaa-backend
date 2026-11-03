import prisma from "../../../../db/connectDb.js";

const sanitizeManagerEmails = (m) => {
    if (!m) return m;
    const { email: _e, ...rest } = m;
    return {
        ...rest,
        personalEmail: m.personalEmail || m.email,
        businessEmail: m.businessEmail || null
    };
};

const sanitizeUserEmails = (u) => {
    if (!u) return u;
    const { email: _e, ...rest } = u;
    return {
        ...rest,
        personalEmail: u.personalEmail || u.email,
        businessEmail: u.businessEmail || null,
        ...(u.manager !== undefined ? { manager: sanitizeManagerEmails(u.manager) } : {})
    };
};


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

        res.json(employees.map(sanitizeUserEmails));
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

        res.json(sanitizeUserEmails(employee));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export {
    listOfEmployees,
    getEmployeeById
};
