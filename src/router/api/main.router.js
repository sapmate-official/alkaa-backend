

import express from 'express';
import { createEmployee, updateEmployee, deleteEmployee, viewEmployee } from '../../controller/api/api.controller.js';

const router = express.Router();

// Create employee
router.post('/employees', createEmployee);

// Update employee
router.put('/employees/:id', updateEmployee);

// Delete employee
router.delete('/employees/:id', deleteEmployee);

// View employee (with id or without id)
router.get('/employees/:id?', viewEmployee);

export default router;