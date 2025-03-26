import express from "express";
import prisma from "../../../db/connectDb.js";

const router = express.Router();

export class PayrollService {
  async calculateSalary(userId, month, year) {
    console.log(`Starting salary calculation for user ${userId} for ${month}/${year}`);
    try {
      // Get user details
      console.log('Fetching user details...');
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          attendanceRecords: {
            where: {
              AND: [
                { date: { gte: new Date(year, month - 1, 1) } },
                { date: { lt: new Date(year, month, 1) } }
              ]
            }
          },
          leaveRequests: {
            where: {
              AND: [
                { startDate: { gte: new Date(year, month - 1, 1) } },
                { endDate: { lt: new Date(year, month, 1) } },
                { status: 'APPROVED' }
              ]
            },
            include: { leaveType: true }
          },
          salaryParameter: true,
        }
      });

      if (!user) throw new Error('User not found');
      console.log('User details fetched:', { userId: user.id, name: user.name });

      // Get salary parameters (use defaults if not set)
      const params = user.salaryParameter || {
        hraPercentage: 0,
        daPercentage: 0,
        taPercentage: 0,
        pfPercentage: 0,
        taxPercentage: 0,
        insuranceFixed: 0,
        additionalAllowances: {},
        additionalDeductions: {}
      };

      // Calculate basic salary (monthly)
      const basicSalary = user.monthlySalary || 0;
      console.log('Basic salary:', basicSalary);

      // Calculate allowances using custom parameters
      const allowances = {
        hra: basicSalary * (params.hraPercentage / 100),
        da: basicSalary * (params.daPercentage / 100),
        ta: basicSalary * (params.taPercentage / 100),
        ...params.additionalAllowances
      };
      console.log('Calculated allowances:', allowances);

      // Calculate deductions based on leaves and attendance
      const workingDays = this.getWorkingDays(month, year);
      console.log('Working days in month:', workingDays);

      const leaveDeductions = this.calculateLeaveDeductions(user.leaveRequests, basicSalary, workingDays);
      console.log('Leave deductions:', leaveDeductions);
      
      // Calculate deductions using custom parameters
      const deductions = {
        pf: basicSalary * (params.pfPercentage / 100),
        insurance: params.insuranceFixed,
        leaveDeductions,
        tax: basicSalary * (params.taxPercentage / 100),
        ...params.additionalDeductions
      };
      console.log('Total deductions:', deductions);

      // Calculate net salary
      const totalAllowances = Object.values(allowances).reduce((a, b) => a + b, 0);
      const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0);
      const netSalary = basicSalary + totalAllowances - totalDeductions;
      console.log('Final calculation:', { totalAllowances, totalDeductions, netSalary });

      // Create salary record
      console.log('Creating salary record...');
      const salaryRecord = await prisma.salaryRecord.create({
        data: {
          userId,
          month,
          year,
          basicSalary,
          allowances,
          deductions,
          tax: basicSalary * (params.taxPercentage / 100),
          netSalary,
          status: 'PENDING'
        }
      });
      console.log('Salary record created:', salaryRecord.id);

      return salaryRecord;
    } catch (error) {
      console.error('Error in calculateSalary:', error);
      throw new Error(`Error calculating salary: ${error.message}`);
    }
  }

  getWorkingDays(month, year) {
    console.log(`Calculating working days for ${month}/${year}`);
    // Calculate working days excluding weekends
    const date = new Date(year, month - 1, 1);
    const days = new Date(year, month, 0).getDate();
    let workingDays = 0;

    for (let i = 1; i <= days; i++) {
      date.setDate(i);
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        workingDays++;
      }
    }

    console.log(`Total working days: ${workingDays}`);
    return workingDays;
  }

  calculateLeaveDeductions(leaves, basicSalary, workingDays) {
    console.log('Calculating leave deductions:', { leaves: leaves.length, basicSalary, workingDays });
    const perDaySalary = basicSalary / workingDays;
    let deduction = 0;

    leaves.forEach(leave => {
      console.log('Processing leave:', { leaveId: leave.id, days: leave.numberOfDays, isPaid: leave.leaveType.isPaid });
      if (!leave.leaveType.isPaid) {
        deduction += leave.numberOfDays * perDaySalary;
      }
    });

    console.log('Total leave deduction:', deduction);
    return deduction;
  }
}

