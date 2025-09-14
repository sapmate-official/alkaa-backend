# Multi-Tenant Authentication Implementation

## Overview
This document outlines the implementation of the new multi-tenant authentication flow for the Alkaa platform. The new flow allows users who belong to multiple organizations to select which organization they want to login to, while maintaining a smooth experience for single-organization users.

## Implementation Details

### 1. New Authentication Flow

The authentication process is now divided into three clear steps:

#### Step 1: Email Check (`/api/v1/general/check-email`)
- **Purpose**: Check if an email exists and determine organization associations
- **Input**: `{ email }`
- **Output**: 
  - Single organization: `{ singleOrganization: true, organization: {...} }`
  - Multiple organizations: `{ multipleOrganizations: true, organizations: [...] }`

#### Step 2: Password Verification (`/api/v1/general/verify-password`)
- **Purpose**: Verify password and send OTP
- **Input**: `{ email, password, orgId? }`
- **Output**: `{ sessionToken, organizationName, otpExpiresIn }`

#### Step 3: OTP Verification (`/api/v1/general/verify-otp`)
- **Purpose**: Verify OTP and complete login
- **Input**: `{ sessionToken, otpCode }`
- **Output**: `{ userData, accessToken, refreshToken }`

### 2. Database Models Used

The implementation leverages existing database models:
- `User` - User records with orgId
- `Organization` - Organization details
- `EmailOtpVerification` - OTP storage and validation
- `TempLoginSession` - Temporary session management

### 3. Token Enhancement

#### Updated Token Structure
Tokens now include `orgId` for proper multi-tenant isolation:
```javascript
{
  email: "user@example.com",
  id: "userId",
  orgId: "organizationId"  // NEW: Organization context
}
```

#### New Utility Functions
- `generateTokensWithOrg(email, userId, orgId, accessExpiry, refreshExpiry)`
- Enhanced `refreshToken` to maintain orgId context

### 4. Middleware Updates

#### ValidateToken Middleware
- Now extracts and provides `orgId` from tokens
- Enhanced user object includes organization context
- Backward compatible with legacy tokens

### 5. Files Modified

#### Controllers
- `src/controller/v1/general/general.controller.js`
  - Added `checkEmailForLogin`
  - Added `verifyPasswordAndSendOtp`
  - Added `verifyOtpAndLogin`
  - Updated `validatetoken` to handle orgId
  - Updated `refreshToken` to maintain orgId

#### Routers
- `src/router/v1/general.router.js`
  - Added new authentication routes
  - Maintained backward compatibility

#### Utilities
- `src/util/generate.js`
  - Added `generateTokensWithOrg` function

#### Middleware
- `src/middleware/validateToken.js` (already properly handles orgId)

### 6. API Endpoints

#### New Endpoints (v1)
```
POST /api/v1/general/check-email
POST /api/v1/general/verify-password
POST /api/v1/general/verify-otp
```

#### Legacy Endpoints (maintained for compatibility)
```
POST /api/v1/general/login
POST /api/v1/general/set-password
GET /api/v1/general/validate-token
POST /api/v1/general/refresh-token
POST /api/v1/general/logout
```

### 7. Frontend Flow Example

```javascript
// Step 1: Check email
const emailCheck = await api.post('/general/check-email', { email });

if (emailCheck.data.singleOrganization) {
    // Single org flow
    const orgData = emailCheck.data.organization;
    proceedToPassword(email, null);
} else if (emailCheck.data.multipleOrganizations) {
    // Multi org flow
    const selectedOrg = await showOrgSelection(emailCheck.data.organizations);
    proceedToPassword(email, selectedOrg.orgId);
}

// Step 2: Password and OTP
const otpResponse = await api.post('/general/verify-password', {
    email,
    password,
    orgId // null for single org, specific orgId for multi org
});

// Step 3: OTP verification
const loginResponse = await api.post('/general/verify-otp', {
    sessionToken: otpResponse.data.sessionToken,
    otpCode: userEnteredOtp
});

// Store organization context
localStorage.setItem('orgId', loginResponse.data.userData.orgId);
localStorage.setItem('orgName', loginResponse.data.userData.orgName);
```

### 8. Security Features

- **OTP Expiration**: 10 minutes
- **Session Token Expiration**: 15 minutes
- **Attempt Limiting**: Maximum 3 OTP attempts
- **Organization Validation**: Active organization checks
- **User Status Validation**: Active/inactive/suspended checks
- **IP and User Agent Logging**: For security auditing

### 9. Email Branding

- OTP emails are sent with organization-specific branding
- Uses the `sendLoginOTPEmail` utility function
- Includes security information (IP, device, timestamp)

### 10. Backward Compatibility

- Legacy login endpoint (`/login`) remains functional
- Existing tokens without orgId continue to work
- Gradual migration path for frontend applications

### 11. Organization Switching

Users can switch organizations by:
1. Logging out from current session
2. Using the new authentication flow to select different organization
3. The system will generate new tokens with the correct orgId

### 12. Testing

A test script is provided at `test_multitenant_auth.js` to verify the implementation.

## Benefits

1. **Proper Multi-Tenancy**: Clear organization isolation in tokens
2. **Enhanced Security**: OTP-based authentication with organization branding
3. **User Experience**: Smooth flow for both single and multi-org users
4. **Scalability**: Token-based orgId eliminates parameter-based organization selection
5. **Auditability**: Comprehensive logging of authentication attempts

## Next Steps

1. Update frontend to implement the new authentication flow
2. Update API interceptors to use orgId from stored context
3. Gradually migrate existing API endpoints to use orgId from tokens
4. Implement organization switching UI components
5. Add comprehensive error handling and user feedback
