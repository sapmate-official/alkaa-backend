/**
 * DEPRECATED: This file has been modularized.
 * Please import from the new structure:
 * 
 * import { 
 *   listOfEmployees, getEmployeeById,
 *   createEmployee, updateEmployee, deleteEmployee,
 *   generateEmployeeId, checkEmployeeId
 * } from './index.js';
 */

// Import from the new modular structure to maintain backward compatibility
import {
    listOfEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    generateEmployeeId,
    checkEmployeeId
} from './index.js';

export {
    listOfEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    generateEmployeeId,
    checkEmployeeId
};