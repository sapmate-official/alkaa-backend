import prisma from '../../../db/connectDb.js';
import { body, param, validationResult } from 'express-validator';

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
};

const mapBreakRule = (rule) => ({
  id: rule.id,
  breakType: rule.breakType,
  maxDuration: rule.maxDuration,
  maxFrequency: rule.maxFrequency,
  timeWindow: rule.timeWindow,
  mandatory: rule.mandatory,
  requiresApproval: rule.requiresApproval,
  penaltyPerMinute: toNumber(rule.penaltyPerMinute),
  isActive: rule.isActive,
  createdAt: rule.createdAt,
  updatedAt: rule.updatedAt
});

const mapAttendanceRule = (rule) => ({
  id: rule.id,
  ruleType: rule.ruleType,
  threshold: rule.threshold,
  penalty: rule.penalty,
  isActive: rule.isActive,
  createdAt: rule.createdAt,
  updatedAt: rule.updatedAt
});

const mapOvertimeRule = (rule) => ({
  id: rule.id,
  name: rule.name,
  description: rule.description,
  rate: toNumber(rule.rate),
  applyAfterMinutes: rule.applyAfterMinutes ?? 0,
  maxDailyMinutes: rule.maxDailyMinutes ?? null,
  metadata: rule.metadata,
  isActive: rule.isActive,
  createdAt: rule.createdAt,
  updatedAt: rule.updatedAt
});

export const getOrganizationShiftRules = [
  param('orgId').isString().withMessage('Organization id is required'),
  async (req, res) => {
    const validationError = handleValidation(req, res);
    if (validationError) return validationError;

    const { orgId } = req.params;

    try {
      const [breakRules, attendanceRules, overtimeRules] = await Promise.all([
        prisma.organizationBreakRules.findMany({
          where: { orgId },
          orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
        }),
        prisma.organizationAttendanceRules.findMany({
          where: { orgId },
          orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
        }),
        prisma.organizationOvertimeRule.findMany({
          where: { orgId },
          orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
        })
      ]);

      res.status(200).json({
        breakRules: breakRules.map(mapBreakRule),
        attendanceRules: attendanceRules.map(mapAttendanceRule),
        overtimeRules: overtimeRules.map(mapOvertimeRule)
      });
    } catch (error) {
      console.error('Error fetching organization shift rules', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
];

export const createBreakRule = [
  body('orgId').isString().withMessage('Organization id is required'),
  body('breakType').isString().withMessage('breakType is required'),
  body('maxDuration').isInt({ min: 1 }).withMessage('maxDuration must be at least 1 minute'),
  body('maxFrequency').optional().isInt({ min: 1 }),
  body('timeWindowStart').optional().isString(),
  body('timeWindowEnd').optional().isString(),
  body('mandatory').optional().isBoolean(),
  body('requiresApproval').optional().isBoolean(),
  body('penaltyPerMinute').optional().isFloat({ min: 0 }),
  body('isActive').optional().isBoolean(),
  async (req, res) => {
    const validationError = handleValidation(req, res);
    if (validationError) return validationError;

    const {
      orgId,
      breakType,
      maxDuration,
      maxFrequency,
      timeWindowStart,
      timeWindowEnd,
      mandatory = false,
      requiresApproval = false,
      penaltyPerMinute,
      isActive = true
    } = req.body;

    try {
      const breakRule = await prisma.organizationBreakRules.create({
        data: {
          orgId,
          breakType,
          maxDuration,
          maxFrequency: maxFrequency ?? null,
          timeWindow:
            timeWindowStart || timeWindowEnd
              ? {
                  start: timeWindowStart ?? null,
                  end: timeWindowEnd ?? null
                }
              : null,
          mandatory,
          requiresApproval,
          penaltyPerMinute: penaltyPerMinute !== undefined ? penaltyPerMinute : null,
          isActive
        }
      });

      res.status(201).json(mapBreakRule(breakRule));
    } catch (error) {
      console.error('Error creating break rule', error);
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'A break rule with the same type already exists for this organization' });
      }
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
];

export const createAttendanceRule = [
  body('orgId').isString().withMessage('Organization id is required'),
  body('ruleType').isString().withMessage('ruleType is required'),
  body('thresholdMinutes').optional().isInt({ min: 0 }),
  body('thresholdOccurrences').optional().isInt({ min: 0 }),
  body('graceMinutes').optional().isInt({ min: 0 }),
  body('penaltyType').optional().isString(),
  body('penaltyValue').optional().isFloat({ min: 0 }),
  body('penaltyUnit').optional().isString(),
  body('notes').optional().isString(),
  body('isActive').optional().isBoolean(),
  async (req, res) => {
    const validationError = handleValidation(req, res);
    if (validationError) return validationError;

    const {
      orgId,
      ruleType,
      thresholdMinutes,
      thresholdOccurrences,
      graceMinutes,
      penaltyType = 'flat',
      penaltyValue = 0,
      penaltyUnit = 'amount',
      notes,
      isActive = true
    } = req.body;

    const threshold = {
      minutes: thresholdMinutes ?? null,
      occurrences: thresholdOccurrences ?? null,
      graceMinutes: graceMinutes ?? null
    };

    const penalty = {
      type: penaltyType,
      value: penaltyValue,
      unit: penaltyUnit,
      notes: notes ?? null
    };

    try {
      const attendanceRule = await prisma.organizationAttendanceRules.create({
        data: {
          orgId,
          ruleType,
          threshold,
          penalty,
          isActive
        }
      });

      res.status(201).json(mapAttendanceRule(attendanceRule));
    } catch (error) {
      console.error('Error creating attendance rule', error);
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'An attendance rule of this type already exists for this organization' });
      }
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
];

export const createOvertimeRule = [
  body('orgId').isString().withMessage('Organization id is required'),
  body('name').isString().withMessage('name is required'),
  body('rate').isFloat({ min: 0 }).withMessage('rate must be a positive number'),
  body('description').optional().isString(),
  body('applyAfterMinutes').optional().isInt({ min: 0 }),
  body('maxDailyMinutes').optional().isInt({ min: 0 }),
  body('metadata').optional().isObject(),
  body('isActive').optional().isBoolean(),
  async (req, res) => {
    const validationError = handleValidation(req, res);
    if (validationError) return validationError;

    const {
      orgId,
      name,
      rate,
      description,
      applyAfterMinutes,
      maxDailyMinutes,
      metadata,
      isActive = true
    } = req.body;

    try {
      const overtimeRule = await prisma.organizationOvertimeRule.create({
        data: {
          orgId,
          name,
          description: description ?? null,
          rate,
          applyAfterMinutes: applyAfterMinutes ?? 0,
          maxDailyMinutes: maxDailyMinutes ?? null,
          metadata: metadata ?? null,
          isActive
        }
      });

      res.status(201).json(mapOvertimeRule(overtimeRule));
    } catch (error) {
      console.error('Error creating overtime rule', error);
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'An overtime rule with this name already exists for this organization' });
      }
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
];
