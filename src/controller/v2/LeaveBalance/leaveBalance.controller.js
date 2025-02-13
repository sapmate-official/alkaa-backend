import prisma from "../../../db/connectDb.js";

export const getLeaveBalances = async (req, res) => {
    try {
        const leaveBalances = await prisma.leaveBalance.findMany();
        res.status(200).json(leaveBalances);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getLeaveBalanceById = async (req, res) => {
    const { id } = req.params;
    try {
        const leaveBalance = await prisma.leaveBalance.findUnique({
            where: { id },
        });
        if (!leaveBalance) {
            return res.status(404).json({ error: "Leave balance not found" });
        }
        res.status(200).json(leaveBalance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const createLeaveBalance = async (req, res) => {
    const { userId, leaveTypeId, usedDays, remainingDays, year } = req.body;
    try {
        const newLeaveBalance = await prisma.leaveBalance.create({
            data: {
                userId,
                leaveTypeId,
                usedDays,
                remainingDays,
                year,
                carryForward
            },
        });
        res.status(201).json(newLeaveBalance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateLeaveBalance = async (req, res) => {
    const { id } = req.params;
    const { usedDays, remainingDays } = req.body;
    try {
        const updatedLeaveBalance = await prisma.leaveBalance.update({
            where: { id },
            data: {
                usedDays,
                remainingDays,
                carryForward
            },
        });
        res.status(200).json(updatedLeaveBalance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteLeaveBalance = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.leaveBalance.delete({
            where: { id },
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
export const getLeaveBalanceByleaveTypeIdAndUserId = async (req, res) => {
    const { leavetypeId, userId } = req.params;
    try {
        const leaveBalance = await prisma.leaveBalance.findFirst({
            where: { userId: userId, leaveTypeId: leavetypeId },
        });
        if (!leaveBalance) {
            return res.status(404).json({ error: "Leave balance not found" });
        }
        res.status(200).json(leaveBalance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
export const getLeaveBalanceByUserId = async (req, res) => {
    const { userId } = req.params;
    try {
        const leaveBalance = await prisma.leaveBalance.findMany({
            where: { userId },
            include:{
                leaveType:true
            }
        });
        if (!leaveBalance) {
            return res.status(404).json({ error: "Leave balance not found" });
        }
        res.status(200).json(leaveBalance);
    } catch (error) {
        console.error('Error getting leave balance:', error);
        res.status(500).json({ error: error.message });
    }
}