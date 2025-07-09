import { listOfEmployees, getEmployeeById } from './employee.queries.js';
import { createEmployee, updateEmployee, deleteEmployee } from './employee.mutations.js';
import { generateEmployeeId, checkEmployeeId } from './employee.utils.js';

export {
    // Query operations
    listOfEmployees,
    getEmployeeById,
    
    // Mutation operations
    createEmployee,
    updateEmployee,
    deleteEmployee,
    
    // Utility operations
    generateEmployeeId,
    checkEmployeeId
};
