import e from 'express';
import permissionRouter from './child/permission.router.js';
import settingRouter from './child/settings.router.js';
import payslipRouter from './child/payroll.router.js';
import presetRouter from './child/PermissionPreset.router.js';
import attendanceRoutes from './child/attendance.router.js';
import employmentTypeRouter from './child/employmentType.router.js';
import userStatusRouter from './child/userStatus.router.js';
const router = e.Router();

router.use("/permission/",permissionRouter)
router.use("/settings/",settingRouter)
router.use("/payroll/",payslipRouter)
router.use("/permission-preset/",presetRouter)
router.use('/attendance', attendanceRoutes);
router.use('/employment-type', employmentTypeRouter);
router.use('/users', userStatusRouter);

// V3 API health check
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'API v3 is healthy',
        version: '3.0.0',
        features: {
            comprehensiveAttendanceSystem: 'active',
            progressiveDeductionEngine: 'active',
            realTimeGeofencing: 'active',
            breakManagement: 'active',
            alertSystem: 'active',
            advancedAnalytics: 'active'
        },
        timestamp: new Date().toISOString()
    });
});

export default router;