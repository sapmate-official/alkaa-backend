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
     * Validate month and year parameters with enhanced validation
     */
    static validateMonthYear(month, year) {
        // Convert to numbers and validate
        const validMonth = parseInt(month);
        const validYear = parseInt(year);

        // Comprehensive validation
        if (!month || !year) {
            throw new Error("Month and year are required parameters");
        }

        if (isNaN(validMonth) || isNaN(validYear)) {
            throw new Error("Month and year must be valid numbers");
        }

        if (validMonth < 1 || validMonth > 12) {
            throw new Error("Month must be between 1 and 12");
        }

        const currentYear = new Date().getFullYear();
        if (validYear < 2000 || validYear > currentYear + 1) {
            throw new Error(`Year must be between 2000 and ${currentYear + 1}`);
        }

        // Check if trying to generate future salary (beyond current month)
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
        const currentYearNow = now.getFullYear();
        
        if (validYear > currentYearNow || (validYear === currentYearNow && validMonth > currentMonth)) {
            throw new Error("Cannot generate salary for future months");
        }

        return { month: validMonth, year: validYear };
    }

    /**
     * Validate user ID with enhanced checks
     */
    static validateUserId(userId) {
        if (!userId || userId === 'undefined' || userId === 'null') {
            throw new Error("Valid user ID is required");
        }

        if (typeof userId !== 'string' || userId.length < 10) {
            throw new Error("Invalid user ID format");
        }

        return userId;
    }

    /**
     * Validate salary record ID with enhanced checks
     */
    static validateSalaryRecordId(salaryRecordId) {
        if (!salaryRecordId) {
            throw new Error("Salary record ID is required");
        }

        if (typeof salaryRecordId !== 'string' || salaryRecordId.length < 10) {
            throw new Error("Invalid salary record ID format");
        }

        return salaryRecordId;
    }

    /**
     * Validate payslip data for bulk operations with enhanced validation
     */
    static validatePayslipData(payslipData) {
        if (!Array.isArray(payslipData)) {
            throw new Error("Payslip data must be an array");
        }

        if (payslipData.length === 0) {
            throw new Error("Payslip data array cannot be empty");
        }

        if (payslipData.length > 100) {
            throw new Error("Cannot process more than 100 payslips at once");
        }

        // Validate each item
        const validatedData = payslipData.map((item, index) => {
            if (!item.userId || !item.month || !item.year) {
                throw new Error(`Invalid data at index ${index}: userId, month, and year are required`);
            }

            const { month, year } = this.validateMonthYear(item.month, item.year);
            const userId = this.validateUserId(item.userId);
            
            return {
                userId: userId,
                month: month,
                year: year
            };
        });

        return validatedData;
    }

    /**
     * Validate user input to prevent injection attacks
     */
    static sanitizeInput(input) {
        if (typeof input !== 'string') {
            return input;
        }

        // Remove potentially dangerous characters
        return input.replace(/[<>\"'%;()&+]/g, '');
    }

    /**
     * Validate email format
     */
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            throw new Error("Invalid email format");
        }
        return email.toLowerCase();
    }

    /**
     * Validate salary amount
     */
    static validateSalaryAmount(amount) {
        const numAmount = parseFloat(amount);
        
        if (isNaN(numAmount)) {
            throw new Error("Salary amount must be a valid number");
        }

        if (numAmount < 0) {
            throw new Error("Salary amount cannot be negative");
        }

        if (numAmount > 10000000) { // 1 crore limit
            throw new Error("Salary amount exceeds maximum allowed limit");
        }

        return numAmount;
    }

    /**
     * Validate file upload parameters
     */
    static validateFileUpload(file) {
        if (!file) {
            throw new Error("File is required");
        }

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.mimetype)) {
            throw new Error("Invalid file type. Only PDF, JPEG, and PNG are allowed");
        }

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            throw new Error("File size cannot exceed 5MB");
        }

        return file;
    }
}
