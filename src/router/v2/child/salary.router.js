import express from "express";
import { createSalary, deleteSalary, getSalaryById, getSalaries, updateSalary,getExistenceOfSalaryRecordBasedOnMonthAndYearForUserID } from "../../../controller/v2/Salary/salary.controller.js";
import prisma from "../../../db/connectDb.js";

const router = express.Router();

router.get("/", getSalaries);
router.get("/:id", getSalaryById);
router.post("/", createSalary);
router.put("/:id", updateSalary);
router.patch("/:id", updateSalary);
router.delete("/:id", deleteSalary);


//extra routes
router.get('/user/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const salaryRecords = await prisma.salaryRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
      res.json(salaryRecords);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Generate salary for a specific month
  router.post('/generate', async (req, res) => {
    try {
      const { userId, month, year } = req.body;
      const salaryRecord = await payrollService.calculateSalary(userId, month, year);
      res.json(salaryRecord);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update salary record status
  router.patch('/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updatedRecord = await prisma.salaryRecord.update({
        where: { id },
        data: { status }
      });
      res.json(updatedRecord);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get salary statistics
  router.get('/statistics', async (req, res) => {
    try {
      const { orgId, month, year } = req.query;
      const statistics = await prisma.salaryRecord.aggregate({
        where: {
          user: { orgId },
          month: parseInt(month),
          year: parseInt(year)
        },
        _sum: {
          basicSalary: true,
          netSalary: true,
          tax: true
        },
        _count: true
      });
      res.json(statistics);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  router.get('/user/:userId/monthly/:month/year/:year', getExistenceOfSalaryRecordBasedOnMonthAndYearForUserID)

export default router;