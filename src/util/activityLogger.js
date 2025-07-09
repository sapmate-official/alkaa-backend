import prisma from '../db/connectDb.js';

/**
 * Activity logging utility for tracking user actions across the system
 * This allows managers and admins to see what their subordinates are doing
 */

/**
 * Log an activity performed by a user
 * @param {Object} params - Activity parameters
 * @param {string} params.orgId - Organization ID
 * @param {string} params.actorId - ID of user who performed the action
 * @param {string} params.targetId - ID of user who was affected (optional)
 * @param {string} params.action - Action performed (from ActivityAction enum)
 * @param {string} params.entity - Entity type affected (from ActivityEntity enum)
 * @param {string} params.entityId - ID of the affected entity
 * @param {string} params.description - Human-readable description
 * @param {Object} params.metadata - Additional data (optional)
 * @param {string} params.ipAddress - IP address (optional)
 * @param {string} params.userAgent - User agent (optional)
 */
export const logActivity = async ({
    orgId,
    actorId,
    targetId = null,
    action,
    entity,
    entityId,
    description,
    metadata = null,
    ipAddress = null,
    userAgent = null
}) => {
    try {
        await prisma.activityLog.create({
            data: {
                orgId,
                actorId,
                targetId,
                action,
                entity,
                entityId,
                description,
                metadata,
                ipAddress,
                userAgent
            }
        });
    } catch (error) {
        console.error('Failed to log activity:', error);
        // Don't throw error to avoid breaking main functionality
    }
};

/**
 * Log user profile changes
 */
export const logProfileChange = async (actorId, targetId, orgId, changes, req = null) => {
    const changeDetails = Object.keys(changes).map(field => {
        const oldValue = changes[field].old;
        const newValue = changes[field].new;
        return `${field}: "${oldValue}" → "${newValue}"`;
    }).join(', ');

    await logActivity({
        orgId,
        actorId,
        targetId,
        action: 'UPDATE',
        entity: 'USER',
        entityId: targetId,
        description: `Profile updated: ${changeDetails}`,
        metadata: { changes },
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent']
    });
};

/**
 * Log role changes
 */
export const logRoleChange = async (actorId, targetId, orgId, oldRole, newRole, req = null) => {
    await logActivity({
        orgId,
        actorId,
        targetId,
        action: 'CHANGE_ROLE',
        entity: 'USER',
        entityId: targetId,
        description: `Role changed from "${oldRole}" to "${newRole}"`,
        metadata: { oldRole, newRole },
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent']
    });
};

/**
 * Log department changes
 */
export const logDepartmentChange = async (actorId, targetId, orgId, oldDepartment, newDepartment, req = null) => {
    await logActivity({
        orgId,
        actorId,
        targetId,
        action: 'CHANGE_DEPARTMENT',
        entity: 'USER',
        entityId: targetId,
        description: `Department changed from "${oldDepartment}" to "${newDepartment}"`,
        metadata: { oldDepartment, newDepartment },
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent']
    });
};

/**
 * Log manager changes
 */
export const logManagerChange = async (actorId, targetId, orgId, oldManager, newManager, req = null) => {
    await logActivity({
        orgId,
        actorId,
        targetId,
        action: 'CHANGE_MANAGER',
        entity: 'USER',
        entityId: targetId,
        description: `Manager changed from "${oldManager}" to "${newManager}"`,
        metadata: { oldManager, newManager },
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent']
    });
};

/**
 * Log attendance actions
 */
export const logAttendanceAction = async (actorId, orgId, action, attendanceId, description, req = null) => {
    await logActivity({
        orgId,
        actorId,
        targetId: actorId, // For attendance, target is usually the same as actor
        action,
        entity: 'ATTENDANCE',
        entityId: attendanceId,
        description,
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent']
    });
};

/**
 * Log attendance verification by managers
 */
export const logAttendanceVerification = async (actorId, targetId, orgId, attendanceId, status, req = null) => {
    await logActivity({
        orgId,
        actorId,
        targetId,
        action: 'VERIFY_ATTENDANCE',
        entity: 'ATTENDANCE',
        entityId: attendanceId,
        description: `Attendance ${status.toLowerCase()} for employee`,
        metadata: { verificationStatus: status },
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent']
    });
};

/**
 * Log leave request actions
 */
export const logLeaveAction = async (actorId, targetId, orgId, action, leaveId, description, req = null) => {
    await logActivity({
        orgId,
        actorId,
        targetId,
        action,
        entity: 'LEAVE_REQUEST',
        entityId: leaveId,
        description,
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent']
    });
};

/**
 * Log salary/payroll actions
 */
export const logSalaryAction = async (actorId, targetId, orgId, action, salaryId, description, metadata = null, req = null) => {
    await logActivity({
        orgId,
        actorId,
        targetId,
        action,
        entity: 'SALARY_RECORD',
        entityId: salaryId,
        description,
        metadata,
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent']
    });
};

/**
 * Log sensitive data access
 */
export const logSensitiveDataAccess = async (actorId, targetId, orgId, dataType, req = null) => {
    await logActivity({
        orgId,
        actorId,
        targetId,
        action: 'VIEW_SENSITIVE_DATA',
        entity: 'USER',
        entityId: targetId,
        description: `Accessed ${dataType} information`,
        metadata: { dataType },
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent']
    });
};

/**
 * Log user creation
 */
export const logUserCreation = async (actorId, targetId, orgId, req = null) => {
    await logActivity({
        orgId,
        actorId,
        targetId,
        action: 'CREATE',
        entity: 'USER',
        entityId: targetId,
        description: 'New user account created',
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent']
    });
};

/**
 * Log user status changes (activate/deactivate)
 */
export const logUserStatusChange = async (actorId, targetId, orgId, oldStatus, newStatus, req = null) => {
    const action = newStatus === 'active' ? 'ACTIVATE' : 'DEACTIVATE';
    await logActivity({
        orgId,
        actorId,
        targetId,
        action,
        entity: 'USER',
        entityId: targetId,
        description: `User status changed from "${oldStatus}" to "${newStatus}"`,
        metadata: { oldStatus, newStatus },
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent']
    });
};

/**
 * Log login/logout activities
 */
export const logAuthActivity = async (userId, orgId, action, req = null) => {
    await logActivity({
        orgId,
        actorId: userId,
        action,
        entity: 'USER',
        entityId: userId,
        description: action === 'LOGIN' ? 'User logged in' : 'User logged out',
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent']
    });
};

/**
 * Log user deletion
 */
export const logUserDeletion = async (actorId, targetId, orgId, userInfo, req = null) => {
    await logActivity({
        orgId,
        actorId,
        action: 'DELETE_USER',
        entity: 'USER',
        entityId: targetId,
        description: `User deleted: ${userInfo.firstName} ${userInfo.lastName} (${userInfo.email})`,
        metadata: {
            deletedUser: {
                employeeId: userInfo.employeeId,
                department: userInfo.department?.name || 'None',
                roles: userInfo.roles?.map(r => r.role?.name).join(', ') || 'None'
            }
        },
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent']
    });
};

export default {
    logActivity,
    logProfileChange,
    logRoleChange,
    logDepartmentChange,
    logManagerChange,
    logAttendanceAction,
    logAttendanceVerification,
    logLeaveAction,
    logSalaryAction,
    logSensitiveDataAccess,
    logUserCreation,
    logUserStatusChange,
    logAuthActivity,
    logUserDeletion
};
