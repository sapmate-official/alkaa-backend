-- =====================================================
-- SAFE MIGRATION SCRIPT - NO DATA LOSS
-- Adds comprehensive attendance system to existing database
-- All changes are ADDITIVE ONLY - no existing data affected
-- =====================================================

-- STEP 1: Create new enums for attendance system
CREATE TYPE "AttendanceRuleType" AS ENUM ('LATE_ARRIVAL', 'EARLY_DEPARTURE', 'MINIMUM_HOURS', 'BREAK_VIOLATION', 'GEOFENCE_VIOLATION', 'ABSENTEEISM');
CREATE TYPE "ViolationSeverity" AS ENUM ('WARNING', 'MINOR', 'MAJOR', 'CRITICAL');
CREATE TYPE "GeofenceType" AS ENUM ('MAIN_OFFICE', 'BRANCH_OFFICE', 'CLIENT_SITE', 'REMOTE_ZONE');
CREATE TYPE "LocationValidationType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'PERIODIC', 'MANUAL', 'BREAK_START', 'BREAK_END');
CREATE TYPE "BreakType" AS ENUM ('LUNCH', 'TEA_BREAK', 'PERSONAL', 'MEDICAL', 'UNAUTHORIZED');
CREATE TYPE "BreakStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PenaltyStatus" AS ENUM ('PENDING', 'APPLIED', 'REVERSED', 'APPROVED');
CREATE TYPE "AlertPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "LocationActionType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'BREAK_START', 'BREAK_END');
CREATE TYPE "ShiftStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TEMPORARY');

-- STEP 2: Add new columns to existing OrganizationSettings table
-- All columns have safe defaults, no existing data affected
ALTER TABLE "OrganizationSettings" 
ADD COLUMN "alertConfiguration" JSONB,
ADD COLUMN "attendanceRules" JSONB,
ADD COLUMN "breakPolicies" JSONB,
ADD COLUMN "breakRules" JSONB,
ADD COLUMN "geofencingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "penaltySystem" JSONB;

-- STEP 3: Create new attendance system tables
-- All tables are new additions, no existing data affected

CREATE TABLE "OrganizationAttendanceRules" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ruleType" "AttendanceRuleType" NOT NULL,
    "threshold" JSONB NOT NULL,
    "penalty" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationAttendanceRules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceRuleViolation" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "violationType" TEXT NOT NULL,
    "severity" "ViolationSeverity" NOT NULL,
    "penaltyAmount" DECIMAL(10,2),
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceRuleViolation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationGeofence" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GeofenceType" NOT NULL,
    "coordinates" JSONB NOT NULL,
    "radius" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "strictMode" BOOLEAN NOT NULL DEFAULT false,
    "allowedDeviation" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationGeofence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LocationValidationLog" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "geofenceId" TEXT,
    "isValid" BOOLEAN NOT NULL,
    "deviation" DECIMAL(10,2),
    "validationType" "LocationValidationType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocationValidationLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BreakRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attendanceId" TEXT,
    "breakType" "BreakType" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "duration" JSONB,
    "status" "BreakStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "approvedBy" TEXT,
    "violation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BreakRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationBreakRules" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "breakType" TEXT NOT NULL,
    "maxDuration" INTEGER NOT NULL,
    "maxFrequency" INTEGER,
    "timeWindow" JSONB,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "penaltyPerMinute" DECIMAL(5,2),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationBreakRules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgressivePenaltyHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "violationType" TEXT NOT NULL,
    "penaltyAmount" DECIMAL(10,2) NOT NULL,
    "progressiveMultiplier" DECIMAL(5,2) NOT NULL,
    "violationCount" INTEGER NOT NULL,
    "dateApplied" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payrollMonth" INTEGER NOT NULL,
    "payrollYear" INTEGER NOT NULL,
    "status" "PenaltyStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    CONSTRAINT "ProgressivePenaltyHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "priority" "AlertPriority" NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "sentChannels" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    CONSTRAINT "AttendanceAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeofenceViolation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attendanceId" TEXT,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "distance" DECIMAL(10,2) NOT NULL,
    "geofenceId" TEXT NOT NULL,
    "action" "LocationActionType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeofenceViolation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShiftTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "totalHours" DECIMAL(4,2) NOT NULL,
    "lateThreshold" INTEGER NOT NULL DEFAULT 15,
    "breakConfiguration" JSONB,
    "overtimeRules" JSONB,
    "attendanceRules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShiftTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeShift" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftTemplateId" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "ShiftStatus" NOT NULL DEFAULT 'ACTIVE',
    "overrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmployeeShift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShiftComplianceRecord" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "expectedStartTime" TIMESTAMP(3) NOT NULL,
    "expectedEndTime" TIMESTAMP(3) NOT NULL,
    "actualStartTime" TIMESTAMP(3),
    "actualEndTime" TIMESTAMP(3),
    "complianceScore" DECIMAL(5,2),
    "violations" JSONB,
    "penalties" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftComplianceRecord_pkey" PRIMARY KEY ("id")
);

