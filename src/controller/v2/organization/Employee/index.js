import { listOfEmployees, getEmployeeById } from './employee.queries.js';
import { 
    createEmployee, 
    updateEmployee, 
    deleteEmployee,
    assignEmployeeToDepartments,
    removeEmployeeFromDepartments,
    setEmployeePrimaryDepartment
} from './employee.mutations.js';
import { generateEmployeeId, checkEmployeeId } from './employee.utils.js';

export {
    // Query operations
    listOfEmployees,
    getEmployeeById,
    
    // Mutation operations
    createEmployee,
    updateEmployee,
    deleteEmployee,
    
    // NEW: Multi-department operations
    assignEmployeeToDepartments,
    removeEmployeeFromDepartments,
    setEmployeePrimaryDepartment,
    
    // Utility operations
    generateEmployeeId,
    checkEmployeeId
};
