import prisma from "../../../db/connectDb.js";
import { validationResult } from "express-validator";
import { sendLeaveRequestEmail, sendLeaveStatusUpdateEmail } from "../../../util/sendEmail.js";



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
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { userId, leaveTypeId, startDate, endDate, reason } = req.body;
    try {
        // Input validation
        if (!userId || !leaveTypeId || !startDate || !endDate || !reason) {
            console.log('Missing required fields:', { userId, leaveTypeId, startDate, endDate, reason });
            return res.status(400).json({ error: "All fields are required: userId, leaveTypeId, startDate, endDate, reason" });
        }

        // Date validation
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            console.log('Invalid date format:', { startDate, endDate });
            return res.status(400).json({ error: "Invalid date format" });
        }

        if (start > end) {
            console.log('Start date after end date:', { start, end });
            return res.status(400).json({ error: "Start date cannot be after end date" });
        }

        // Check if dates are in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (start < today) {
            console.log('Start date in the past:', { start, today });
            return res.status(400).json({ error: "Cannot create leave request for past dates" });
        }

        // Verify user exists
        const userExists = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!userExists) {
            console.log('User not found:', userId);
            return res.status(404).json({ error: "User not found" });
        }

        // Verify leave type exists
        const leaveTypeExists = await prisma.leaveType.findUnique({
            where: { id: leaveTypeId }
        });

        if (!leaveTypeExists) {
            console.log('Leave type not found:', leaveTypeId);
            return res.status(404).json({ error: "Leave type not found" });
        }

        // Calculate requested days
        let requestedDays;

        if (start.toDateString() === end.toDateString()) {
            requestedDays = 1;
        } else {
            const diffTime = Math.abs(end.getTime() - start.getTime());
            requestedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }

        if (requestedDays <= 0) {
            console.log('Invalid number of days calculated:', requestedDays);
            return res.status(400).json({ error: "Invalid number of days calculated" });
        }

        // Get user's leave balance for this leave type
        const userLeaveBalance = await prisma.leaveBalance.findFirst({
            where: {
                userId: userId,
                leaveTypeId: leaveTypeId,
                year: new Date().getFullYear()
            }
        });

        if (!userLeaveBalance) {
            console.log('Leave balance not found for user:', userId, 'leaveType:', leaveTypeId);
            return res.status(400).json({ error: "Leave balance not found for this user and leave type" });
        }

        // Check if enough balance is available
        if (userLeaveBalance.remainingDays < requestedDays) {
            console.log('Insufficient leave balance:', { available: userLeaveBalance.remainingDays, requested: requestedDays });
            return res.status(400).json({
                error: `Insufficient leave balance. Available: ${userLeaveBalance.remainingDays} days, Requested: ${requestedDays} days`
            });
        }

        // Check for overlapping leave requests
        const overlappingRequests = await prisma.leaveRequest.findMany({
            where: {
                userId: userId,
                status: {
                    in: ['PENDING', 'APPROVED']
                },
                OR: [
                    {
                        startDate: { lte: end },
                        endDate: { gte: start }
                    }
                ]
            }
        });

        if (overlappingRequests.length > 0) {
            console.log('Overlapping leave requests found:', overlappingRequests);
            return res.status(400).json({ error: "Leave request overlaps with existing pending or approved requests" });
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
            include: {
                user: true,
                leaveType: true  // Make sure this is included
            }
        });

        if (leaveRequest) {
            // Fetch manager of this user
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    managerId: true,
                    email: true,
                    orgId: true,
                    firstName: true,
                    lastName: true,
                }
            });

            if (!user || !user.managerId) {
                console.log('User or manager not found:', { userId, user });
                return res.status(404).json({ error: "User or manager not found" });
            }

            const manager = await prisma.user.findUnique({
                where: { id: user.managerId },
                select: {
                    email: true,
                    firstName: true,
                    lastName: true,
                    orgId: true,
                }
            });

            if (!manager) {
                console.log('Manager not found:', user.managerId);
                return res.status(404).json({ error: "Manager not found" });
            }

            const organization = await prisma.organization.findUnique({
                where: { id: user.orgId },
                select: {
                    name: true,
                    Organization_admin: {
                        select: {
                            admin_user: {
                                select: {
                                    email: true,
                                }
                            }
                        }
                    }
                }
            });

            if (!organization) {
                console.log('Organization not found:', user.orgId);
                return res.status(404).json({ error: "Organization not found" });
            }
            const employeeName = `${user.firstName} ${user.lastName}`;
            console.log(organization);
            
            try {
                await sendLeaveRequestEmail(
                    manager.email,
                    organization.Organization_admin[0]?.admin_user?.email,
                    employeeName,
                    user.email,
                    {
                        leaveType: leaveRequest.leaveType.name,
                        startDate: leaveRequest.startDate,
                        endDate: leaveRequest.endDate,
                        duration: leaveRequest.numberOfDays,
                        reason: leaveRequest.reason
                    },
                    organization.name
                );
            } catch (emailError) {
                console.error('Error sending email:', emailError);
                // Don't fail the request if email fails
            }
        }

        res.status(201).json(leaveRequest);
    } catch (error) {
        console.error('Error in createLeaveRequest:', error);
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
        if (!id) {
            return res.status(400).json({ error: "Manager id is required" });

        }

        // Check if user is org_admin
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                roles: {
                    select: {
                        role: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        let leaveRequests;
        console.log(user.roles);

        if (user?.roles[0]?.role?.name !== 'Org_Admin') {
            leaveRequests = await prisma.leaveRequest.findMany({
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
        } else {
            leaveRequests = await prisma.leaveRequest.findMany({
                where: {
                    user: {
                        orgId: user.orgId
                    }
                },
                include: {
                    user: true,
                    leaveType: true
                }
            });
        }
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
        const name = `${existingRequest.user.firstName} ${existingRequest.user.lastName}`;
        const org_name = await prisma.user.findUnique({
            where:{
                id:existingRequest.user.id
            },
            select:{
                organization:{
                    select:{
                        name:true
                    }
                }
            }
        })
        await sendLeaveStatusUpdateEmail(
            existingRequest.user.email,
            name,
            {
                leaveType: updatedRequest.leaveType.name,
                startDate: updatedRequest.startDate,
                endDate: updatedRequest.endDate,
                duration: updatedRequest.numberOfDays
            },
            updatedRequest.status,
            updatedRequest.rejectedReason,
            org_name.organization.name,
        )

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
        const name = `${existingRequest.user.firstName} ${existingRequest.user.lastName}`;
        const org_name = await prisma.user.findUnique({
            where: {
                id: existingRequest.user.id
            },
            select: {
                organization: {
                    select: {
                        name: true
                    }
                }
            }
        })
         await sendLeaveStatusUpdateEmail(
            existingRequest.user.email,
            name,
            {
                leaveType: updatedRequest.leaveType.name,
                startDate: updatedRequest.startDate,
                endDate: updatedRequest.endDate,
                duration: updatedRequest.numberOfDays
            },
            updatedRequest.status,
            updatedRequest.rejectedReason,
            org_name.organization.name,
        )

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


    };
}