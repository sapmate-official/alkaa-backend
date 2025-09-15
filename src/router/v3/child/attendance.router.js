import express from 'express';
import { authenticateToken } from '../../../middleware/auth.middleware.js';

// Import all attendance controllers
import * as attendanceRulesController from '../../../controller/v3/attendance/attendanceRules.controller.js';
import * as breakManagementController from '../../../controller/v3/attendance/breakManagement.controller.js';
import * as geofencingController from '../../../controller/v3/attendance/geofencing.controller.js';
import * as alertsController from '../../../controller/v3/attendance/alerts.controller.js';
import * as analyticsController from '../../../controller/v3/attendance/analytics.controller.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// =====================================================
// ATTENDANCE RULES ROUTES
// =====================================================

// Get organization attendance rules
router.get('/organizations/:orgId/rules', attendanceRulesController.getOrganizationRules);

// Create or update attendance rule
router.post('/organizations/:orgId/rules', attendanceRulesController.createOrUpdateRule);

// Toggle rule activation status
router.patch('/organizations/:orgId/rules/:ruleId/toggle', attendanceRulesController.toggleRuleStatus);

// Delete attendance rule
router.delete('/organizations/:orgId/rules/:ruleId', attendanceRulesController.deleteRule);

// Process attendance record against rules
router.post('/attendance/:attendanceId/process', attendanceRulesController.processAttendanceRecord);

// Get violation history
router.get('/organizations/:orgId/violations', attendanceRulesController.getViolationHistory);

// Approve or reject violation
router.patch('/violations/:violationId/approve', attendanceRulesController.approveViolation);

// Get rules analytics
router.get('/organizations/:orgId/rules/analytics', attendanceRulesController.getRulesAnalytics);

// Bulk enable/disable rules
router.patch('/organizations/:orgId/rules/bulk', attendanceRulesController.bulkUpdateRules);

// =====================================================
// BREAK MANAGEMENT ROUTES
// =====================================================

// Start a break
router.post('/users/:userId/breaks/start', breakManagementController.startBreak);

// End a break
router.patch('/users/:userId/breaks/:breakId/end', breakManagementController.endBreak);

// Get active break for user
router.get('/users/:userId/breaks/active', breakManagementController.getActiveBreak);

// Get break history for user
router.get('/users/:userId/breaks/history', breakManagementController.getBreakHistory);

// Get organization break analytics
router.get('/organizations/:orgId/breaks/analytics', breakManagementController.getOrganizationBreakAnalytics);

// Configure break policies
router.post('/organizations/:orgId/breaks/policies', breakManagementController.configureBreakPolicies);

// Get break policies
router.get('/organizations/:orgId/breaks/policies', breakManagementController.getBreakPolicies);

// Force end break (manager action)
router.patch('/breaks/:breakId/force-end', breakManagementController.forceEndBreak);

// =====================================================
// GEOFENCING ROUTES
// =====================================================

// Create geofence
router.post('/organizations/:orgId/geofences', geofencingController.createGeofence);

// Get organization geofences
router.get('/organizations/:orgId/geofences', geofencingController.getOrganizationGeofences);

// Update geofence
router.patch('/organizations/:orgId/geofences/:geofenceId', geofencingController.updateGeofence);

// Delete geofence
router.delete('/organizations/:orgId/geofences/:geofenceId', geofencingController.deleteGeofence);

// Validate location
router.post('/organizations/:orgId/geofences/validate', geofencingController.validateLocation);

// Get validation history
router.get('/organizations/:orgId/geofences/validations', geofencingController.getValidationHistory);

// Get geofencing analytics
router.get('/organizations/:orgId/geofences/analytics', geofencingController.getGeofencingAnalytics);

// Get nearby geofences
router.get('/organizations/:orgId/geofences/nearby', geofencingController.getNearbyGeofences);

// Bulk import geofences
router.post('/organizations/:orgId/geofences/bulk-import', geofencingController.bulkImportGeofences);

// =====================================================
// ALERTS ROUTES
// =====================================================

// Get alert configuration
router.get('/organizations/:orgId/alerts/config', alertsController.getAlertConfiguration);

// Update alert configuration
router.patch('/organizations/:orgId/alerts/config', alertsController.updateAlertConfiguration);

// Trigger manual alert
router.post('/organizations/:orgId/alerts/trigger', alertsController.triggerAlert);

// Get organization alerts
router.get('/organizations/:orgId/alerts', alertsController.getOrganizationAlerts);

// Get user alerts
router.get('/users/:userId/alerts', alertsController.getUserAlerts);

// Acknowledge alert
router.patch('/alerts/:alertId/acknowledge', alertsController.acknowledgeAlert);

// Bulk acknowledge alerts
router.patch('/alerts/bulk-acknowledge', alertsController.bulkAcknowledgeAlerts);

// Get alert statistics
router.get('/organizations/:orgId/alerts/statistics', alertsController.getAlertStatistics);

// Test alert system
router.post('/organizations/:orgId/alerts/test', alertsController.testAlertSystem);

// Cleanup old alerts
router.delete('/organizations/:orgId/alerts/cleanup', alertsController.cleanupOldAlerts);

// =====================================================
// ANALYTICS ROUTES
// =====================================================

// Get organization analytics
router.get('/organizations/:orgId/analytics', analyticsController.getOrganizationAnalytics);

// Get employee analytics
router.get('/organizations/:orgId/employees/:userId/analytics', analyticsController.getEmployeeAnalytics);

// Get attendance trends
router.get('/organizations/:orgId/analytics/trends', analyticsController.getAttendanceTrends);

// Generate attendance report
router.post('/organizations/:orgId/analytics/reports', analyticsController.generateAttendanceReport);

// =====================================================
// HEALTH CHECK ROUTE
// =====================================================

router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Attendance system API v3 is healthy',
        timestamp: new Date().toISOString(),
        features: {
            attendanceRules: 'active',
            breakManagement: 'active',
            geofencing: 'active',
            realTimeAlerts: 'active',
            analytics: 'active'
        },
        note: 'All rules are disabled by default. Configure and enable as needed.'
    });
});

export default router;
