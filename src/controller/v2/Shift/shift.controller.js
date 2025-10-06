import prisma from '../../../db/connectDb.js';
import { body, param, query, validationResult } from 'express-validator';

export const includeShiftTemplateRelations = {
  breakRuleLinks: {
    include: {
      breakRule: true
    }
  },
  attendanceRuleLinks: {
    include: {
      attendanceRule: true
    }
  },
  overtimeRule: true
};

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const formatShiftTemplate = (shift) => {
  if (!shift) return null;
  const {
    breakRuleLinks = [],
    attendanceRuleLinks = [],
    overtimeRule,
    ...rest
  } = shift;

  const breakRules = breakRuleLinks
    .map(({ breakRule, orderIndex = 0 }) => ({
      id: breakRule.id,
      breakType: breakRule.breakType,
      maxDuration: breakRule.maxDuration,
      maxFrequency: breakRule.maxFrequency,
      timeWindow: breakRule.timeWindow,
      mandatory: breakRule.mandatory,
      requiresApproval: breakRule.requiresApproval,
      penaltyPerMinute: toNumber(breakRule.penaltyPerMinute),
      isActive: breakRule.isActive,
      orderIndex
    }))
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  const attendanceRules = attendanceRuleLinks.map(({ attendanceRule }) => ({
    id: attendanceRule.id,
    ruleType: attendanceRule.ruleType,
    threshold: attendanceRule.threshold,
    penalty: attendanceRule.penalty,
    isActive: attendanceRule.isActive
  }));

  const overtimeRuleDetails = overtimeRule
    ? {
        id: overtimeRule.id,
        name: overtimeRule.name,
        description: overtimeRule.description,
        rate: toNumber(overtimeRule.rate),
        applyAfterMinutes: overtimeRule.applyAfterMinutes ?? 0,
        maxDailyMinutes: overtimeRule.maxDailyMinutes ?? null,
        metadata: overtimeRule.metadata,
        isActive: overtimeRule.isActive
      }
    : null;

  return {
    ...rest,
    breakConfiguration: breakRules.length ? breakRules : null,
    attendanceRules: attendanceRules.length ? attendanceRules : null,
    overtimeRules: overtimeRuleDetails,
    breakRules,
    attendanceRuleDetails: attendanceRules,
    overtimeRuleDetails,
    selectedBreakRuleIds: breakRules.map((rule) => rule.id),
    selectedAttendanceRuleIds: attendanceRules.map((rule) => rule.id),
    selectedOvertimeRuleId: overtimeRuleDetails?.id ?? null
  };
};

const loadAndFormatShiftTemplate = async (tx, shiftId) => {
  const template = await tx.shiftTemplate.findUnique({
    where: { id: shiftId },
    include: includeShiftTemplateRelations
  });

  if (!template) {
    return null;
  }

  const formatted = formatShiftTemplate(template);

  await tx.shiftTemplate.update({
    where: { id: shiftId },
    data: {
      breakConfiguration: formatted.breakConfiguration,
      attendanceRules: formatted.attendanceRules,
      overtimeRules: formatted.overtimeRules
    }
  });

  return formatted;
};

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
};

