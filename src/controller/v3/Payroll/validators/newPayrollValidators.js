import { body, param, query } from 'express-validator';

export const DISPUTE_STATUS_VALUES = ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'];

// Template validation rules
export const createTemplateValidation = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Template name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Template name must be between 2 and 100 characters'),
    
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters'),
    
    body('isDefault')
        .optional()
        .isBoolean()
        .withMessage('isDefault must be a boolean'),
    
    body('rules')
        .notEmpty()
        .withMessage('Salary rules are required')
        .isObject()
        .withMessage('Rules must be a valid object'),
    
    body('rules.basicSalary')
        .notEmpty()
        .withMessage('Basic salary configuration is required'),
    
    body('rules.basicSalary.type')
        .isIn(['fixed', 'percentage'])
        .withMessage('Basic salary type must be either fixed or percentage'),
    
    body('rules.basicSalary.value')
        .isNumeric()
        .withMessage('Basic salary value must be numeric')
        .isFloat({ min: 0 })
        .withMessage('Basic salary value must be positive'),
    
    body('rules.allowances')
        .optional()
        .isArray()
        .withMessage('Allowances must be an array'),
    
    body('rules.deductions')
        .optional()
        .isArray()
        .withMessage('Deductions must be an array')
];

export const updateTemplateValidation = [
    param('templateId')
        .isString()
        .notEmpty()
        .withMessage('Valid template ID is required'),
    
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Template name must be between 2 and 100 characters'),
    
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters'),
    
    body('isDefault')
        .optional()
        .isBoolean()
        .withMessage('isDefault must be a boolean'),
    
    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),
    
    body('rules')
        .optional()
        .isObject()
        .withMessage('Rules must be a valid object')
];

export const deleteTemplateValidation = [
    param('templateId')
        .isString()
        .notEmpty()
        .withMessage('Valid template ID is required')
];

// Calculation rule validation
export const createCalculationRuleValidation = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Rule name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Rule name must be between 2 and 100 characters'),
    
    body('formula')
        .trim()
        .notEmpty()
        .withMessage('Formula is required')
        .isLength({ min: 1, max: 500 })
        .withMessage('Formula must not exceed 500 characters'),
    
    body('type')
        .isIn(['allowance', 'deduction', 'tax'])
        .withMessage('Type must be allowance, deduction, or tax'),
    
    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean')
];

export const updateCalculationRuleValidation = [
    param('ruleId')
        .isString()
        .notEmpty()
        .withMessage('Valid rule ID is required'),

    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Rule name must be between 2 and 100 characters'),

    body('formula')
        .optional()
        .trim()
        .isLength({ min: 1, max: 500 })
        .withMessage('Formula must not exceed 500 characters'),

    body('type')
        .optional()
        .isIn(['allowance', 'deduction', 'tax'])
        .withMessage('Type must be allowance, deduction, or tax'),

    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean')
];

export const deleteCalculationRuleValidation = [
    param('ruleId')
        .isString()
        .notEmpty()
        .withMessage('Valid rule ID is required')
];

// Template assignment validation
export const assignTemplateValidation = [
    body('templateId')
        .isString()
        .notEmpty()
        .withMessage('Template ID is required'),
    
    body('employeeIds')
        .optional()
        .isArray()
        .withMessage('Employee IDs must be an array'),
    
    body('employeeIds.*')
        .optional()
        .isString()
        .withMessage('Each employee ID must be a string'),
    
    body('departmentIds')
        .optional()
        .isArray()
        .withMessage('Department IDs must be an array'),
    
    body('departmentIds.*')
        .optional()
        .isString()
        .withMessage('Each department ID must be a string'),
    
    body()
        .custom((value) => {
            if (!value.employeeIds && !value.departmentIds) {
                throw new Error('Either employeeIds or departmentIds must be provided');
            }
            if (value.employeeIds && value.employeeIds.length === 0 && 
                value.departmentIds && value.departmentIds.length === 0) {
                throw new Error('At least one employee or department must be specified');
            }
            return true;
        })
];

// Manager review validation
export const approveRejectRecordValidation = [
    param('recordId')
        .isString()
        .notEmpty()
        .withMessage('Valid record ID is required'),
    
    body('comments')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Comments must not exceed 1000 characters')
];

export const rejectRecordValidation = [
    param('recordId')
        .isString()
        .notEmpty()
        .withMessage('Valid record ID is required'),
    
    body('comments')
        .trim()
        .notEmpty()
        .withMessage('Comments are required when rejecting a record')
        .isLength({ min: 10, max: 1000 })
        .withMessage('Comments must be between 10 and 1000 characters')
];

