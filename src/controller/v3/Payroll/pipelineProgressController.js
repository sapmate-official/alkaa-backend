/**
 * Pipeline Progress Controller
 * 
 * Handles saving and retrieving pipeline UI state per month.
 * This allows users to resume pipeline workflow from where they left off.
 * 
 * Note: This ONLY stores UI state (current step, completion flags).
 * All payroll data is managed by the existing V3 Payroll APIs.
 */

import prisma from "../../../db/connectDb.js";
import { PayrollPermissions } from "./validators/payrollValidators.js";

/**
 * Get pipeline progress for a specific month/year
 * GET /api/v3/payroll/pipeline/progress/:month/:year
 */
export const getPipelineProgress = async (req, res) => {
  try {
    const { month, year } = req.params;
    const organizationId = req.user?.orgId || req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required"
      });
    }

    // Validate month and year
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid month. Must be between 1 and 12"
      });
    }

    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return res.status(400).json({
        success: false,
        message: "Invalid year"
      });
    }

    // Check if user has permission to view payroll
    const canView = await PayrollPermissions.canViewPayrollRecords(req.user.id, organizationId);
    if (!canView) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view payroll pipeline"
      });
    }

    // Find existing progress
    const progress = await prisma.pipelineProgress.findUnique({
      where: {
        organizationId_month_year: {
          organizationId,
          month: monthNum,
          year: yearNum
        }
      }
    });

    if (!progress) {
      return res.status(200).json({
        success: true,
        data: null,
        message: "No saved progress found for this month"
      });
    }

    // Update last accessed time
    await prisma.pipelineProgress.update({
      where: { id: progress.id },
      data: { lastAccessedAt: new Date() }
    });

    return res.status(200).json({
      success: true,
      data: {
        currentStep: progress.currentStep,
        stepData: progress.stepData,
        lastAccessedAt: progress.lastAccessedAt,
        createdAt: progress.createdAt
      }
    });

  } catch (error) {
    console.error("Error fetching pipeline progress:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pipeline progress",
      error: error.message
    });
  }
};

/**
 * Save pipeline progress for a specific month/year
 * POST /api/v3/payroll/pipeline/progress
 * Body: { month, year, currentStep, stepData }
 */
export const savePipelineProgress = async (req, res) => {
  try {
    const { month, year, currentStep, stepData } = req.body;
    const organizationId = req.user?.orgId || req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required"
      });
    }

    // Validate inputs
    if (typeof month !== 'number' || month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid month. Must be between 1 and 12"
      });
    }

    if (typeof year !== 'number' || year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        message: "Invalid year"
      });
    }

    if (typeof currentStep !== 'number' || currentStep < 0 || currentStep > 5) {
      return res.status(400).json({
        success: false,
        message: "Invalid current step. Must be between 0 and 5"
      });
    }

    // Check if user has permission to manage payroll
    const canManage = await PayrollPermissions.canEditPayrollRecords(req.user.id, organizationId);
    if (!canManage) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to manage payroll pipeline"
      });
    }

    // Upsert progress record
    const progress = await prisma.pipelineProgress.upsert({
      where: {
        organizationId_month_year: {
          organizationId,
          month,
          year
        }
      },
      update: {
        currentStep,
        stepData: stepData || {},
        lastAccessedAt: new Date()
      },
      create: {
        organizationId,
        month,
        year,
        currentStep,
        stepData: stepData || {},
        lastAccessedAt: new Date()
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        id: progress.id,
        currentStep: progress.currentStep,
        stepData: progress.stepData,
        lastAccessedAt: progress.lastAccessedAt
      },
      message: "Pipeline progress saved successfully"
    });

  } catch (error) {
    console.error("Error saving pipeline progress:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save pipeline progress",
      error: error.message
    });
  }
};

/**
 * Clear pipeline progress for a specific month/year
 * DELETE /api/v3/payroll/pipeline/progress/:month/:year
 */
export const clearPipelineProgress = async (req, res) => {
  try {
    const { month, year } = req.params;
    const organizationId = req.user?.orgId || req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required"
      });
    }

    // Validate month and year
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid month"
      });
    }

    if (isNaN(yearNum)) {
      return res.status(400).json({
        success: false,
        message: "Invalid year"
      });
    }

    // Check if user has permission to manage payroll
    const canManage = await PayrollPermissions.canEditPayrollRecords(req.user.id, organizationId);
    if (!canManage) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to manage payroll pipeline"
      });
    }

    // Delete progress record
    const deleted = await prisma.pipelineProgress.deleteMany({
      where: {
        organizationId,
        month: monthNum,
        year: yearNum
      }
    });

    if (deleted.count === 0) {
      return res.status(404).json({
        success: false,
        message: "No progress found to delete"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pipeline progress cleared successfully"
    });

  } catch (error) {
    console.error("Error clearing pipeline progress:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear pipeline progress",
      error: error.message
    });
  }
};
