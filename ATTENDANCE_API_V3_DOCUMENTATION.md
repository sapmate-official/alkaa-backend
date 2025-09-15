# Comprehensive Attendance System API v3 Documentation

## Overview

The Comprehensive Attendance System provides advanced attendance management with progressive salary deduction rules, break time management, geofencing, and real-time alerts. **All rules are disabled by default** and must be explicitly enabled by organization administrators.

## Base URL
```
/api/v3/attendance
```

## Authentication
All endpoints require authentication via JWT token in header:
```
Authorization: Bearer <token>
```

## Key Features

1. **Progressive Deduction Engine**: Escalating penalties for repeat violations
2. **Break Management**: Comprehensive break tracking with violation detection
3. **Geofencing**: Location-based attendance validation
4. **Real-time Alerts**: Multi-channel notification system
5. **Advanced Analytics**: Detailed reporting and trend analysis

---

## 🔧 Attendance Rules Management

### Get Organization Rules
```http
GET /organizations/{orgId}/rules
```
**Response:**
```json
{
  "success": true,
  "data": {
    "orgId": "org123",
    "rules": [...],
    "note": "All rules are disabled by default. Enable specific rules as needed."
  }
}
```

### Create/Update Rule
```http
POST /organizations/{orgId}/rules
```
**Body:**
```json
{
  "ruleType": "LATE_ARRIVAL",
  "threshold": 15,
  "penalty": 100,
  "isActive": false
}
```

### Toggle Rule Status
```http
PATCH /organizations/{orgId}/rules/{ruleId}/toggle
```

### Process Attendance Record
```http
POST /attendance/{attendanceId}/process
```

### Get Violation History
```http
GET /organizations/{orgId}/violations?userId=&violationType=&fromDate=&toDate=
```

---

## 🕐 Break Management

### Start Break
```http
POST /users/{userId}/breaks/start
```
**Body:**
```json
{
  "breakType": "LUNCH",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  }
}
```

### End Break
```http
PATCH /users/{userId}/breaks/{breakId}/end
```

### Get Active Break
```http
GET /users/{userId}/breaks/active
```

### Get Break History
```http
GET /users/{userId}/breaks/history?fromDate=&toDate=&breakType=
```

### Configure Break Policies
```http
POST /organizations/{orgId}/breaks/policies
```
**Body:**
```json
{
  "maxBreakDuration": 60,
  "maxDailyBreaks": 3,
  "allowedBreakTypes": ["LUNCH", "TEA", "REGULAR"],
  "requiresApproval": false,
  "restrictedHours": ["09:00-10:00", "17:00-18:00"]
}
```

---

## 📍 Geofencing

### Create Geofence
```http
POST /organizations/{orgId}/geofences
```
**Body:**
```json
{
  "name": "Main Office",
  "type": "OFFICE",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "radius": 100,
  "address": "123 Business St, NYC",
  "isActive": true
}
```

### Validate Location
```http
POST /organizations/{orgId}/geofences/validate
```
**Body:**
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "userId": "user123"
}
```

### Get Nearby Geofences
```http
GET /organizations/{orgId}/geofences/nearby?latitude=40.7128&longitude=-74.0060&radius=5000
```

### Bulk Import Geofences
```http
POST /organizations/{orgId}/geofences/bulk-import
```

---

## 🔔 Alert System

### Get Alert Configuration
```http
GET /organizations/{orgId}/alerts/config
```

### Update Alert Configuration
```http
PATCH /organizations/{orgId}/alerts/config
```
**Body:**
```json
{
  "enableRealTimeAlerts": false,
  "alertChannels": {
    "email": false,
    "sms": false,
    "push": false,
    "dashboard": true
  },
  "alertTypes": {
    "lateArrival": { "enabled": false, "threshold": 15 },
    "geofenceViolation": { "enabled": false }
  }
}
```

### Trigger Manual Alert
```http
POST /organizations/{orgId}/alerts/trigger
```

### Get Organization Alerts
```http
GET /organizations/{orgId}/alerts?type=&severity=&status=
```

### Acknowledge Alert
```http
PATCH /alerts/{alertId}/acknowledge
```

### Test Alert System
```http
POST /organizations/{orgId}/alerts/test
```

---

## 📊 Analytics & Reporting

### Get Organization Analytics
```http
GET /organizations/{orgId}/analytics?fromDate=&toDate=&department=
```

### Get Employee Analytics
```http
GET /organizations/{orgId}/employees/{userId}/analytics?fromDate=&toDate=
```

### Get Attendance Trends
```http
GET /organizations/{orgId}/analytics/trends?period=daily&days=30
```

### Generate Report
```http
POST /organizations/{orgId}/analytics/reports
```
**Body:**
```json
{
  "reportType": "summary",
  "fromDate": "2024-01-01",
  "toDate": "2024-01-31",
  "format": "json",
  "department": "Engineering"
}
```

---

## 📋 Rule Types

| Rule Type | Description | Threshold Unit |
|-----------|-------------|----------------|
| `LATE_ARRIVAL` | Late check-in detection | Minutes |
| `EARLY_DEPARTURE` | Early check-out detection | Minutes |
| `MINIMUM_HOURS` | Minimum working hours | Hours |
| `BREAK_VIOLATION` | Break time violations | Minutes |
| `GEOFENCE_VIOLATION` | Location violations | Boolean |
| `ABSENTEEISM` | Absence patterns | Days |

## 📋 Break Types

- `LUNCH` - Lunch break
- `TEA` - Tea/Coffee break  
- `REGULAR` - General break
- `EMERGENCY` - Emergency break
- `PERSONAL` - Personal break

## 📋 Alert Severities

- `HIGH` - Critical violations requiring immediate attention
- `MEDIUM` - Standard violations for review
- `LOW` - Minor infractions for tracking

## 📋 Geofence Types

- `OFFICE` - Main office location
- `BRANCH` - Branch office
- `WAREHOUSE` - Warehouse/Storage
- `SITE` - Project site
- `REMOTE_LOCATION` - Remote work location

---

## 🔄 Progressive Deduction System

The system calculates escalating penalties based on:

1. **Violation History**: Recent violations increase penalties
2. **Violation Type**: Different types have different base penalties
3. **Frequency**: More frequent violations = higher multipliers
4. **Context**: Time of day, day of week considerations

**Example Progression:**
- 1st violation: Base penalty
- 2nd violation (within 30 days): 1.5x penalty
- 3rd violation (within 30 days): 2x penalty
- 4th+ violations: 2.5x penalty + manager approval required

---

## 🚦 Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 422 | Validation Error | Data validation failed |
| 500 | Internal Error | Server error |

---

## 🔑 Default Configuration

**Important**: All attendance rules are **disabled by default**. Organizations must:

1. Configure organization-specific rules
2. Set appropriate thresholds and penalties
3. Enable rules individually as needed
4. Test alert systems before production use

This ensures no unintended penalties are applied and gives organizations full control over their attendance policies.

---

## 📞 Support

For technical support or questions about the attendance system API, contact the development team or refer to the main API documentation.
