import prisma from '../../../db/connectDb.js';
import { PayrollPermissions } from './validators/payrollValidators.js';

const formatDisputeResponse = (dispute) => {
  if (!dispute) {
    return null;
  }

  const { salaryRecord, ...rest } = dispute;

  return {
    ...rest,
    salaryRecord: salaryRecord
      ? {
          id: salaryRecord.id,
          month: salaryRecord.month,
          year: salaryRecord.year,
          netSalary: salaryRecord.netSalary,
          status: salaryRecord.status,
          processedAt: salaryRecord.processedAt,
        }
      : null,
  };
};

export const getEmployeeDisputes = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user not found on request.',
      });
    }

    const disputes = await prisma.salaryDispute.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        salaryRecord: {
          select: {
            id: true,
            month: true,
            year: true,
            netSalary: true,
            status: true,
            processedAt: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: disputes.map(formatDisputeResponse),
      count: disputes.length,
    });
  } catch (error) {
    console.error('[PAYROLL][EMPLOYEE] Failed to fetch salary disputes:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load salary disputes.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const submitEmployeeDispute = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { salaryRecordId, reason, description } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user not found on request.',
      });
    }

    if (!salaryRecordId || !reason?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Salary record ID and reason are required to submit a dispute.',
      });
    }

    const salaryRecord = await prisma.salaryRecord.findUnique({
      where: { id: salaryRecordId },
      select: {
        id: true,
        userId: true,
        month: true,
        year: true,
        netSalary: true,
        status: true,
        processedAt: true,
      },
    });

    if (!salaryRecord) {
      return res.status(404).json({
        success: false,
        message: 'Salary record not found.',
      });
    }

    let canFileDispute = salaryRecord.userId === userId;

    if (!canFileDispute) {
      canFileDispute = await PayrollPermissions.canViewPayslip(userId, salaryRecord.userId);
    }

    if (!canFileDispute) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to dispute this salary record.",
      });
    }

    const existingOpenDispute = await prisma.salaryDispute.findFirst({
      where: {
        userId,
        salaryRecordId,
        status: {
          in: ['PENDING', 'UNDER_REVIEW'],
        },
      },
    });

    if (existingOpenDispute) {
      return res.status(409).json({
        success: false,
        message: 'An active dispute already exists for this salary record.',
      });
    }

    const dispute = await prisma.salaryDispute.create({
      data: {
        salaryRecordId,
        userId,
        reason: reason.trim(),
        description: description?.trim() || null,
        status: 'PENDING',
      },
      include: {
        salaryRecord: {
          select: {
            id: true,
            month: true,
            year: true,
            netSalary: true,
            status: true,
            processedAt: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Salary dispute submitted successfully.',
      data: formatDisputeResponse(dispute),
    });
  } catch (error) {
    console.error('[PAYROLL][EMPLOYEE] Failed to submit salary dispute:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit salary dispute.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
