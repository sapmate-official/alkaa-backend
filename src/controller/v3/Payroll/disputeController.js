import { validationResult } from 'express-validator';
import prisma from '../../../db/connectDb.js';
import { PayrollPermissions } from './validators/payrollValidators.js';
import { DISPUTE_STATUS_VALUES } from './validators/newPayrollValidators.js';

const MAX_PAGE_SIZE = 200;

const baseDisputeInclude = {
  salaryRecord: {
    select: {
      id: true,
      month: true,
      year: true,
      netSalary: true,
      status: true,
      processedAt: true,
      orgId: true,
      cycleId: true,
      userId: true,
      user: {
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          managerId: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      cycle: {
        select: {
          id: true,
          month: true,
          year: true,
          status: true,
        },
      },
    },
  },
};

const validateRequest = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
    return false;
  }
  return true;
};

const toInt = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const toDate = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseStatuses = (value) => {
  if (!value) {
    return [];
  }
  const candidate = Array.isArray(value) ? value : String(value).split(',');
  return candidate
    .map((entry) => entry?.trim()?.toUpperCase())
    .filter(Boolean)
    .filter((status, index, array) => array.indexOf(status) === index);
};

const buildStatusSummary = (grouped = []) => {
  const summary = DISPUTE_STATUS_VALUES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  grouped.forEach((row) => {
    if (row?.status && summary[row.status] !== undefined) {
      summary[row.status] = row._count?._all ?? 0;
    }
  });

  summary.total = Object.values(summary).reduce((sum, value) => {
    if (typeof value === 'number') {
      return sum + value;
    }
    return sum;
  }, 0);

  return summary;
};

const formatDispute = (dispute) => {
  if (!dispute) {
    return null;
  }

  const salaryRecord = dispute.salaryRecord ?? null;
  const employee = salaryRecord?.user ?? null;
  const manager = employee?.manager ?? null;

  return {
    id: dispute.id,
    salaryRecordId: dispute.salaryRecordId,
    userId: dispute.userId,
    reason: dispute.reason,
    description: dispute.description,
    status: dispute.status,
    resolutionNote: dispute.resolutionNote,
    resolvedBy: dispute.resolvedBy,
    resolvedAt: dispute.resolvedAt,
    createdAt: dispute.createdAt,
    updatedAt: dispute.updatedAt,
    salaryRecord: salaryRecord
      ? {
          id: salaryRecord.id,
          month: salaryRecord.month,
          year: salaryRecord.year,
          netSalary: salaryRecord.netSalary,
          status: salaryRecord.status,
          processedAt: salaryRecord.processedAt,
          cycleId: salaryRecord.cycleId,
        }
      : null,
    cycle: salaryRecord?.cycle
      ? {
          id: salaryRecord.cycle.id,
          month: salaryRecord.cycle.month,
          year: salaryRecord.cycle.year,
          status: salaryRecord.cycle.status,
        }
      : null,
    employee: employee
      ? {
          id: employee.id,
          employeeId: employee.employeeId,
          firstName: employee.firstName,
          lastName: employee.lastName,
          department: employee.department?.name ?? null,
          manager: manager
            ? {
                id: manager.id,
                firstName: manager.firstName,
                lastName: manager.lastName,
              }
            : null,
        }
      : null,
  };
};

