# Complete Organization Creation API

## Overview
This API endpoint provides a single, atomic operation to create a complete organization setup including:
1. Organization entity
2. Organization settings
3. Admin role with permissions
4. Admin user with role assignment
5. Welcome email to admin user

All operations are performed within a database transaction, ensuring rollback on any failure.

## Endpoint
**POST** `/api/v2/organization/complete`

## Authentication
Requires Super Admin authentication token.

## Request Body Schema

```json
{
  "organization": {
    "name": "string (required)",
    "industry": "string (optional)",
    "subscriptionPlanId": "string (required)",
    "subscriptionEnd": "ISO8601 date (optional)",
    "isActive": "boolean (optional, default: true)",
    "settings": "JSON string (optional)"
  },
  "admin": {
    "email": "string (required, valid email)",
    "firstName": "string (required)",
    "lastName": "string (required)"
  },
  "permissions": ["array of permission IDs (required, minimum 1)"]
}
```

## Example Request

```json
{
  "organization": {
    "name": "TechVantage Solutions",
    "industry": "Information Technology",
    "subscriptionPlanId": "plan-123",
    "isActive": true,
    "settings": "{\"timezone\": \"Asia/Kolkata\"}"
  },
  "admin": {
    "email": "admin@techvantage.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "permissions": [
    "perm-1", 
    "perm-2", 
    "perm-3"
  ]
}
```

## Success Response

**Status Code:** `201 Created`

```json
{
  "success": true,
  "message": "Organization created successfully with admin user",
  "data": {
    "organization": {
      "id": "org-123",
      "name": "TechVantage Solutions",
      "industry": "Information Technology",
      "isActive": true
    },
    "adminRole": {
      "id": "role-123",
      "name": "Administrator",
      "permissions": [
        {
          "id": "perm-1",
          "name": "user.create",
          "description": "Create users"
        }
      ]
    },
    "adminUser": {
      "id": "user-123",
      "email": "admin@techvantage.com",
      "firstName": "John",
      "lastName": "Doe",
      "status": "inactive"
    }
  }
}
```

## Error Response

**Status Code:** `400 Bad Request` / `500 Internal Server Error`

```json
{
  "success": false,
  "message": "Organization creation failed",
  "error": "Detailed error message",
  "details": "All changes have been rolled back automatically"
}
```

## Transaction Behavior

The API uses a database transaction with the following characteristics:
- **Timeout:** 20 seconds
- **Max Wait:** 10 seconds
- **Rollback:** Automatic on any error during the transaction

### What happens on failure:
1. All database changes are automatically rolled back
2. No partial organization setup is left in the system
3. Detailed error message is returned
4. Email notifications are not sent

### What happens on success:
1. Organization is created with settings
2. Admin role is created with specified permissions
3. Admin user is created and assigned the role
4. Permission presets are initialized (non-blocking)
5. Welcome email is sent to admin (non-blocking)

## Business Logic

### Organization Creation
- Creates organization with provided details
- Sets default subscription end date to 1 year from now if not provided
- Creates organization settings with default weekend configuration

### Admin Role Creation
- Creates role named "Administrator" 
- Marks role as default for the organization
- Assigns all specified permissions to the role

### Admin User Creation
- Creates user with status "inactive" (activated when password is set)
- Generates verification token for password setup
- Assigns admin role to the user
- Sets hired date to current date

### Email Notification
- Sends welcome email with password setup link
- Uses organization name as sender
- Non-blocking operation (doesn't fail transaction if email fails)

## Frontend Integration

The frontend `OrganizationCreate.tsx` component has been updated to:
- Use single form for all organization, admin, and permission data
- Call the new `/complete` endpoint instead of multiple APIs
- Handle success/error states appropriately
- Show loading indicator during organization creation

## Migration from Old API

**Before (3 separate API calls):**
1. POST `/api/v2/organization` - Create organization
2. POST `/api/v2/role` - Create admin role
3. POST `/api/v2/user` - Create admin user
4. POST `/api/v2/user-role` - Assign role to user

**After (1 API call):**
1. POST `/api/v2/organization/complete` - Create everything atomically

## Error Handling Benefits

### Old Approach Issues:
- Partial failures could leave incomplete setups
- Manual cleanup required on failures
- Complex error handling in frontend
- Race conditions possible

### New Approach Benefits:
- Atomic operation with automatic rollback
- No partial failures or cleanup needed
- Simple error handling in frontend
- Consistent database state guaranteed

## Testing

Test the API with curl:

```bash
curl -X POST http://localhost:3000/api/v2/organization/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -d '{
    "organization": {
      "name": "Test Organization",
      "industry": "Technology",
      "subscriptionPlanId": "PLAN_ID",
      "isActive": true
    },
    "admin": {
      "email": "admin@test.com",
      "firstName": "Test",
      "lastName": "Admin"
    },
    "permissions": ["PERMISSION_ID_1", "PERMISSION_ID_2"]
  }'
```

## Performance Considerations

- Transaction timeout set to 20 seconds for safety
- Permission preset initialization is non-blocking
- Email sending is non-blocking
- Database operations are optimized for single transaction
- Includes proper indexes for user email uniqueness checks
