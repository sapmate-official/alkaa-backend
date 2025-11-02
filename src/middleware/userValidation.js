import { body } from 'express-validator';

/**
 * Validation rules for creating a new user
 */
export const createUserValidation = [
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Must be a valid email address')
        .normalizeEmail(),
    
    body('orgId')
        .trim()
        .notEmpty()
        .withMessage('Organization ID is required')
        .isString()
        .withMessage('Organization ID must be a string'),
    
    body('firstName')
        .trim()
        .notEmpty()
        .withMessage('First name is required')
        .isString()
        .withMessage('First name must be a string')
        .isLength({ min: 2, max: 50 })
        .withMessage('First name must be between 2 and 50 characters'),
    
    body('lastName')
        .trim()
        .notEmpty()
        .withMessage('Last name is required')
        .isString()
        .withMessage('Last name must be a string')
        .isLength({ min: 2, max: 50 })
        .withMessage('Last name must be between 2 and 50 characters'),
    
    body('employeeId')
        .trim()
        .notEmpty()
        .withMessage('Employee ID is required')
        .isString()
        .withMessage('Employee ID must be a string'),
    
    // Optional fields validation
    body('departmentId')
        .optional()
        .trim()
        .isString()
        .withMessage('Department ID must be a string'),
    
    body('managerId')
        .optional()
        .trim()
        .isString()
        .withMessage('Manager ID must be a string'),
    
    body('status')
        .optional()
        .trim()
        .isIn(['active', 'inactive', 'terminated'])
        .withMessage('Status must be one of: active, inactive, terminated'),
    
    body('dateOfBirth')
        .optional()
        .isISO8601()
        .withMessage('Date of birth must be a valid date'),
    
    body('address')
        .optional()
        .trim()
        .isString()
        .withMessage('Address must be a string'),
    
    body('mobileNumber')
        .optional()
        .trim()
        .matches(/^[0-9+\-() ]{10,15}$/)
        .withMessage('Mobile number must be valid (10-15 digits)'),
    
    body('emergencyContact')
        .optional()
        .trim()
        .isString()
        .withMessage('Emergency contact must be a string'),
    
    body('adharNumber')
        .optional()
        .trim()
        .matches(/^[0-9]{12}$/)
        .withMessage('Adhar number must be exactly 12 digits'),
    
    body('panNumber')
        .optional()
        .trim()
        .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
        .withMessage('PAN number must be in valid format (e.g., ABCDE1234F)'),
    
    body('shiftTemplateId')
        .optional()
        .trim()
        .isString()
        .withMessage('Shift template ID must be a string'),
    
    body('shiftEffectiveDate')
        .optional()
        .isISO8601()
        .withMessage('Shift effective date must be a valid date'),
    
    body('annualPackage')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Annual package must be a positive number'),
    
    body('monthlySalary')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Monthly salary must be a positive number'),
];

/**
 * Validation rules for updating a user
 */
export const updateUserValidation = [
    body('email')
        .optional()
        .trim()
        .isEmail()
        .withMessage('Must be a valid email address')
        .normalizeEmail(),
    
    body('firstName')
        .optional()
        .trim()
        .isString()
        .withMessage('First name must be a string')
        .isLength({ min: 2, max: 50 })
        .withMessage('First name must be between 2 and 50 characters'),
    
    body('lastName')
        .optional()
        .trim()
        .isString()
        .withMessage('Last name must be a string')
        .isLength({ min: 2, max: 50 })
        .withMessage('Last name must be between 2 and 50 characters'),
    
    body('employeeId')
        .optional()
        .trim()
        .isString()
        .withMessage('Employee ID must be a string'),
    
    body('status')
        .optional()
        .trim()
        .isIn(['active', 'inactive', 'terminated'])
        .withMessage('Status must be one of: active, inactive, terminated'),
    
    body('dateOfBirth')
        .optional()
        .isISO8601()
        .withMessage('Date of birth must be a valid date'),
    
    body('mobileNumber')
        .optional()
        .trim()
        .matches(/^[0-9+\-() ]{10,15}$/)
        .withMessage('Mobile number must be valid (10-15 digits)'),
    
    body('adharNumber')
        .optional()
        .trim()
        .matches(/^[0-9]{12}$/)
        .withMessage('Adhar number must be exactly 12 digits'),
    
    body('panNumber')
        .optional()
        .trim()
        .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
        .withMessage('PAN number must be in valid format (e.g., ABCDE1234F)'),
    
    body('annualPackage')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Annual package must be a positive number'),
    
    body('monthlySalary')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Monthly salary must be a positive number'),
];
