import prisma from "../../../db/connectDb";
export class PayrollService {
  async calculateSalary(userId, month, year) {
    try {
      // Get user details
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
          }
        }
      });

      if (!user) throw new Error('User not found');

      // Calculate basic salary (monthly)
      const basicSalary = user.monthlySalary || 0;

      // Calculate allowances (example: 40% of basic salary)
      const allowances = {
        hra: basicSalary * 0.4,
        da: basicSalary * 0.1,
        ta: basicSalary * 0.1
      };

      // Calculate deductions based on leaves and attendance
      const workingDays = this.getWorkingDays(month, year);
      const leaveDeductions = this.calculateLeaveDeductions(user.leaveRequests, basicSalary, workingDays);
      
      // Calculate tax (example: 10% of basic salary)
      const tax = basicSalary * 0.1;

      // Calculate other deductions (PF, insurance, etc.)
      const deductions = {
        pf: basicSalary * 0.12,
        insurance: 1000,
        leaveDeductions,
        tax
      };

      // Calculate net salary
      const totalAllowances = Object.values(allowances).reduce((a, b) => a + b, 0);
      const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0);
      const netSalary = basicSalary + totalAllowances - totalDeductions;

      // Create salary record
      const salaryRecord = await prisma.salaryRecord.create({
        data: {
          userId,
          month,
          year,
          basicSalary,
          allowances,
          deductions,
          tax,
          netSalary,
          status: 'PENDING'
        }
      });

      return salaryRecord;
    } catch (error) {
      throw new Error(`Error calculating salary: ${error.message}`);
    }
  }

  getWorkingDays(month, year) {
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

    return workingDays;
  }

  calculateLeaveDeductions(leaves, basicSalary, workingDays) {
    const perDaySalary = basicSalary / workingDays;
    let deduction = 0;

    leaves.forEach(leave => {
      if (!leave.leaveType.isPaid) {
        deduction += leave.numberOfDays * perDaySalary;
      }
    });

    return deduction;
  }
}

