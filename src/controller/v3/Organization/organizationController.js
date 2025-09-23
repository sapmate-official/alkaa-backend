import prisma from "../../../db/connectDb.js";
import validateToken from "../../../middleware/validateToken.js";

/**
 * Get organization employees
 */
export const getOrganizationEmployees = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const orgId = req.user.orgId;

        // Get all active employees in the organization
        const employees = await prisma.user.findMany({
            where: {
                orgId,
                status: 'active'
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                employeeId: true,
                monthlySalary: true,
                department: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: [
                { firstName: 'asc' },
                { lastName: 'asc' }
            ]
        });

        return res.status(200).json({
            success: true,
            data: employees,
            count: employees.length
        });

    } catch (error) {
        console.error("Error fetching organization employees:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch employees",
            error: error.message
        });
    }
};
