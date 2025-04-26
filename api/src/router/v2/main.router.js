import express from "express";
import organizationRouter from "./child/organization.router.js";
import departmentRouter from "./child/department.router.js";
import userRouter from "./child/user.router.js";
import bankRouter from "./child/bank.router.js";
import leaveTypeRouter from "./child/leaveType.router.js";
import leaveBalanceRouter from "./child/leaveBalance.router.js";
import leaveRequestRouter from "./child/leaveRequest.router.js";
import attendanceRouter from "./child/attendance.router.js";
import salaryRouter from "./child/salary.router.js";
import superAdminRouter from "./child/superAdmin.router.js";
import roleRouter from "./child/role.router.js";
import permissionRouter from "./child/permission.router.js";
import rolePermissionRouter from "./child/rolePermission.router.js";
import userRoleRouter from "./child/userRole.router.js";
import holidayRouter from "./child/holiday.router.js";
import holidayTypeRouter from "./child/holidayType.router.js";
import payrollRouter from "./child/payroll.router.js"
import notificationRouter from "./child/notification.router.js"
import screenRouter from "./child/screen.router.js"

const router = express.Router();

router.use("/organization/",organizationRouter);
router.use("/department/",departmentRouter);
router.use("/user/",userRouter);
router.use("/bank-details/",bankRouter);
router.use("/leave-type/",leaveTypeRouter)
router.use("/leave-balance/",leaveBalanceRouter)
router.use("/leave-request/",leaveRequestRouter)
router.use("/attendance/",attendanceRouter)
router.use("/salary/",salaryRouter)
router.use("/super-admin/",superAdminRouter)
router.use("/role/",roleRouter)
router.use("/permission/",permissionRouter)
router.use("role-permission/",rolePermissionRouter)
router.use("/user-role/",userRoleRouter)
router.use("/holiday/",holidayRouter)
router.use("/holiday-type/",holidayTypeRouter)
router.use("/payroll/",payrollRouter)
router.use("/notification/",notificationRouter)
router.use("/screen/",screenRouter)

export default router;