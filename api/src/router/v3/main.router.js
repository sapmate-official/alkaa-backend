import e from 'express';
import permissionRouter from './child/permission.router.js';
import settingRouter from './child/settings.router.js';
import payslipRouter from './child/payroll.router.js';

const router = e.Router();

router.use("/permission/",permissionRouter)
router.use("/settings/",settingRouter)
router.use("/payroll/",payslipRouter)


export default router;