export const bulkApproveValidation = [
    body('recordIds')
        .isArray({ min: 1 })
        .withMessage('At least one record ID is required'),
    
    body('recordIds.*')
        .isString()
        .withMessage('Each record ID must be a string'),
    
    body('comments')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Comments must not exceed 1000 characters')
];

export const recordSalaryPaymentValidation = [
    body('salaryRecordId')
        .optional()
        .isString()
        .withMessage('Salary record ID must be a string'),

    body('records')
        .optional()
        .isArray({ min: 1 })
        .withMessage('records must be a non-empty array'),

    body('records.*.salaryRecordId')
        .optional()
        .isString()
        .withMessage('Each payment entry must include salaryRecordId'),

    body('paymentMode')
        .optional()
        .isString()
        .isLength({ min: 2, max: 50 })
        .withMessage('Payment mode must be between 2 and 50 characters'),

    body('records.*.paymentMode')
        .optional()
        .isString()
        .isLength({ min: 2, max: 50 })
        .withMessage('Payment mode must be between 2 and 50 characters'),

    body('paymentReference')
        .optional()
        .isString()
        .isLength({ min: 2, max: 100 })
        .withMessage('Payment reference must be between 2 and 100 characters'),

    body('records.*.paymentReference')
        .optional()
        .isString()
        .isLength({ min: 2, max: 100 })
        .withMessage('Payment reference must be between 2 and 100 characters'),

    body('notes')
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage('Notes must not exceed 500 characters'),

    body('records.*.notes')
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage('Notes must not exceed 500 characters'),

    body('incentive')
        .optional()
        .isNumeric()
        .withMessage('Incentive must be numeric'),

    body('bonus')
        .optional()
        .isNumeric()
        .withMessage('Bonus must be numeric'),

    body('records.*.incentive')
        .optional()
        .isNumeric()
        .withMessage('Incentive must be numeric'),

    body('records.*.bonus')
        .optional()
        .isNumeric()
        .withMessage('Bonus must be numeric'),

    body('processedAt')
        .optional()
        .isISO8601()
        .withMessage('processedAt must be a valid ISO 8601 date'),

    body('records.*.processedAt')
        .optional()
        .isISO8601()
        .withMessage('processedAt must be a valid ISO 8601 date'),

    body()
        .custom((value) => {
            const hasSingle = Boolean(value.salaryRecordId);
            const hasBulk = Array.isArray(value.records) && value.records.length > 0;
            if (!hasSingle && !hasBulk) {
                throw new Error('Provide salaryRecordId or a non-empty records array');
            }
            return true;
        })
];

export const initiatePayoutValidation = [
    param('cycleId')
        .isString()
        .notEmpty()
        .withMessage('Valid cycle ID is required'),

    body('requireBankDetails')
        .optional()
        .isBoolean()
        .withMessage('requireBankDetails must be a boolean'),

    body('salaryRecordIds')
        .optional()
        .isArray()
        .withMessage('salaryRecordIds must be an array'),

    body('salaryRecordIds.*')
        .optional()
        .isString()
        .withMessage('Each salaryRecordId must be a string')
];

export const payoutSummaryValidation = [
    param('cycleId')
        .isString()
        .notEmpty()
        .withMessage('Valid cycle ID is required')
];

export const disputeListQueryValidation = [
    query('status')
        .optional()
        .isString()
        .withMessage('status must be a comma separated string')
        .custom((value) => {
            const statuses = String(value)
                .split(',')
                .map((entry) => entry.trim().toUpperCase())
                .filter(Boolean);
            const invalid = statuses.filter((status) => !DISPUTE_STATUS_VALUES.includes(status));
            if (invalid.length > 0) {
                throw new Error(`Invalid dispute status: ${invalid.join(', ')}`);
            }
            return true;
        }),

    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('page must be at least 1'),

    query('pageSize')
        .optional()
        .isInt({ min: 1, max: 200 })
        .withMessage('pageSize must be between 1 and 200'),

    query('month')
        .optional()
        .isInt({ min: 1, max: 12 })
        .withMessage('month must be between 1 and 12'),

    query('year')
        .optional()
        .isInt({ min: 2000, max: 2100 })
        .withMessage('year must be between 2000 and 2100'),

    query('cycleId')
        .optional()
        .isString()
        .withMessage('cycleId must be a string'),

    query('managerId')
        .optional()
        .isString()
        .withMessage('managerId must be a string'),

    query('employeeId')
        .optional()
        .isString()
        .withMessage('employeeId must be a string'),

    query('search')
        .optional()
        .isString()
        .withMessage('search must be a string'),

    query('updatedSince')
        .optional()
        .isISO8601()
        .withMessage('updatedSince must be a valid ISO8601 date')
];