const buildDisputeFilters = ({
  orgId,
  statuses,
  month,
  year,
  cycleId,
  managerId,
  employeeId,
  search,
  updatedSince,
  restrictToManagerId,
}) => {
  const filters = [];

  filters.push({ salaryRecord: { orgId } });

  if (restrictToManagerId) {
    filters.push({ salaryRecord: { user: { managerId: restrictToManagerId } } });
  }

  if (Array.isArray(statuses) && statuses.length > 0) {
    if (statuses.length === 1) {
      filters.push({ status: statuses[0] });
    } else {
      filters.push({ status: { in: statuses } });
    }
  }

  if (month) {
    filters.push({ salaryRecord: { month } });
  }

  if (year) {
    filters.push({ salaryRecord: { year } });
  }

  if (cycleId) {
    filters.push({ salaryRecord: { cycleId } });
  }

  if (managerId) {
    filters.push({ salaryRecord: { user: { managerId } } });
  }

  if (employeeId) {
    filters.push({
      OR: [
        { userId: employeeId },
        { salaryRecord: { user: { employeeId: { contains: employeeId, mode: 'insensitive' } } } },
      ],
    });
  }

  if (search) {
    const searchTerm = search.trim();
    if (searchTerm.length > 0) {
      filters.push({
        OR: [
          { reason: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { salaryRecord: { user: { firstName: { contains: searchTerm, mode: 'insensitive' } } } },
          { salaryRecord: { user: { lastName: { contains: searchTerm, mode: 'insensitive' } } } },
          { salaryRecord: { user: { employeeId: { contains: searchTerm, mode: 'insensitive' } } } },
        ],
      });
    }
  }

  if (updatedSince) {
    filters.push({ updatedAt: { gte: updatedSince } });
  }

  return { AND: filters };
};

const extractPagination = (pageParam, pageSizeParam) => {
  const page = Math.max(toInt(pageParam) || 1, 1);
  const pageSizeRaw = toInt(pageSizeParam) || 25;
  const pageSize = Math.min(Math.max(pageSizeRaw, 1), MAX_PAGE_SIZE);
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
};

const buildOrderBy = (sortField, sortDirection) => {
  if (!sortField) {
    return [{ createdAt: 'desc' }];
  }

  const direction = String(sortDirection).toLowerCase() === 'asc' ? 'asc' : 'desc';

  if (sortField === 'status') {
    return [{ status: direction }, { createdAt: 'desc' }];
  }

  if (['createdAt', 'updatedAt', 'resolvedAt'].includes(sortField)) {
    return [{ [sortField]: direction }];
  }

  if (sortField === 'month' || sortField === 'year') {
    return [
      { salaryRecord: { year: direction } },
      { salaryRecord: { month: direction } },
      { createdAt: 'desc' },
    ];
  }

  if (sortField === 'employee') {
    return [
      { salaryRecord: { user: { firstName: direction } } },
      { salaryRecord: { user: { lastName: direction } } },
      { createdAt: 'desc' },
    ];
  }

  return [{ createdAt: 'desc' }];
};

const fetchDisputes = async ({ where, skip, take, orderBy }) => {
  return prisma.$transaction([
    prisma.salaryDispute.count({ where }),
    prisma.salaryDispute.findMany({
      where,
      skip,
      take,
      orderBy,
      include: baseDisputeInclude,
    }),
    prisma.salaryDispute.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
  ]);
};

export const getOrganizationDisputes = async (req, res) => {
  if (!validateRequest(req, res)) {
    return;
  }

  try {
    const currentUserId = req.user?.id;
    const orgId = req.user?.orgId;

    if (!currentUserId || !orgId) {
      return res.status(400).json({
        success: false,
        message: 'User context is missing. Unable to resolve organization scope.',
      });
    }

    const canView = await PayrollPermissions.canViewAllDisputes(currentUserId);
    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view organization-wide salary disputes.',
      });
    }

    const statuses = parseStatuses(req.query.status);
    const month = toInt(req.query.month);
    const year = toInt(req.query.year);
    const cycleId = req.query.cycleId ? String(req.query.cycleId).trim() : null;
    const managerId = req.query.managerId ? String(req.query.managerId).trim() : null;
    const employeeId = req.query.employeeId ? String(req.query.employeeId).trim() : null;
    const search = req.query.search ? String(req.query.search).trim() : null;
    const updatedSince = toDate(req.query.updatedSince);
    const { page, pageSize, skip } = extractPagination(req.query.page, req.query.pageSize);
    const orderBy = buildOrderBy(req.query.sortBy, req.query.sortDirection);

    const where = buildDisputeFilters({
      orgId,
      statuses,
      month,
      year,
      cycleId,
      managerId,
      employeeId,
      search,
      updatedSince,
    });

    const [total, disputes, grouped] = await fetchDisputes({ where, skip, take: pageSize, orderBy });

    return res.status(200).json({
      success: true,
      data: disputes.map(formatDispute),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
      statusSummary: buildStatusSummary(grouped),
    });
  } catch (error) {
    console.error('[PAYROLL][ADMIN][DISPUTES] Failed to retrieve disputes:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load salary disputes for the organization.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getManagerDisputes = async (req, res) => {
  if (!validateRequest(req, res)) {
    return;
  }

  try {
    const currentUserId = req.user?.id;
    const orgId = req.user?.orgId;

    if (!currentUserId || !orgId) {
      return res.status(400).json({
        success: false,
        message: 'User context is missing. Unable to resolve organization scope.',
      });
    }

    const canView = await PayrollPermissions.canViewTeamDisputes(currentUserId);
    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view salary disputes for your team.',
      });
    }

    const statuses = parseStatuses(req.query.status);
    const month = toInt(req.query.month);
    const year = toInt(req.query.year);
    const cycleId = req.query.cycleId ? String(req.query.cycleId).trim() : null;
    const employeeId = req.query.employeeId ? String(req.query.employeeId).trim() : null;
    const search = req.query.search ? String(req.query.search).trim() : null;
    const updatedSince = toDate(req.query.updatedSince);
    const { page, pageSize, skip } = extractPagination(req.query.page, req.query.pageSize);
    const orderBy = buildOrderBy(req.query.sortBy, req.query.sortDirection);

    const where = buildDisputeFilters({
      orgId,
      statuses,
      month,
      year,
      cycleId,
      employeeId,
      search,
      updatedSince,
      restrictToManagerId: currentUserId,
    });

    const [total, disputes, grouped] = await fetchDisputes({ where, skip, take: pageSize, orderBy });

    return res.status(200).json({
      success: true,
      data: disputes.map(formatDispute),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
      statusSummary: buildStatusSummary(grouped),
    });
  } catch (error) {
    console.error('[PAYROLL][MANAGER][DISPUTES] Failed to retrieve disputes:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load salary disputes for your team.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const updateDisputeStatusInternal = async (req, res, scope) => {
  if (!validateRequest(req, res)) {
    return;
  }

  try {
    const currentUserId = req.user?.id;
    const orgId = req.user?.orgId;
    const { disputeId } = req.params;
    const incomingStatus = req.body?.status?.trim()?.toUpperCase();
    const resolutionNoteRaw = req.body?.resolutionNote;

    if (!currentUserId || !orgId) {
      return res.status(400).json({
        success: false,
        message: 'User context is missing. Unable to resolve organization scope.',
      });
    }

    if (!DISPUTE_STATUS_VALUES.includes(incomingStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid dispute status provided.',
      });
    }

    if (scope === 'admin') {
      const allowed = await PayrollPermissions.canManageAllDisputes(currentUserId);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update organization-wide salary disputes.',
        });
      }
    }

    if (scope === 'manager') {
      const allowed = await PayrollPermissions.canManageTeamDisputes(currentUserId);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update salary disputes for your team.',
        });
      }
    }

    const dispute = await prisma.salaryDispute.findUnique({
      where: { id: disputeId },
      include: baseDisputeInclude,
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Salary dispute not found.',
      });
    }

    if (dispute.salaryRecord?.orgId !== orgId) {
      return res.status(404).json({
        success: false,
        message: 'Salary dispute not found in your organization.',
      });
    }

    if (scope === 'manager') {
      const managerId = dispute.salaryRecord?.user?.managerId;
      if (managerId !== currentUserId) {
        return res.status(403).json({
          success: false,
          message: 'You can only update disputes raised by your direct reports.',
        });
      }
    }

    const resolutionNote = resolutionNoteRaw?.trim() ? resolutionNoteRaw.trim() : null;

    if ((incomingStatus === 'RESOLVED' || incomingStatus === 'REJECTED') && !resolutionNote) {
      return res.status(400).json({
        success: false,
        message: 'A resolution note is required when resolving or rejecting a dispute.',
      });
    }

    const updateData = {
      status: incomingStatus,
      resolutionNote: resolutionNote,
      resolvedBy: null,
      resolvedAt: null,
    };

    if (incomingStatus === 'UNDER_REVIEW') {
      updateData.resolvedBy = currentUserId;
      updateData.resolvedAt = null;
    }

    if (incomingStatus === 'RESOLVED' || incomingStatus === 'REJECTED') {
      updateData.resolvedBy = currentUserId;
      updateData.resolvedAt = new Date();
    }

    if (incomingStatus === 'PENDING') {
      updateData.resolutionNote = null;
      updateData.resolvedBy = null;
      updateData.resolvedAt = null;
    }

    const updatedDispute = await prisma.salaryDispute.update({
      where: { id: disputeId },
      data: updateData,
      include: baseDisputeInclude,
    });

    return res.status(200).json({
      success: true,
      message: 'Salary dispute updated successfully.',
      data: formatDispute(updatedDispute),
    });
  } catch (error) {
  const scopeLabel = scope ? scope.toUpperCase() : 'UNKNOWN';
  console.error(`[PAYROLL][${scopeLabel}][DISPUTES] Failed to update dispute:`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update salary dispute.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateOrganizationDisputeStatus = async (req, res) => {
  await updateDisputeStatusInternal(req, res, 'admin');
};

export const updateManagerDisputeStatus = async (req, res) => {
  await updateDisputeStatusInternal(req, res, 'manager');
};
