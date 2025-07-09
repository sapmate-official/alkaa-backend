import prisma from "../../../../db/connectDb.js";

const generateEmployeeId = async (req, res) => {
    try {
        const { orgId } = req.params;
        const organizationName = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { name: true }
        });
        const date_ = new Date();
        const nameInitials = organizationName.name.split(' ').map(word => word[0]).join('');
        const employeeId = nameInitials + date_.getFullYear() + date_.getMonth() + date_.getDate() + date_.getHours() + date_.getMinutes() + date_.getSeconds();

        res.json({ employeeId: employeeId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

const checkEmployeeId = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { employeeId } = req.query;
        const employee = await prisma.user.findFirst({
            where: {
                orgId,
                employeeId: {
                    equals: employeeId,
                    not: null
                }
            }
        });
        console.log(employee);
        
        res.json({ exists: !!employee });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export {
    generateEmployeeId,
    checkEmployeeId
};
