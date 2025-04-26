import prisma from "../../../db/connectDb.js";
import { validationResult } from "express-validator";



export const getLeaveRequests = async (req, res) => {
    try {
        const leaveRequests = await prisma.leaveRequest.findMany();
        res.status(200).json(leaveRequests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getLeaveRequestById = async (req, res) => {
    const { id } = req.params;
    try {
        const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
        if (!leaveRequest) {
            return res.status(404).json({ error: "Leave request not found" });
        }
        res.status(200).json(leaveRequest);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const createLeaveRequest = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { userId, leaveTypeId, startDate, endDate, reason } = req.body;
    try {
        // Calculate requested days
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Handle same-day leave request
        let requestedDays;
        
        // If it's the same day (comparing date parts only, not time)
        if (start.toDateString() === end.toDateString()) {
            requestedDays = 1;
        } else {
            // For multi-day requests, count inclusive (including both start and end days)
            const diffTime = Math.abs(end.getTime() - start.getTime());
            requestedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }
        
        // Get user's leave balance for this leave type
        const userLeaveBalance = await prisma.leaveBalance.findFirst({
            where: {
                userId: userId,
                leaveTypeId: leaveTypeId
            }
        });

        if (!userLeaveBalance) {
            return res.status(400).json({ error: "Leave balance not found for this user and leave type" });
        }

        // Check if enough balance is available
        if (userLeaveBalance.remainingDays < requestedDays) {
            return res.status(400).json({ 
                error: `Insufficient leave balance. Available: ${userLeaveBalance.remainingDays} days, Requested: ${requestedDays} days`
            });
        }

        const leaveRequest = await prisma.leaveRequest.create({
            data: {
                userId,
                leaveTypeId,
                startDate: start,
                endDate: end,
                reason,
                numberOfDays: requestedDays,
            },
        });
        if(leaveRequest) {
            // fetch manager of this user
            // send notification to manager 
            
        }
        res.status(201).json(leaveRequest);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
};

export const updateLeaveRequest = async (req, res) => {
    const { id } = req.params;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { startDate, endDate, reason, status, approvedBy, approvedAt, rejectedReason } = req.body;
    try {
        const leaveRequest = await prisma.leaveRequest.update({
            where: { id },
            data: {
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                reason: reason !== undefined ? reason : undefined,
                status: status !== undefined ? status : undefined,
                approvedBy: approvedBy !== undefined ? approvedBy : undefined,
                approvedAt: approvedAt ? new Date(approvedAt) : undefined,
                rejectedReason: rejectedReason !== undefined ? rejectedReason : undefined,
            },
        });
        res.status(200).json(leaveRequest);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteLeaveRequest = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.leaveRequest.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
export const getLeaveRequestByUserId = async (req, res) => {
    const { id } = req.params;
    try {
        const leaveRequest = await prisma.leaveRequest.findMany({
            where: { userId: id },
            include: {
                leaveType: true,
            },
        });
        res.status(200).json(leaveRequest);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
export const getLeaveRequestByManagerId = async (req, res) => {
    const { id } = req.params;
    try {
        if(!id){
            return res.status(400).json({ error: "Manager id is required" });
        }
        const leaveRequests = await prisma.leaveRequest.findMany({
            where: {
                user: {
                    managerId: id
                }
            },
            include: {
                user: true,
                leaveType: true
            }
        });
        res.status(200).json(leaveRequests);
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: error.message });
    }
};
export const approveLeaveRequest = async (req, res) => {
    const { id } = req.params;
    const { approvedBy } = req.body;

    try {
        if (!id || !approvedBy) {
            return res.status(400).json({ error: "Leave request ID and approver ID are required" });
        }

        const existingRequest = await prisma.leaveRequest.findUnique({
            where: { id },
            include: {
                user: true,
                leaveType: true 
            }
        });

        if (!existingRequest) {
            return res.status(404).json({ error: "Leave request not found" });
        }

        if (existingRequest.status !== 'PENDING') {
            return res.status(400).json({ 
                error: `Leave request cannot be approved because it is ${existingRequest.status.toLowerCase()}`
            });
        }

        // Get current leave balance
        const leaveBalance = await prisma.leaveBalance.findFirst({
            where: {
                userId: existingRequest.userId,
                leaveTypeId: existingRequest.leaveTypeId,
                year: new Date().getFullYear()
            }
        });

        if (!leaveBalance) {
            return res.status(400).json({ error: "Leave balance not found" });
        }

        // Update leave request and balance in a transaction
        const [updatedRequest, updatedBalance] = await prisma.$transaction([
            prisma.leaveRequest.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    approvedBy,
                    approvedAt: new Date(),
                },
                include: {
                    user: true,
                    leaveType: true
                }
            }),
            prisma.leaveBalance.update({
                where: { id: leaveBalance.id },
                data: {
                    usedDays: leaveBalance.usedDays + existingRequest.numberOfDays,
                    remainingDays: leaveBalance.remainingDays - existingRequest.numberOfDays
                }
            })
        ]);

        res.status(200).json({ 
            leaveRequest: updatedRequest,
            leaveBalance: updatedBalance
        });

    } catch (error) {
        console.error('Error in approveLeaveRequest:', error);
        res.status(500).json({ error: "Failed to approve leave request" });
    }
}
export const rejectLeaveRequest = async (req, res) => {
    const { id } = req.params;
    const { approvedBy, rejectedReason } = req.body;

    try {
        if (!id || !approvedBy || !rejectedReason) {
            return res.status(400).json({ error: "Leave request ID, approver ID, and rejection reason are required" });
        }

        const existingRequest = await prisma.leaveRequest.findUnique({
            where: { id },
            include: {
                user: true,
                leaveType: true
            }
        });

        if (!existingRequest) {
            return res.status(404).json({ error: "Leave request not found" });
        }

        if (existingRequest.status !== 'PENDING') {
            return res.status(400).json({ 
                error: `Leave request cannot be rejected because it is ${existingRequest.status.toLowerCase()}`
            });
        }

        const updatedRequest = await prisma.leaveRequest.update({
            where: { id },
            data: {
                status: 'REJECTED',
                approvedBy,
                approvedAt: new Date(),
                rejectedReason
            },
            include: {
                user: true,
                leaveType: true
            }
        });

        res.status(200).json(updatedRequest);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to reject leave request" });
    }
}

export const cancelLeaveRequest = async (req, res) => {
    const { id } = req.params;
    try {
        const leaveRequest = await prisma.leaveRequest.update({
            where: { id },
            data: {
                status: 'CANCELLED',
            },
        });
        res.status(200).json(leaveRequest);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}