-- STEP 4: Create indexes for optimal performance
CREATE INDEX "OrganizationAttendanceRules_orgId_ruleType_isActive_idx" ON "OrganizationAttendanceRules"("orgId", "ruleType", "isActive");
CREATE INDEX "AttendanceRuleViolation_attendanceId_idx" ON "AttendanceRuleViolation"("attendanceId");
CREATE INDEX "AttendanceRuleViolation_ruleId_idx" ON "AttendanceRuleViolation"("ruleId");
CREATE INDEX "AttendanceRuleViolation_violationType_createdAt_idx" ON "AttendanceRuleViolation"("violationType", "createdAt");
CREATE INDEX "OrganizationGeofence_orgId_isActive_idx" ON "OrganizationGeofence"("orgId", "isActive");
CREATE INDEX "LocationValidationLog_attendanceId_idx" ON "LocationValidationLog"("attendanceId");
CREATE INDEX "LocationValidationLog_timestamp_idx" ON "LocationValidationLog"("timestamp");
CREATE INDEX "BreakRecord_userId_startTime_idx" ON "BreakRecord"("userId", "startTime");
CREATE INDEX "BreakRecord_attendanceId_idx" ON "BreakRecord"("attendanceId");
CREATE INDEX "OrganizationBreakRules_orgId_isActive_idx" ON "OrganizationBreakRules"("orgId", "isActive");
CREATE UNIQUE INDEX "OrganizationBreakRules_orgId_breakType_key" ON "OrganizationBreakRules"("orgId", "breakType");
CREATE INDEX "ProgressivePenaltyHistory_userId_payrollMonth_payrollYear_idx" ON "ProgressivePenaltyHistory"("userId", "payrollMonth", "payrollYear");
CREATE INDEX "ProgressivePenaltyHistory_violationType_dateApplied_idx" ON "ProgressivePenaltyHistory"("violationType", "dateApplied");
CREATE INDEX "AttendanceAlert_userId_isRead_createdAt_idx" ON "AttendanceAlert"("userId", "isRead", "createdAt");
CREATE INDEX "AttendanceAlert_priority_createdAt_idx" ON "AttendanceAlert"("priority", "createdAt");
CREATE INDEX "GeofenceViolation_userId_timestamp_idx" ON "GeofenceViolation"("userId", "timestamp");
CREATE INDEX "GeofenceViolation_geofenceId_timestamp_idx" ON "GeofenceViolation"("geofenceId", "timestamp");
CREATE INDEX "ShiftTemplate_orgId_isActive_idx" ON "ShiftTemplate"("orgId", "isActive");
CREATE UNIQUE INDEX "ShiftTemplate_orgId_name_key" ON "ShiftTemplate"("orgId", "name");
CREATE INDEX "EmployeeShift_userId_status_idx" ON "EmployeeShift"("userId", "status");
CREATE INDEX "EmployeeShift_shiftTemplateId_idx" ON "EmployeeShift"("shiftTemplateId");
CREATE INDEX "ShiftComplianceRecord_attendanceId_idx" ON "ShiftComplianceRecord"("attendanceId");
CREATE INDEX "ShiftComplianceRecord_shiftId_idx" ON "ShiftComplianceRecord"("shiftId");

-- STEP 5: Add foreign key constraints for data integrity
ALTER TABLE "OrganizationAttendanceRules" ADD CONSTRAINT "OrganizationAttendanceRules_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRuleViolation" ADD CONSTRAINT "AttendanceRuleViolation_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "AttendanceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRuleViolation" ADD CONSTRAINT "AttendanceRuleViolation_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "OrganizationAttendanceRules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRuleViolation" ADD CONSTRAINT "AttendanceRuleViolation_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationGeofence" ADD CONSTRAINT "OrganizationGeofence_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LocationValidationLog" ADD CONSTRAINT "LocationValidationLog_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "AttendanceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LocationValidationLog" ADD CONSTRAINT "LocationValidationLog_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "OrganizationGeofence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BreakRecord" ADD CONSTRAINT "BreakRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BreakRecord" ADD CONSTRAINT "BreakRecord_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "AttendanceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BreakRecord" ADD CONSTRAINT "BreakRecord_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationBreakRules" ADD CONSTRAINT "OrganizationBreakRules_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgressivePenaltyHistory" ADD CONSTRAINT "ProgressivePenaltyHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceAlert" ADD CONSTRAINT "AttendanceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeofenceViolation" ADD CONSTRAINT "GeofenceViolation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeofenceViolation" ADD CONSTRAINT "GeofenceViolation_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "AttendanceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GeofenceViolation" ADD CONSTRAINT "GeofenceViolation_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "OrganizationGeofence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeShift" ADD CONSTRAINT "EmployeeShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeShift" ADD CONSTRAINT "EmployeeShift_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "ShiftTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShiftComplianceRecord" ADD CONSTRAINT "ShiftComplianceRecord_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "AttendanceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShiftComplianceRecord" ADD CONSTRAINT "ShiftComplianceRecord_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "EmployeeShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================
-- MIGRATION COMPLETE - NO DATA LOSS
-- All existing data preserved, new attendance system added
-- =====================================================
