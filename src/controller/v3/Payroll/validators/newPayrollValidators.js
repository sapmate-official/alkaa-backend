import { body, param, query } from 'express-validator';

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
        .isString()
        .notEmpty()
        .withMessage('Salary record ID is required'),

    body('paymentMode')
        .optional()
        .isString()
        .isLength({ min: 2, max: 50 })
        .withMessage('Payment mode must be between 2 and 50 characters'),

    body('paymentReference')
        .optional()
        .isString()
        .isLength({ min: 2, max: 100 })
        .withMessage('Payment reference must be between 2 and 100 characters'),

    body('notes')
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage('Notes must not exceed 500 characters')
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
