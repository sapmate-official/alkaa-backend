# Hard Delete User from Organization API

## Overview
This API endpoint allows you to permanently delete a user and all associated data from a specific organization. This is a destructive operation that cannot be undone.

## Endpoint
```
DELETE /api/v2/user/org/:orgId/user/:userId
```

## Authentication
- **Required**: Yes
- **Type**: Bearer Token
- **Header**: `Authorization: Bearer <your-token>`

## Parameters

### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orgId` | UUID | Yes | The ID of the organization |
| `userId` | UUID | Yes | The ID of the user to be deleted |

### Example Request
```bash
curl -X DELETE \
  "http://localhost:3000/api/v2/user/org/12345678-1234-1234-1234-123456789012/user/87654321-4321-4321-4321-210987654321" \
  -H "Authorization: Bearer your-jwt-token-here" \
  -H "Content-Type: application/json"
```

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "User and all related data successfully deleted from organization",
  "data": {
    "deletedUser": {
      "id": "87654321-4321-4321-4321-210987654321",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "organizationId": "12345678-1234-1234-1234-123456789012",
      "organizationName": "Example Corp"
    },
    "impact": {
      "departmentsAffected": 2,
      "subordinatesAffected": 5
    }
  },
  "timestamp": "2025-06-25T10:30:00.000Z"
}
```

### Error Responses

#### 400 Bad Request - Invalid Parameters
```json
{
  "error": "Bad Request",
  "message": "Organization ID and User ID are required",
  "required": ["orgId", "userId"]
}
```

#### 400 Bad Request - Invalid UUID Format
```json
{
  "error": "Bad Request",
  "message": "Invalid UUID format for orgId or userId"
}
```

#### 401 Unauthorized
```json
{
  "message": "Access denied. No token provided.",
  "expired": false
}
```

#### 403 Forbidden - Cannot Delete Last Admin
```json
{
  "error": "Forbidden",
  "message": "Cannot delete the last administrator of the organization",
  "userId": "87654321-4321-4321-4321-210987654321",
  "orgId": "12345678-1234-1234-1234-123456789012"
}
```

#### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "User not found in the specified organization",
  "orgId": "12345678-1234-1234-1234-123456789012",
  "userId": "87654321-4321-4321-4321-210987654321"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An error occurred during the hard delete operation"
}
```

## Data Cleanup
This endpoint performs comprehensive cleanup of all user-related data including:

### Core User Data
- User profile and authentication data
- User roles and permissions
- Organization admin assignments

### Work-Related Data
- Attendance records and daily reports
- Leave balances and requests
- Salary records and transactions
- Bank details and salary parameters

### Communication & Notifications
- Push subscriptions
- Notifications
- Activity logs

### Relationships
- Manager-subordinate relationships (updates subordinates to have no manager)
- Department head assignments (removes user as department head)
- Financial transactions (sender/receiver)

## Security Features

### Input Validation
- Validates UUID format for both orgId and userId
- Ensures user belongs to the specified organization
- Prevents deletion of the last administrator in an organization

### Transaction Safety
- All operations are performed in a single database transaction
- If any operation fails, all changes are rolled back
- Ensures data consistency

### Activity Logging
- Logs the deletion action for audit purposes
- Records who performed the deletion and when
- Includes details about the deleted user

## Usage Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

const deleteUser = async (orgId, userId, authToken) => {
  try {
    const response = await axios.delete(
      `http://localhost:3000/api/v2/user/org/${orgId}/user/${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('User deleted successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error deleting user:', error.response?.data || error.message);
    throw error;
  }
};
```

### Python
```python
import requests

def delete_user(org_id, user_id, auth_token):
    url = f"http://localhost:3000/api/v2/user/org/{org_id}/user/{user_id}"
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }
    
    response = requests.delete(url, headers=headers)
    
    if response.status_code == 200:
        print("User deleted successfully:", response.json())
        return response.json()
    else:
        print("Error deleting user:", response.json())
        response.raise_for_status()
```

### Frontend (React)
```javascript
const deleteUser = async (orgId, userId) => {
  try {
    const response = await fetch(
      `/api/v2/user/org/${orgId}/user/${userId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // If using cookies for auth
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('User deleted:', result);
    return result;
  } catch (error) {
    console.error('Failed to delete user:', error);
    throw error;
  }
};
```

## ⚠️ Important Warnings

1. **Permanent Deletion**: This operation permanently deletes the user and all associated data. This action cannot be undone.

2. **Admin Protection**: The system prevents deletion of the last administrator in an organization to maintain system integrity.

3. **Data Impact**: Deleting a user affects:
   - Subordinates (their manager will be set to null)
   - Departments (if the user was a department head)
   - Historical records (attendance, salary, transactions)

4. **Testing**: Always test in a development environment before using in production.

## Troubleshooting

### Common Issues

1. **"Invalid UUID format"**: Ensure both orgId and userId are valid UUID v4 strings
2. **"User not found"**: Verify the user exists and belongs to the specified organization
3. **"Cannot delete last admin"**: Assign admin role to another user before deleting
4. **"Access denied"**: Check your authentication token is valid and not expired

### Testing
Use the provided test script (`test-hard-delete-user.js`) to verify the API functionality:

```bash
node test-hard-delete-user.js
```

Remember to update the configuration variables in the test script before running.