export const getShiftTemplates = [
  param('orgId').isString().withMessage('Organization id is required'),
  query('includeInactive').optional().isBoolean().withMessage('includeInactive must be boolean'),
  async (req, res) => {
    const validationError = handleValidation(req, res);
    if (validationError) return validationError;

    const { orgId } = req.params;
    const { includeInactive } = req.query;

    try {
      const shifts = await prisma.shiftTemplate.findMany({
        where: {
          orgId,
          ...(includeInactive === 'true' || includeInactive === true
            ? {}
            : { isActive: true })
        },
        orderBy: [{ createdAt: 'desc' }],
        include: includeShiftTemplateRelations
      });

      const formatted = shifts.map(formatShiftTemplate);

      res.status(200).json(formatted);
    } catch (error) {
      console.error('Error fetching shift templates', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
];

export const createShiftTemplate = [
  body('orgId').isString().withMessage('Organization id is required'),
  body('name').isString().withMessage('Name is required'),
  body('startTime').isString().withMessage('startTime is required'),
  body('endTime').isString().withMessage('endTime is required'),
  body('totalHours').isNumeric().withMessage('totalHours must be numeric'),
  body('lateThreshold').optional().isInt({ min: 0 }),
  body('breakRuleIds').optional().isArray(),
  body('breakRuleIds.*').optional().isString(),
  body('attendanceRuleIds').optional().isArray(),
  body('attendanceRuleIds.*').optional().isString(),
  body('overtimeRuleId').optional({ nullable: true }).isString(),
  body('isActive').optional().isBoolean(),
  async (req, res) => {
    const validationError = handleValidation(req, res);
    if (validationError) return validationError;

    const {
      orgId,
      name,
      startTime,
      endTime,
      totalHours,
      lateThreshold = 15,
      breakRuleIds = [],
      attendanceRuleIds = [],
      overtimeRuleId,
      isActive = false
    } = req.body;

    try {
      const breakIds = Array.isArray(breakRuleIds) ? breakRuleIds.filter((value) => typeof value === 'string' && value.trim().length > 0) : [];
      const attendanceIds = Array.isArray(attendanceRuleIds) ? attendanceRuleIds.filter((value) => typeof value === 'string' && value.trim().length > 0) : [];

      if (!name?.trim()) {
        return res.status(400).json({ error: 'Shift name is required' });
      }

      const [existingBreakRules, existingAttendanceRules, existingOvertimeRule] = await Promise.all([
        breakIds.length
          ? prisma.organizationBreakRules.findMany({ where: { id: { in: breakIds }, orgId } })
          : Promise.resolve([]),
        attendanceIds.length
          ? prisma.organizationAttendanceRules.findMany({ where: { id: { in: attendanceIds }, orgId } })
          : Promise.resolve([]),
        overtimeRuleId
          ? prisma.organizationOvertimeRule.findFirst({ where: { id: overtimeRuleId, orgId } })
          : Promise.resolve(null)
      ]);

      if (existingBreakRules.length !== breakIds.length) {
        return res.status(400).json({ error: 'One or more break rules are invalid for this organization' });
      }

      if (existingAttendanceRules.length !== attendanceIds.length) {
        return res.status(400).json({ error: 'One or more attendance rules are invalid for this organization' });
      }

      if (overtimeRuleId && !existingOvertimeRule) {
        return res.status(400).json({ error: 'Invalid overtime rule for this organization' });
      }

      const createdTemplate = await prisma.$transaction(async (tx) => {
        const template = await tx.shiftTemplate.create({
          data: {
            orgId,
            name: name.trim(),
            startTime,
            endTime,
            totalHours,
            lateThreshold,
            isActive,
            overtimeRuleId: existingOvertimeRule ? existingOvertimeRule.id : null
          }
        });

        if (breakIds.length) {
          await tx.shiftBreakRule.createMany({
            data: breakIds.map((breakRuleId, index) => ({
              shiftTemplateId: template.id,
              breakRuleId,
              orderIndex: index
            }))
          });
        }

        if (attendanceIds.length) {
          await tx.shiftAttendanceRule.createMany({
            data: attendanceIds.map((attendanceRuleId) => ({
              shiftTemplateId: template.id,
              attendanceRuleId
            }))
          });
        }

        return loadAndFormatShiftTemplate(tx, template.id);
      });

      res.status(201).json(createdTemplate);
    } catch (error) {
      console.error('Error creating shift template', error);
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Shift name already exists for this organization' });
      }
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
];

export const updateShiftTemplate = [
  param('id').isString().withMessage('Shift template id is required'),
  body('name').optional().isString(),
  body('startTime').optional().isString(),
  body('endTime').optional().isString(),
  body('totalHours').optional().isNumeric(),
  body('lateThreshold').optional().isInt({ min: 0 }),
  body('breakRuleIds').optional().isArray(),
  body('breakRuleIds.*').optional().isString(),
  body('attendanceRuleIds').optional().isArray(),
  body('attendanceRuleIds.*').optional().isString(),
  body('overtimeRuleId').optional({ nullable: true }).isString(),
  body('orgId').optional().isString(),
  body('isActive').optional().isBoolean(),
  async (req, res) => {
    const validationError = handleValidation(req, res);
    if (validationError) return validationError;

    const { id } = req.params;
    const {
      name,
      startTime,
      endTime,
      totalHours,
      lateThreshold,
      isActive,
      breakRuleIds,
      attendanceRuleIds,
      overtimeRuleId,
      orgId
    } = req.body;

    try {
      const existingTemplate = await prisma.shiftTemplate.findUnique({
        where: { id },
        include: includeShiftTemplateRelations
      });

      if (!existingTemplate) {
        return res.status(404).json({ error: 'Shift template not found' });
      }

      if (orgId && orgId !== existingTemplate.orgId) {
        return res.status(400).json({ error: 'Organization does not match the shift template' });
      }

      const targetOrgId = existingTemplate.orgId;

      const breakIds = Array.isArray(breakRuleIds)
        ? breakRuleIds.filter((value) => typeof value === 'string' && value.trim().length > 0)
        : null;
      const attendanceIds = Array.isArray(attendanceRuleIds)
        ? attendanceRuleIds.filter((value) => typeof value === 'string' && value.trim().length > 0)
        : null;

      const [validBreakRules, validAttendanceRules, validOvertimeRule] = await Promise.all([
        breakIds !== null && breakIds.length
          ? prisma.organizationBreakRules.findMany({ where: { id: { in: breakIds }, orgId: targetOrgId } })
          : Promise.resolve([]),
        attendanceIds !== null && attendanceIds.length
          ? prisma.organizationAttendanceRules.findMany({ where: { id: { in: attendanceIds }, orgId: targetOrgId } })
          : Promise.resolve([]),
        overtimeRuleId !== undefined && overtimeRuleId
          ? prisma.organizationOvertimeRule.findFirst({ where: { id: overtimeRuleId, orgId: targetOrgId } })
          : Promise.resolve(null)
      ]);

      if (breakIds !== null && validBreakRules.length !== breakIds.length) {
        return res.status(400).json({ error: 'One or more break rules are invalid for this organization' });
      }

      if (attendanceIds !== null && validAttendanceRules.length !== attendanceIds.length) {
        return res.status(400).json({ error: 'One or more attendance rules are invalid for this organization' });
      }

      if (overtimeRuleId !== undefined && overtimeRuleId && !validOvertimeRule) {
        return res.status(400).json({ error: 'Invalid overtime rule for this organization' });
      }

      const updatedTemplate = await prisma.$transaction(async (tx) => {
        const dataToUpdate = {};

        if (name !== undefined) {
          dataToUpdate.name = name.trim();
        }
        if (startTime !== undefined) {
          dataToUpdate.startTime = startTime;
        }
        if (endTime !== undefined) {
          dataToUpdate.endTime = endTime;
        }
        if (totalHours !== undefined) {
          dataToUpdate.totalHours = totalHours;
        }
        if (lateThreshold !== undefined) {
          dataToUpdate.lateThreshold = lateThreshold;
        }
        if (isActive !== undefined) {
          dataToUpdate.isActive = isActive;
        }
        if (overtimeRuleId !== undefined) {
          dataToUpdate.overtimeRuleId = overtimeRuleId ? overtimeRuleId : null;
        }

        if (Object.keys(dataToUpdate).length) {
          await tx.shiftTemplate.update({
            where: { id },
            data: dataToUpdate
          });
        }

        if (breakIds !== null) {
          if (breakIds.length === 0) {
            await tx.shiftBreakRule.deleteMany({ where: { shiftTemplateId: id } });
          } else {
            await tx.shiftBreakRule.deleteMany({
              where: {
                shiftTemplateId: id,
                breakRuleId: { notIn: breakIds }
              }
            });

            const existingLinks = await tx.shiftBreakRule.findMany({
              where: { shiftTemplateId: id }
            });
            const existingIds = new Set(existingLinks.map((link) => link.breakRuleId));
            const toCreate = breakIds
              .filter((breakRuleId) => !existingIds.has(breakRuleId))
              .map((breakRuleId, index) => ({
                shiftTemplateId: id,
                breakRuleId,
                orderIndex: index
              }));

            if (toCreate.length) {
              await tx.shiftBreakRule.createMany({ data: toCreate });
            }

            await Promise.all(
              breakIds.map((breakRuleId, index) =>
                tx.shiftBreakRule.update({
                  where: {
                    shiftTemplateId_breakRuleId: {
                      shiftTemplateId: id,
                      breakRuleId
                    }
                  },
                  data: { orderIndex: index }
                })
              )
            );
          }
        }

        if (attendanceIds !== null) {
          if (attendanceIds.length === 0) {
            await tx.shiftAttendanceRule.deleteMany({ where: { shiftTemplateId: id } });
          } else {
            await tx.shiftAttendanceRule.deleteMany({
              where: {
                shiftTemplateId: id,
                attendanceRuleId: { notIn: attendanceIds }
              }
            });

            const existingAttendanceLinks = await tx.shiftAttendanceRule.findMany({
              where: { shiftTemplateId: id }
            });
            const attendanceExistingIds = new Set(existingAttendanceLinks.map((link) => link.attendanceRuleId));
            const attendanceToCreate = attendanceIds
              .filter((attendanceRuleId) => !attendanceExistingIds.has(attendanceRuleId))
              .map((attendanceRuleId) => ({
                shiftTemplateId: id,
                attendanceRuleId
              }));

            if (attendanceToCreate.length) {
              await tx.shiftAttendanceRule.createMany({ data: attendanceToCreate });
            }
          }
        }

        return loadAndFormatShiftTemplate(tx, id);
      });

      res.status(200).json(updatedTemplate);
    } catch (error) {
      console.error('Error updating shift template', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Shift template not found' });
      }
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Shift name already exists for this organization' });
      }
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
];

export const deleteShiftTemplate = [
  param('id').isString().withMessage('Shift template id is required'),
  async (req, res) => {
    const validationError = handleValidation(req, res);
    if (validationError) return validationError;

    const { id } = req.params;

    try {
      await prisma.shiftTemplate.delete({ where: { id } });
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting shift template', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Shift template not found' });
      }
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
];

export const getEmployeeShifts = [
  param('userId').isString().withMessage('User id is required'),
  query('includeHistory').optional().isBoolean(),
  async (req, res) => {
    const validationError = handleValidation(req, res);
    if (validationError) return validationError;

    const { userId } = req.params;
    const { includeHistory } = req.query;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, orgId: true }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const [currentShift] = await prisma.employeeShift.findMany({
        where: {
          userId,
          status: 'ACTIVE'
        },
        include: { shiftTemplate: { include: includeShiftTemplateRelations } },
        orderBy: [{ effectiveDate: 'desc' }],
        take: 1
      });

      const formattedCurrent = currentShift
        ? {
            ...currentShift,
            shiftTemplate: formatShiftTemplate(currentShift.shiftTemplate)
          }
        : null;

      if (includeHistory === 'true' || includeHistory === true) {
        const history = await prisma.employeeShift.findMany({
          where: { userId },
          include: { shiftTemplate: { include: includeShiftTemplateRelations } },
          orderBy: [{ effectiveDate: 'desc' }]
        });

        const formattedHistory = history.map((item) => ({
          ...item,
          shiftTemplate: formatShiftTemplate(item.shiftTemplate)
        }));

        return res.status(200).json({ current: formattedCurrent, history: formattedHistory });
      }

      res.status(200).json({ current: formattedCurrent });
    } catch (error) {
      console.error('Error fetching employee shifts', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
];

export const assignShiftToEmployee = [
  param('userId').isString().withMessage('User id is required'),
  body('shiftTemplateId').isString().withMessage('shiftTemplateId is required'),
  body('effectiveDate').optional().isISO8601().withMessage('effectiveDate must be a valid date'),
  body('endDate').optional().isISO8601().withMessage('endDate must be a valid date'),
  body('overrides').optional().isObject(),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'TEMPORARY']),
  async (req, res) => {
    const validationError = handleValidation(req, res);
    if (validationError) return validationError;

    const { userId } = req.params;
    const {
      shiftTemplateId,
      effectiveDate,
      endDate,
      overrides,
      status = 'ACTIVE'
    } = req.body;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, orgId: true }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const shiftTemplate = await prisma.shiftTemplate.findUnique({
        where: { id: shiftTemplateId }
      });

      if (!shiftTemplate || shiftTemplate.orgId !== user.orgId) {
        return res.status(400).json({ error: 'Invalid shift template for this organization' });
      }

      const startDate = effectiveDate ? new Date(effectiveDate) : new Date();
      const finalEndDate = endDate ? new Date(endDate) : null;

      const result = await prisma.$transaction(async (tx) => {
        if (status === 'ACTIVE') {
          await tx.employeeShift.updateMany({
            where: {
              userId,
              status: 'ACTIVE'
            },
            data: {
              status: 'INACTIVE',
              endDate: startDate
            }
          });
        }

        const createdShift = await tx.employeeShift.create({
          data: {
            userId,
            shiftTemplateId,
            effectiveDate: startDate,
            endDate: finalEndDate,
            status,
            overrides: overrides || null
          },
          include: {
            shiftTemplate: { include: includeShiftTemplateRelations }
          }
        });

        return {
          ...createdShift,
          shiftTemplate: formatShiftTemplate(createdShift.shiftTemplate)
        };
      });

      res.status(201).json(result);
    } catch (error) {
      console.error('Error assigning shift', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
];

export const updateEmployeeShift = [
  param('assignmentId').isString().withMessage('assignmentId is required'),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'TEMPORARY']),
  body('effectiveDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('overrides').optional().isObject(),
  async (req, res) => {
    const validationError = handleValidation(req, res);
    if (validationError) return validationError;

    const { assignmentId } = req.params;
    const { status, effectiveDate, endDate, overrides } = req.body;

    try {
      const existing = await prisma.employeeShift.findUnique({
        where: { id: assignmentId },
        include: { user: true }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Shift assignment not found' });
      }

      const data = {};
      if (status) {
        data.status = status;
      }
      if (effectiveDate) {
        data.effectiveDate = new Date(effectiveDate);
      }
      if (endDate !== undefined) {
        data.endDate = endDate ? new Date(endDate) : null;
      }
      if (overrides !== undefined) {
        data.overrides = overrides;
      }

      const result = await prisma.$transaction(async (tx) => {
        if (status === 'ACTIVE') {
          await tx.employeeShift.updateMany({
            where: {
              userId: existing.userId,
              status: 'ACTIVE',
              NOT: { id: assignmentId }
            },
            data: {
              status: 'INACTIVE',
              endDate: data.effectiveDate || existing.effectiveDate
            }
          });
        }

        const updated = await tx.employeeShift.update({
          where: { id: assignmentId },
          data,
          include: { shiftTemplate: { include: includeShiftTemplateRelations } }
        });

        return {
          ...updated,
          shiftTemplate: formatShiftTemplate(updated.shiftTemplate)
        };
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('Error updating shift assignment', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
];
