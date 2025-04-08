import express from "express";
import prisma from "../../../db/connectDb.js";
import validateToken from "../../../middleware/validateToken.js";

const router = express.Router();

export class PayrollService {
  async calculateSalary(userId, month, year) {
    try {
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
      console.log('Salary parameters:', params);
      

      
      const basicSalary = user.monthlySalary || 0;
      console.log('Basic salary:', basicSalary);

      
      const allowances = {
        hra: basicSalary * (params.hraPercentage / 100),
        da: basicSalary * (params.daPercentage / 100),
        ta: basicSalary * (params.taPercentage / 100),
        ...params.additionalAllowances
      };

      
      const workingDays = await this.getWorkingDays(month, year,userId); 
      const presentDays = user.attendanceRecords.length;
      console.log('Present days:', presentDays);
       // if in working days the employee is absent then we will check for that , on that day employee was on leave or not, if on leave then we will not deduct the salary otherwise we will deduct the salary

      const leaveDeductions = this.calculateLeaveAndAbsentDeductions(user.leaveRequests, basicSalary, workingDays, presentDays);
      console.log('Leave deductions:', leaveDeductions);
      
      
      const deductions = {
        pf: basicSalary * (params.pfPercentage / 100),
        insurance: params.insuranceFixed,
        leaveDeductions,
        tax: basicSalary * (params.taxPercentage / 100),
        ...params.additionalDeductions
      };
      console.log('Total deductions:', deductions);

      
      const totalAllowances = Object.values(allowances).reduce((a, b) => a + b, 0);
      const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0);
      let netSalary = basicSalary + totalAllowances - totalDeductions;
      
      // Prevent negative salary
      if (netSalary < 0) {
        console.log('Warning: Calculated salary was negative, setting to 0 instead');
        netSalary = 0;
      }
      
      console.log('Final calculation:', { totalAllowances, totalDeductions, netSalary });

      
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

  async getWorkingDays(month, year,userId) {
    console.log(`Calculating working days for ${month}/${year}`);
    
    const date = new Date(year, month - 1, 1);
    const days = new Date(year, month, 0).getDate();
    let workingDays = 0;

    console.log(`Month has ${days} total days`);
    const settings = await prisma.user.findUnique({
      where: { id: userId },
      select: { organization:{
        select:{
          OrganizationSettings:true
        }
      } }
    });
console.log('settings:', settings.organization.OrganizationSettings[0].settings);

    const weekOff = settings.organization.OrganizationSettings[0].settings["weekoff"] 
    console.log('Week off days:', weekOff);
    const isWeekend = weekOff.includes(date.getDay());
    
    
    for (let i = 1; i <= days; i++) {
      date.setDate(i);
      const dayOfWeek = date.getDay();
      const isWeekoff = weekOff.includes(dayOfWeek);
      
      console.log(`Day ${i}: ${date.toDateString()}, day of week: ${dayOfWeek}, isWeekend: ${isWeekend}`);
      
      if (!isWeekoff) {
        workingDays++;
      }
    }

    console.log(`Total working days: ${workingDays}`);
    return workingDays;
  }

  calculateLeaveAndAbsentDeductions(leaves, basicSalary, workingDays, presentDays) {
    console.log('Calculating leave deductions:', { leaves: leaves.length, basicSalary, workingDays });
    const perDaySalary = basicSalary / workingDays;
    console.log('Per day salary:', perDaySalary);
    
    const absentDays = workingDays - presentDays;
    console.log('Absent days:', absentDays);

    let deduction = 0;
    if(absentDays > 0) {
 
    deduction += absentDays * perDaySalary;
    }
    console.log('Absent deduction:', deduction);

    leaves.forEach(leave => {
      console.log('Processing leave:', { leaveId: leave.id, days: leave.numberOfDays, isPaid: leave.leaveType.isPaid });
      if (!leave.leaveType.isPaid) {
        deduction += leave.numberOfDays * perDaySalary;
      }
    });

    console.log('Total leave deduction:', deduction);
    return deduction;
  }

  async getEmployeePayrollStatistics(userId, month, year) {
    try {
      const monthValue = month ? parseInt(month) : null;
      const yearValue = year ? parseInt(year) : null;
  
      const salaryRecordsWithData = await prisma.salaryRecord.findMany({
        where: {
          userId,
          ...(monthValue ? { month: monthValue } : {}),
          ...(yearValue ? { year: yearValue } : {})
        },
        include: {
          user: {
            include: {
              attendanceRecords: {
                where: {
                  ...(monthValue && yearValue ? {
                    AND: [
                      { date: { gte: new Date(yearValue, monthValue - 1, 1) } },
                      { date: { lt: new Date(yearValue, monthValue, 1) } }
                    ]
                  } : {})
                }
              },
              leaveRequests: {
                where: {
                  ...(monthValue && yearValue ? {
                    AND: [
                      { 
                        OR: [
                          { startDate: { gte: new Date(yearValue, monthValue - 1, 1), lt: new Date(yearValue, monthValue, 1) } },
                          { endDate: { gte: new Date(yearValue, monthValue - 1, 1), lt: new Date(yearValue, monthValue, 1) } }
                        ]
                      }
                    ]
                  } : {}),
                  status: 'APPROVED'
                },
                include: { leaveType: true }
              },
              organization: {
                include: {
                  OrganizationSettings: true,
                  holidays: {
                    where: {
                      ...(monthValue && yearValue ? {
                        date: {
                          gte: new Date(yearValue, monthValue - 1, 1),
                          lt: new Date(yearValue, monthValue, 1)
                        }
                      } : {})
                    }
                  }
                }
              },
              bankDetails: true,
              salaryParameter: true
            }
          }
        }
      });
  
      const userStats = {
        monthlySalaries: [],
        summary: {
          totalEarned: 0,
          totalAttendance: 0,
          totalLeavesTaken: 0,
          paidLeavesTaken: 0,
          unpaidLeavesTaken: 0,
          averageSalary: 0,
          salaryRecords: 0
        },
        bankDetails: salaryRecordsWithData[0]?.user.bankDetails || null,
        salaryParameter: salaryRecordsWithData[0]?.user.salaryParameter || null
      };
  
      for (const record of salaryRecordsWithData) {
        // Process similar to the statistics endpoint
      }
  
      return userStats;
    } catch (error) {
      console.error('Error calculating employee payroll statistics:', error);
      throw error;
    }
  }
}


const payrollService = new PayrollService();


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
router.get("/check-for-extra-days/:userId/:month/:year", async (req, res) => {
  console.log('Checking for extra days for user:', req.params.userId);
  try {
    const { userId,month,year } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        attendanceRecords: {
          where: {
            AND: [
              { date: { gte: new Date(year, month - 1, 1) } },
              { date: { lt: new Date(year, month, 1) } }
            ]
          }
        }
      }
    });
    const presentDays = user.attendanceRecords.length;
    const workingDays = await payrollService.getWorkingDays(month, year,userId);
    const extraDays = presentDays - workingDays;
    if(extraDays > 0) {
      console.log(`Extra days found: ${extraDays}`);
      res.json({ extraDays });
    }
    else {
      console.log('No extra days found');
      res.json({ extraDays: 0 });
    }
  }catch (error) {
    console.error('Error checking for extra days:', error);
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
router.delete('/:id', async (req, res) => {
  console.log('Deleting salary record:', req.params.id);
  try {
    const { id } = req.params;
    const deletedRecord = await prisma.salaryRecord.delete({
      where: { id }
    });
    console.log('Salary record deleted successfully');
    res.json(deletedRecord);
  }
  catch (error) {
    console.error('Error deleting salary record:', error);
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

router.get('/statistics/:userId', async (req, res) => {
  console.log('Fetching salary statistics for user:', req.params.userId);
  try {
    const { userId } = req.params;
    const { month, year } = req.query;
    
    // Parse query parameters
    const monthValue = month ? parseInt(month) : null;
    const yearValue = year ? parseInt(year) : null;

    // Fetch salary records for the specific user
    const salaryRecordsWithData = await prisma.salaryRecord.findMany({
      where: {
        userId,
        ...(monthValue ? { month: monthValue } : {}),
        ...(yearValue ? { year: yearValue } : {})
      },
      include: {
        user: {
          include: {
            attendanceRecords: {
              where: {
                ...(monthValue && yearValue ? {
                  AND: [
                    { date: { gte: new Date(yearValue, monthValue - 1, 1) } },
                    { date: { lt: new Date(yearValue, monthValue, 1) } }
                  ]
                } : {})
              }
            },
            leaveRequests: {
              where: {
                ...(monthValue && yearValue ? {
                  AND: [
                    { 
                      OR: [
                        { startDate: { gte: new Date(yearValue, monthValue - 1, 1), lt: new Date(yearValue, monthValue, 1) } },
                        { endDate: { gte: new Date(yearValue, monthValue - 1, 1), lt: new Date(yearValue, monthValue, 1) } }
                      ]
                    }
                  ]
                } : {}),
                status: 'APPROVED'
              },
              include: { leaveType: true }
            },
            organization: {
              include: {
                OrganizationSettings: true,
                holidays: {
                  where: {
                    ...(monthValue && yearValue ? {
                      date: {
                        gte: new Date(yearValue, monthValue - 1, 1),
                        lt: new Date(yearValue, monthValue, 1)
                      }
                    } : {})
                  }
                }
              }
            }
          }
        }
      }
    });

    // Prepare user statistics report
    const userStats = {
      monthlySalaries: [],
      summary: {
        totalEarned: 0,
        totalAttendance: 0,
        totalLeavesTaken: 0,
        paidLeavesTaken: 0,
        unpaidLeavesTaken: 0,
        averageSalary: 0,
        salaryRecords: 0
      }
    };

    for (const record of salaryRecordsWithData) {
      // Process each salary record
      const monthlySalary = {
        id: record.id,
        month: record.month,
        year: record.year,
        basicSalary: record.basicSalary || 0,
        netSalary: record.netSalary || 0,
        status: record.status,
        processedAt: record.processedAt,
        attendance: record.user.attendanceRecords.length,
        allowances: record.allowances ? 
          Object.entries(record.allowances).map(([key, value]) => ({ type: key, amount: parseFloat(value) || 0 })) : [],
        deductions: record.deductions ? 
          Object.entries(record.deductions).map(([key, value]) => ({ type: key, amount: parseFloat(value) || 0 })) : [],
        tax: record.tax || 0
      };

      // Calculate leaves taken in this month
      const leaves = record.user.leaveRequests || [];
      let paidLeaves = 0;
      let unpaidLeaves = 0;
      
      leaves.forEach(leave => {
        const leaveCount = leave.numberOfDays || 0;
        if (leave.leaveType.isPaid) {
          paidLeaves += leaveCount;
        } else {
          unpaidLeaves += leaveCount;
        }
      });

      monthlySalary.leavesTaken = {
        total: paidLeaves + unpaidLeaves,
        paid: paidLeaves,
        unpaid: unpaidLeaves
      };

      // Add holidays count if available
      if (record.user.organization?.holidays) {
        monthlySalary.holidays = record.user.organization.holidays.length;
      }

      userStats.monthlySalaries.push(monthlySalary);

      // Update summary statistics
      userStats.summary.totalEarned += record.netSalary || 0;
      userStats.summary.totalAttendance += record.user.attendanceRecords.length;
      userStats.summary.totalLeavesTaken += (paidLeaves + unpaidLeaves);
      userStats.summary.paidLeavesTaken += paidLeaves;
      userStats.summary.unpaidLeavesTaken += unpaidLeaves;
      userStats.summary.salaryRecords++;
    }

    // Calculate average salary if there are records
    if (userStats.summary.salaryRecords > 0) {
      userStats.summary.averageSalary = userStats.summary.totalEarned / userStats.summary.salaryRecords;
    }

    console.log(`Found ${userStats.monthlySalaries.length} salary records for user ${userId}`);
    res.json(userStats);
  } catch (error) {
    console.error('Error calculating user statistics:', error);
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
  
  
  router.post('/bulk-generate', async (req, res) => {
    const { employeeIds, month, year } = req.body;
    
    try {
      
      const results = await prisma.$transaction(async (prisma) => {
        const generatedSalaries = [];
        const errors = [];
  
        for (const employeeId of employeeIds) {
          try {
            
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
    console.log('Updating salary parameters:', { userId, parameters });
    
    const existingParameters = await prisma.salaryParameter.findUnique({
      where: { userId }
    });
    if (existingParameters) {
      console.log('Existing parameters found:', existingParameters);
    } else {
      console.log('No existing parameters found, creating new one');
    }
    
    const salaryParameter = await prisma.salaryParameter.upsert({
      where: { userId },
      update: parameters,
      create: {
        userId,
        ...parameters
      }
    });
    console.log('Salary parameters updated successfully:', salaryParameter);
    
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


router.post('/initiate-transaction', async (req, res) => {
    const { salaryRecordId, userId, amount, bankDetails } = req.body;
  
    try {
      
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
  
      
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      
      await prisma.backgroundJob.create({
        data: {
          type: 'NOTIFICATION_DISPATCH',
          status: 'PENDING',
          payload: {
            type: 'SALARY_TRANSACTION_OTP',
            userId,
            otp,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) 
          },
          scheduledFor: new Date(),
          priority: 1
        }
      });
  
      
      
  
      res.json({ message: 'OTP sent successfully' });
    } catch (error) {
      console.error('Transaction initiation error:', error);
      res.status(500).json({ message: 'Failed to initiate transaction' });
    }
  });
  
  
  router.post('/verify-transaction', async (req, res) => {
    const { salaryRecordId, otp } = req.body;
  
    try {
      
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
  
      
      
      
      
      
      
      
      
  
      
      await prisma.salaryRecord.update({
        where: { id: salaryRecordId },
        data: {
          status: 'PAID',
          processedAt: new Date(),
          paymentRef: 'transfer.id', 
          paymentMode: 'BANK_TRANSFER'
        }
      });
  
      
      await prisma.notification.create({
        data: {
          userId: salaryRecord.userId,
          templateId: 'cm72bckox0001tla4c4w12h3p', 
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
        transactionId: 'transfer.id' 
      });
    } catch (error) {
      console.error('Transaction processing error:', error);
      res.status(500).json({ message: 'Failed to process transaction' });
    }
  });
  

  router.post("/complete-transaction", validateToken, async (req, res) => {
    try {
      const { salaryRecordId, transactionId, mode, incentive, bonus, remarks } = req.body;
      const senderUserId = req.user.id;
      
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
      
      // Calculate the amount correctly
      const incentiveAmount = incentive ? parseFloat(incentive) : 0;
      const bonusAmount = bonus ? parseFloat(bonus) : 0;
      const totalAmount = salaryRecord.netSalary + incentiveAmount + bonusAmount;
      
      // Create transaction record
      const transaction = await prisma.transactionTable.create({
        data: {
          senderUserId,
          recieverUserId: salaryRecord.userId,
          amount: totalAmount,
          bankTransactionId: transactionId,
          type: 'SALARY'
        }
      });
      
      // Link transaction to salary record
      await prisma.salaryTransactionTable.create({
        data: {
          salaryRecordId,
          transactionId: transaction.id
        }
      });
      
      // Update salary record status
      await prisma.salaryRecord.update({
        where: { id: salaryRecordId },
        data: {
          status: 'PAID',
          processedAt: new Date(),
          paymentMode: mode,
          remarks: remarks,
          incentive: incentiveAmount,
          bonus: bonus,
        }
      });
      
      // Send success response
      res.status(200).json({
        message: 'Transaction completed successfully',
        transactionId: transaction.id
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: error.message });
    }
  });

// Route for managers to get payroll information about their direct reports
router.get('/manager/employees', validateToken, async (req, res) => {
  try {
    const managerId = req.user.id;
    
    const employees = await prisma.user.findMany({
      where: { 
        managerId 
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        status: true
      }
    });
    
    if (!employees.length) {
      return res.status(200).json({ employees: [], message: "No employees found" });
    }
    
    const employeeIds = employees.map(emp => emp.id);
    const salaryRecords = await prisma.salaryRecord.findMany({
      where: {
        userId: { in: employeeIds }
      },
      orderBy: { 
        year: 'desc',
        month: 'desc' 
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            employeeId: true
          }
        }
      }
    });
    
    const employeePayrollData = employeeIds.map(employeeId => {
      const employeeRecords = salaryRecords.filter(record => record.userId === employeeId);
      const employee = employees.find(emp => emp.id === employeeId);
      
      return {
        employee: {
          id: employeeId,
          name: `${employee.firstName} ${employee.lastName}`,
          employeeId: employee.employeeId,
          status: employee.status
        },
        salaryRecords: employeeRecords
      };
    });
    
    res.json({ employeePayrollData });
  } catch (error) {
    console.error('Error fetching manager employees payroll:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route for admins to get payroll information about all employees in an organization
router.get('/admin/all-employees/:orgId', validateToken, async (req, res) => {
  try {
    const { orgId } = req.params;
    const { month, year } = req.query;
    
    const userWithRoles = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    const hasViewAllPermission = userWithRoles.roles.some(userRole => 
      userRole.role.permissions.some(perm => 
        perm.permission?.name === "payroll.view_all"
      )
    );
    
    if (!hasViewAllPermission) {
      return res.status(403).json({ error: "You don't have permission to view all payroll data" });
    }
    
    const employees = await prisma.user.findMany({
      where: { 
        orgId,
        status: 'active' 
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        monthlySalary: true,
        departmentId: true,
        department: true
      },
      orderBy: {
        firstName: 'asc'
      }
    });
    
    if (!employees.length) {
      return res.status(200).json({ employees: [], message: "No employees found" });
    }
    
    const employeeIds = employees.map(emp => emp.id);
    const salaryRecordsQuery = {
      where: { 
        userId: { in: employeeIds } 
      },
      orderBy: { 
        processedAt: 'desc'
      }
    };
    
    if (month && year) {
      salaryRecordsQuery.where.month = parseInt(month);
      salaryRecordsQuery.where.year = parseInt(year);
    }
    
    const salaryRecords = await prisma.salaryRecord.findMany(salaryRecordsQuery);
    
    const employeePayrollData = employees.map(employee => {
      const employeeRecords = salaryRecords.filter(record => record.userId === employee.id);
      
      return {
        employee: {
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          employeeId: employee.employeeId,
          department: employee.department?.name || 'Unassigned',
          monthlySalary: employee.monthlySalary
        },
        salaryRecords: employeeRecords.map(record => ({
          id: record.id,
          month: record.month,
          year: record.year,
          netSalary: record.netSalary,
          status: record.status,
          processedAt: record.processedAt
        }))
      };
    });
    
    res.json({ employeePayrollData });
  } catch (error) {
    console.error('Error fetching all employees payroll:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route to get detailed payroll information for a specific employee
router.get('/employee/:employeeId', validateToken, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;
    
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { 
        id: true, 
        managerId: true,
        orgId: true
      }
    });
    
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    
    const userWithRoles = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    const isManager = employee.managerId === req.user.id;
    const hasViewAllPermission = userWithRoles.roles.some(userRole => 
      userRole.role.permissions.some(perm => 
        perm.permission?.name === "payroll.view_all"
      )
    );
    
    if (!isManager && !hasViewAllPermission && employee.id !== req.user.id) {
      return res.status(403).json({ error: "You don't have permission to view this employee's payroll data" });
    }
    
    const response = await payrollService.getEmployeePayrollStatistics(employeeId, month, year);
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching employee payroll details:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;