export const payslipHistoryQueryValidation = [
    query('months')
        .optional()
        .isInt({ min: 1, max: 24 })
        .withMessage('months must be between 1 and 24'),

    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('page must be at least 1'),

    query('pageSize')
        .optional()
        .isInt({ min: 1, max: 500 })
        .withMessage('pageSize must be between 1 and 500'),

    query('status')
        .optional()
        .isString()
        .withMessage('status must be a comma separated string'),

    query('paymentStatus')
        .optional()
        .isString()
        .withMessage('paymentStatus must be a comma separated string'),

    query('search')
        .optional()
        .isString()
        .withMessage('search must be a string')

];

export const taxSummaryQueryValidation = [
    query('months')
        .optional()
        .isInt({ min: 1, max: 24 })
        .withMessage('months must be between 1 and 24'),

    query('status')
        .optional()
        .isString()
        .withMessage('status must be a comma separated string'),

    query('paymentStatus')
        .optional()
        .isString()
        .withMessage('paymentStatus must be a comma separated string'),

    query('departmentIds')
        .optional()
        .isString()
        .withMessage('departmentIds must be a comma separated string'),

    query('search')
        .optional()
        .isString()
        .withMessage('search must be a string'),

    query('minTax')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('minTax must be a positive number'),

    query('maxTax')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('maxTax must be a positive number')
];

export const disputeUpdateValidation = [
    param('disputeId')
        .isString()
        .notEmpty()
        .withMessage('Valid dispute ID is required'),

    body('status')
        .isString()
        .notEmpty()
        .withMessage('Status is required')
        .custom((value) => {
            const normalized = value.trim().toUpperCase();
            if (!DISPUTE_STATUS_VALUES.includes(normalized)) {
                throw new Error('Invalid dispute status provided');
            }
            return true;
        }),

    body('resolutionNote')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 3, max: 2000 })
        .withMessage('Resolution note must be between 3 and 2000 characters')
];

// Workflow validation
export const updateWorkflowStepValidation = [
    param('stepId')
        .isString()
        .notEmpty()
        .withMessage('Valid step ID is required'),
    
    body('status')
        .optional()
        .isIn(['pending', 'in_progress', 'completed', 'blocked'])
        .withMessage('Status must be pending, in_progress, completed, or blocked'),
    
    body('comments')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Comments must not exceed 1000 characters'),
    
    body('completedAt')
        .optional()
        .isISO8601()
        .withMessage('completedAt must be a valid ISO 8601 date')
];

export const initializeWorkflowValidation = [
    body('month')
        .isInt({ min: 1, max: 12 })
        .withMessage('Month must be a number between 1 and 12'),
    
    body('year')
        .isInt({ min: 2020, max: 2030 })
        .withMessage('Year must be between 2020 and 2030'),
    
    body('cycleId')
        .optional()
        .isString()
        .withMessage('Cycle ID must be a string')
];

// Query validation
export const monthYearQueryValidation = [
    query('month')
        .optional()
        .isInt({ min: 1, max: 12 })
        .withMessage('Month must be a number between 1 and 12'),
    
    query('year')
        .optional()
        .isInt({ min: 2020, max: 2030 })
        .withMessage('Year must be between 2020 and 2030')
];

export const statusQueryValidation = [
    query('status')
        .optional()
        .isIn(['PENDING', 'PROCESSING', 'PROCESSED', 'REVIEW', 'APPROVED', 'REJECTED', 'PAID'])
        .withMessage('Status must be PENDING, PROCESSING, PROCESSED, REVIEW, APPROVED, REJECTED, or PAID')
];

export const paymentStatusQueryValidation = [
    query('paymentStatus')
        .optional()
        .isIn(['PENDING', 'INITIATED', 'COMPLETED', 'FAILED'])
        .withMessage('paymentStatus must be PENDING, INITIATED, COMPLETED, or FAILED')
];

export const workflowQueryValidation = [
    query('phase')
        .optional()
        .isIn(['setup', 'cycle', 'review', 'reporting', 'employee'])
        .withMessage('Phase must be setup, cycle, review, reporting, or employee'),
    
    query('status')
        .optional()
        .isIn(['pending', 'in_progress', 'completed', 'blocked'])
        .withMessage('Status must be pending, in_progress, completed, or blocked')
];
