# User and Organization API Documentation

## Login Endpoint
```http
GET /api/v2/super-admin/login
```
**Request Body**
```json
{
  "email": "string (required)",
  "password" : "string (required)"
}
```
**Response (200)**
```json
{
  "message": "Super Admin logged in successfully",
    "userData": {
        "id": "string",
        "email": "sstring",
        "name": "string"
    },
    "refreshToken": "string",
    "accessToken": "string"
}
```


on the same postman  page, you have to send request, as cookies is set by server in this page.
or you can set authorization header in below format 
```
Authorization :  Bearer ${AccessToken}
```


## Organization Endpoints

### Get All Organizations
```http
GET /api/v2/organization
```

**Response (200 OK)**
```json
[
  {
    "id": "string",
    "name": "string",
    "industry": "string",
    "subscriptionPlanId": "string",
    "isActive": boolean,
    "users": [
      {
        "firstName": "string",
        "lastName": "string"
      }
    ],
    "subscriptionPlan": {
      "id": "string",
      "name": "string",
      "monthlyPrice": number,
      "annualPrice": number
    }
  }
]
```

### Get Organization By ID
```http
GET /api/v2/organization/{id}
```

**Response (200 OK)**
```json
{
  "id": "string",
  "name": "string",
  "industry": "string",
  "users": [...],
  "departments": [...],
  "subscriptionPlan": {...}
}
```

## User Management Endpoints

### Create User
```http
POST /api/v2/user
```

**Request Body**
```json
{
  "email": "string (required)",
  "orgId": "string (required)",
  "firstName": "string (required)",
  "lastName": "string (required)",
  "departmentId": "string (optional)",
  "managerId": "string (optional)",
  "status": "string (default: active)",
  "dateOfBirth": "string (optional)",
  "address": "string (optional)",
  "mobileNumber": "string (optional)",
  "emergencyContact": "string (optional)",
  "adharNumber": "string (optional)",
  "panNumber": "string (optional)"
}
```

**Response (201 Created)**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "string",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "employeeId": "string",
    "status": "string",
    "department": {...},
    "manager": {...}
  }
}
```

### Update User
```http
PUT/PATCH /api/v2/user/{id}
```

**Request Body** (all fields optional)
```json
{
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "departmentId": "string",
  "managerId": "string",
  "status": "string",
  "address": "string",
  "mobileNumber": "string",
  "emergencyContact": "string",
  "adharNumber": "string",
  "panNumber": "string"
}
```

**Response (200 OK)**
```json
{
  "id": "string",
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "department": {...},
  "manager": {...}
}
```

### Hard Delete User
```http
DELETE /api/v2/user
```

**Request Body**
```json
{
  "id": "string"
}
```

**Response (204 No Content)**

### Get Organization Users
```http
GET /api/v2/user/org/{orgId}
```

**Query Parameters**
- `status` (optional): Filter by user status
- `role` (optional): Filter by role

**Response (200 OK)**
```json
[
  {
    "id": "string",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "employeeId": "string",
    "status": "string",
    "organization": {...},
    "department": {...},
    "roles": [
      {
        "role": {
          "id": "string",
          "name": "string",
          "permissions": [...]
        }
      }
    ]
  }
]
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Required fields missing",
  "requiredFields": ["field1", "field2"]
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "error": "Access denied: Required permission not found"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 409 Conflict
```json
{
  "error": "Email already exists in this organization"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error"
}
```

## Additional Notes

1. **Authentication**: All endpoints except user creation require a valid authentication token in the request header.

2. **Employee ID Generation**: When creating a user, the system automatically generates an employee ID using the format: `{OrgInitials}{YY}{MM}`.

3. **Email Notifications**: The system sends welcome emails to new users with verification tokens for password setup.

4. **Transaction Safety**: User deletion is performed in a transaction to ensure data consistency across related tables.

5. **Role-Based Access**: Many endpoints require specific permissions in the user's role to access.

6. **Data Cascade**: Hard deleting a user will remove all associated data (leave records, attendance, etc.).
