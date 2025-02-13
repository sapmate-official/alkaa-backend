import prisma from "../../../db/connectDb.js";

// Get all leave types for an organization
const getLeaveTypes = async (req, res) => {
    const { org_id } = req.params;
    try {
        const leaveTypes = await prisma.leaveType.findMany({
            where: { orgId:org_id },
        });
        res.status(200).json(leaveTypes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch leave types' });
    }
};
// Get a leave type by ID
const getLeaveTypeById = async (req, res) => {
    const { id } = req.params;
    try {
        const leaveType = await prisma.leaveType.findUnique({
            where: { id },
        });
        if (leaveType) {
            res.status(200).json(leaveType);
        } else {
            res.status(404).json({ error: 'Leave type not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch leave type' });
    }
};

// Create a new leave type
const createLeaveType = async (req, res) => {
    const { orgId } = req.body;
    const { name, description, annualLimit, requiresApproval, isPaid,carryForward,maxCarryForward    } = req.body;

    try {
        const leaveType = await prisma.leaveType.create({
            data: {
                orgId,
                name,
                description,
                annualLimit,
                requiresApproval,
                isPaid,
                carryForward,
                maxCarryForward,
            },
        });
        if (leaveType){
            const Employee_organisation = await prisma.user.findMany({
                where:{
                    orgId:orgId
                },
                select:{
                    id:true
                }
            })
            for (let i = 0; i < Employee_organisation.length; i++) {
                await prisma.leaveBalance.create({
                    data:{
                        userId:Employee_organisation[i].id,
                        leaveTypeId:leaveType.id,
                        remainingDays:leaveType.annualLimit,
                        year:new Date().getFullYear()
                    }
                })
            }
        }
        res.status(200).json(leaveType);
    } catch (error) {
        console.log(error);
        
        res.status(500).json({ error: 'Failed to create leave type' });
    }
};

// Update an existing leave type
const updateLeaveType = async (req, res) => {
    const { id } = req.params;
    const { name, description, annualLimit, requiresApproval, isPaid, carryForward, maxCarryForward } = req.body;
    try {
        console.log(`Updating leave type with ID: ${id}`);
        const existingLeaveType = await prisma.leaveType.findUnique({
            where: { id },
        });

        if (!existingLeaveType) {
            console.log(`Leave type with ID: ${id} not found`);
            return res.status(404).json({ error: 'Leave type not found' });
        }

        const updatedLeaveType = await prisma.leaveType.update({
            where: { id },
            data: {
                name: name !== undefined ? name : existingLeaveType.name,
                description: description !== undefined ? description : existingLeaveType.description,
                annualLimit: annualLimit !== undefined ? annualLimit : existingLeaveType.annualLimit,
                requiresApproval: requiresApproval !== undefined ? requiresApproval : existingLeaveType.requiresApproval,
                isPaid: isPaid !== undefined ? isPaid : existingLeaveType.isPaid,
                carryForward: carryForward !== undefined ? carryForward : existingLeaveType.carryForward,
                maxCarryForward: maxCarryForward !== undefined ? maxCarryForward : existingLeaveType.maxCarryForward,
            },
        });

        if (annualLimit !== undefined && annualLimit !== existingLeaveType.annualLimit) {
            const extendedDays = annualLimit - existingLeaveType.annualLimit;
            await prisma.leaveBalance.updateMany({
                where: {
                    leaveTypeId: existingLeaveType.id,
                    year: new Date().getFullYear()
                },
                data: {
                    remainingDays: {
                        increment: extendedDays
                    }
                }
            });
        }

        console.log(`Leave type with ID: ${id} successfully updated`);
        res.status(200).json(updatedLeaveType);
    } catch (error) {
        console.error(`Failed to update leave type with ID: ${id}`, error);
        res.status(500).json({ error: 'Failed to update leave type' });
    }
};

// Delete a leave type
const deleteLeaveType = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.leaveType.delete({
            where: { id },
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete leave type' });
    }
};

export{
    getLeaveTypes,
    createLeaveType,
    updateLeaveType,
    deleteLeaveType,
    getLeaveTypeById
};