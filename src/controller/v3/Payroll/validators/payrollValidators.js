import prisma from "../../../../db/connectDb.js";

export class PayrollPermissions {
    /**
     * Check if user can view another user's payslip
     */
    static async canViewPayslip(currentUserId, targetUserId) {
        if (currentUserId === targetUserId) {
            // Check self-view permission
            return await this.hasSelfPayslipPermission(currentUserId);
        }

        // Check permission to view other's payslip
        return await this.hasOthersPayslipPermission(currentUserId, targetUserId);
    }

    /**
     * Check if user can generate salary for another user
     */
    static async canGenerateSalary(currentUserId, targetUserId) {
        if (currentUserId === targetUserId) {
            const hasSelfPermission = await prisma.rolePermission.findFirst({
                where: {
                    permission: {
                        key: "generate_salary_to_myself"
                    },
                    role: {
                        users: {
                            some: {
                                userId: currentUserId
                            }
                        }
                    }
                }
            })
            return hasSelfPermission;
        }

        // Check manager permission
        const hasManagerPermission = await prisma.user.findFirst({
            where: {
                id: targetUserId,
                managerId: currentUserId
            }
        });
        const hasAdminPermission = await prisma.rolePermission.findFirst({
            where: {
                permission: {
                    key: "generate_salary_of_all"
                },
                role: {
                    users: {
                        some: {
                            userId: currentUserId
                        }
                    }
                }
            }
        });


        // Check role-based permission


        return !!(hasManagerPermission || hasAdminPermission);
    }

    /**
     * Check if user can view salary statistics
     */
    static async canViewStatistics(currentUserId, salaryRecord) {
        if (currentUserId === salaryRecord.userId) {
            return await this.hasSelfPayslipPermission(currentUserId);
        }

        return await this.hasOthersPayslipPermission(currentUserId, salaryRecord.userId);
    }

    /**
     * Check if user can download payslip
     */
    static async canDownloadPayslip(currentUserId, salaryRecord) {
        return await this.canViewStatistics(currentUserId, salaryRecord);
    }

    // Private helper methods
    static async hasSelfPayslipPermission(userId) {
        const hasSelfPermission = await prisma.rolePermission.findFirst({
            where: {
                permission: {
                    key: "view_salary_slip_to_myself"
                },
                role: {
                    users: {
                        some: {
                            userId: userId
                        }
                    }
                }
            }
        });

        return !!hasSelfPermission;
    }

    static async hasOthersPayslipPermission(currentUserId, targetUserId) {
        // Check if user is a manager of the target user
        const hasManagerPermission = await prisma.user.findFirst({
            where: {
                id: targetUserId,
                managerId: currentUserId
            }
        });

        // Check subordinate permission
        const hasSubordinatePermission = await prisma.rolePermission.findFirst({
            where: {
                permission: {
                    key: "view_salary_slip_of_subordinates"
                },
                role: {
                    users: {
                        some: {
                            userId: currentUserId
                        }
                    }
                }
            }
        });

        // Check view all permission
        const hasAllPermission = await prisma.rolePermission.findFirst({
            where: {
                permission: {
                    key: "view_salary_slip_of_all"
                },
                role: {
                    users: {
                        some: {
                            userId: currentUserId
                        }
                    }
                }
            }
        });

        return !!((hasManagerPermission && hasSubordinatePermission) || hasAllPermission);
    }
}

/**
 * Validation utilities
 */
export class PayrollValidators {
    /**
     * Validate month and year parameters
     */
    static validateMonthYear(month, year) {
        if (!month || !year) {
            throw new Error("Month and year are required");
        }

        const monthNum = parseInt(month);
        const yearNum = parseInt(year);

        if (monthNum < 1 || monthNum > 12) {
            throw new Error("Month must be between 1 and 12");
        }

        if (yearNum < 2000 || yearNum > 2100) {
            throw new Error("Invalid year");
        }

        return { month: monthNum, year: yearNum };
    }

    /**
     * Validate user ID
     */
    static validateUserId(userId) {
        if (!userId || userId === 'undefined') {
            throw new Error("Valid user ID is required");
        }
        return userId;
    }

    /**
     * Validate salary record ID
     */
    static validateSalaryRecordId(salaryRecordId) {
        if (!salaryRecordId) {
            throw new Error("Salary record ID is required");
        }
        return salaryRecordId;
    }

    /**
     * Validate payslip data for multiple checks
     */
    static validatePayslipData(payslipData) {
        if (!Array.isArray(payslipData) || payslipData.length === 0) {
            throw new Error("Payslip data must be a non-empty array");
        }

        for (const data of payslipData) {
            if (!data.userId || !data.month || !data.year) {
                throw new Error("Each payslip data must contain userId, month, and year");
            }
        }

        return payslipData;
    }
}