// Create an instance of PayrollService
const payrollService = new PayrollService();

// Router endpoints
router.get('/user/:userId', async (req, res) => {
  console.log('Fetching salary records for user:', req.params.userId);
  try {
    const { userId } = req.params;
    const salaryParameter = await prisma.salaryParameter.findUnique({
      where: { userId }
    });
    const bankDetails = await prisma.bankDetails.findUnique({
      where: { userId }
    });
    const salaryRecords = await prisma.salaryRecord.findMany({
      where: { userId },
      include:{
        user: {
            include:{
                bankDetails:true
            }
        },
        
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`Found ${salaryRecords.length} salary records`);
    res.json({salaryRecords, salaryParameter, bankDetails});
  } catch (error) {
    console.error('Error fetching salary records:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate', async (req, res) => {
  console.log('Generating salary:', req.body);
  try {
    const { userId, month, year } = req.body;
    const salaryRecord = await payrollService.calculateSalary(userId, month, year);
    console.log('Salary generated successfully:', salaryRecord.id);
    res.json(salaryRecord);
  } catch (error) {
    console.error('Error generating salary:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  console.log('Updating salary record status:', { id: req.params.id, status: req.body.status });
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updatedRecord = await prisma.salaryRecord.update({
      where: { id },
      data: { status }
    });
    console.log('Status updated successfully');
    res.json(updatedRecord);
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/statistics', async (req, res) => {
  console.log('Fetching salary statistics:', req.query);
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
    console.log('Statistics calculated:', statistics);
    res.json(statistics);
  } catch (error) {
    console.error('Error calculating statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/users/active/:org_id', async (req, res) => {
    try {
      const { org_id } = req.params;
      const activeEmployees = await prisma.user.findMany({
        where: {
          status: 'active',
          terminationDate: null,
          orgId: org_id
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeId: true,
          monthlySalary: true,
          departmentId: true
        },
        orderBy: {
          firstName: 'asc'
        }
      });
      res.json(activeEmployees);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Check existing salary records
  router.post('/check-existing', async (req, res) => {
    try {
      const { userId, month, year } = req.body;
      
      const existingRecord = await prisma.salaryRecord.findFirst({
        where: {
          userId,
          month,
          year
        }
      });
      
      res.json({ exists: !!existingRecord });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Bulk generate salaries
  router.post('/bulk-generate', async (req, res) => {
    const { employeeIds, month, year } = req.body;
    
    try {
      // Start a transaction
      const results = await prisma.$transaction(async (prisma) => {
        const generatedSalaries = [];
        const errors = [];
  
        for (const employeeId of employeeIds) {
          try {
            // Check for existing salary record
            const existing = await prisma.salaryRecord.findFirst({
              where: {
                userId: employeeId,
                month,
                year
              }
            });
  
            if (existing) {
              errors.push({
                employeeId,
                error: 'Salary record already exists for this period'
              });
              continue;
            }
  
            // Generate salary record
            const salary = await payrollService.calculateSalary(employeeId, month, year);
            generatedSalaries.push(salary);
          } catch (error) {
            errors.push({
              employeeId,
              error: error.message
            });
          }
        }
  
        return {
          successful: generatedSalaries,
          failed: errors
        };
      });
  
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

router.post('/parameters/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const parameters = req.body;

    const salaryParameter = await prisma.salaryParameter.upsert({
      where: { userId },
      update: parameters,
      create: {
        userId,
        ...parameters
      }
    });

    res.json(salaryParameter);
  } catch (error) {
    console.log(error);
    
    res.status(500).json({ error: error.message });
  }
});

router.get('/parameters/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const parameters = await prisma.salaryParameter.findUnique({
      where: { userId }
    });
    res.json(parameters || {});
  } catch (error) {
    res.status(500).json({ error: error.message }); 
  }
});

// You'll need to import your payment gateway SDK
// Example: const razorpay = require('razorpay');
// const paymentGateway = new razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET
// });

// Initiate salary transaction
router.post('/initiate-transaction', async (req, res) => {
    const { salaryRecordId, userId, amount, bankDetails } = req.body;
  
    try {
      // 1. Validate the salary record
      const salaryRecord = await prisma.salaryRecord.findUnique({
        where: { id: salaryRecordId },
        include: {
          user: {
            include: {
              bankDetails: true
            }
          }
        }
      });
  
      if (!salaryRecord) {
        return res.status(404).json({ message: 'Salary record not found' });
      }
  
      if (salaryRecord.status === 'PAID') {
        return res.status(400).json({ message: 'Salary already paid' });
      }
  
      // 2. Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 3. Store OTP in database (with expiry)
      await prisma.backgroundJob.create({
        data: {
          type: 'NOTIFICATION_DISPATCH',
          status: 'PENDING',
          payload: {
            type: 'SALARY_TRANSACTION_OTP',
            userId,
            otp,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry
          },
          scheduledFor: new Date(),
          priority: 1
        }
      });
  
      // 4. Send OTP via email and SMS
      // Implement your notification service here
  
      res.json({ message: 'OTP sent successfully' });
    } catch (error) {
      console.error('Transaction initiation error:', error);
      res.status(500).json({ message: 'Failed to initiate transaction' });
    }
  });
  
  // Verify OTP and process transaction
  router.post('/verify-transaction', async (req, res) => {
    const { salaryRecordId, otp } = req.body;
  
    try {
      // 1. Verify OTP
      const otpJob = await prisma.backgroundJob.findFirst({
        where: {
          type: 'NOTIFICATION_DISPATCH',
          status: 'PENDING',
          payload: {
            path: ['type'],
            equals: 'SALARY_TRANSACTION_OTP'
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
  
      if (!otpJob || otpJob.payload.otp !== otp) {
        return res.status(400).json({ message: 'Invalid OTP' });
      }
  
      // 2. Get salary record with user details
      const salaryRecord = await prisma.salaryRecord.findUnique({
        where: { id: salaryRecordId },
        include: {
          user: {
            include: {
              bankDetails: true
            }
          }
        }
      });
  
      // 3. Initiate payment gateway transaction
      // Example using a payment gateway:
      // const transfer = await paymentGateway.transfer.create({
      //   account: salaryRecord.user.bankDetails.accountNumber,
      //   amount: salaryRecord.netSalary * 100, // Convert to smallest currency unit
      //   currency: 'INR',
      //   reference_id: salaryRecordId,
      // });
  
      // 4. Update salary record status
      await prisma.salaryRecord.update({
        where: { id: salaryRecordId },
        data: {
          status: 'PAID',
          processedAt: new Date(),
          paymentRef: 'transfer.id', // Use actual payment reference
          paymentMode: 'BANK_TRANSFER'
        }
      });
  
      // 5. Create notification for successful transaction
      await prisma.notification.create({
        data: {
          userId: salaryRecord.userId,
          templateId: 'cm72bckox0001tla4c4w12h3p', // Use your actual template ID
          content: `Your salary of ₹${salaryRecord.netSalary} has been credited to your account`,
          metadata: {
            salaryRecordId,
            month: salaryRecord.month,
            year: salaryRecord.year
          }
        }
      });
  
      res.json({ 
        message: 'Salary transferred successfully',
        transactionId: 'transfer.id' // Use actual transaction ID
      });
    } catch (error) {
      console.error('Transaction processing error:', error);
      res.status(500).json({ message: 'Failed to process transaction' });
    }
  });
  

export default router;