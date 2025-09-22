# Authentication API Migration: v1/general to v1/auth

## Overview
This document outlines the migration of authentication APIs from `/api/v1/general` to `/api/v1/auth` to improve API organization and consolidate authentication functionality.

## Changes Made

### Backend Changes

#### 1. Controller Integration
- **File**: `src/controller/v1/auth/auth.controller.js`
- **Changes**: Integrated all authentication functions from `general.controller.js` into `auth.controller.js`
- **Functions Added**:
  - `checkEmailForLogin` - Multi-tenant email verification
  - `verifyPasswordAndSendOtp` - Password verification with OTP
  - `verifyOtpAndLogin` - OTP verification and login completion
  - `setPassword` - Legacy password setup
  - `loginUser` - Legacy single-step login
  - `validatetoken` - Token validation with organization context
  - `refreshToken` - Token refresh with organization context
  - `logout` - Enhanced logout with proper cleanup
  - `Profiledetails` - Get user profile
  - `updateProfile` - Update user profile

#### 2. Router Updates
- **File**: `src/router/v1/auth.router.js`
- **Changes**: Added all authentication endpoints
- **New Routes**:
  ```
  POST /api/v1/auth/check-email
  POST /api/v1/auth/verify-password
  POST /api/v1/auth/verify-otp
  POST /api/v1/auth/set-password
  POST /api/v1/auth/login
  GET  /api/v1/auth/validate-token
  POST /api/v1/auth/refresh-token
  POST /api/v1/auth/logout
  GET  /api/v1/auth/profile/:id
  PUT  /api/v1/auth/profile/:id
  ```

### Frontend Changes

#### 1. API Dictionary Updates
- **File**: `src/services/api/v2/APIdict.ts`
- **Changes**: Updated all authentication endpoints to use `/api/v1/auth`
- **Updated Endpoints**:
  - `setPassword`: `/api/v1/auth/set-password`
  - `login`: `/api/v1/auth/login`
  - `checkEmail`: `/api/v1/auth/check-email`
  - `verifyPassword`: `/api/v1/auth/verify-password`
  - `verifyOtp`: `/api/v1/auth/verify-otp`
  - `validateToken`: `/api/v1/auth/validate-token`
  - `refreshToken`: `/api/v1/auth/refresh-token`
  - `logout`: `/api/v1/auth/logout`

#### 2. Auth Context Updates
- **File**: `src/providers/AuthContext.tsx`
- **Changes**: Updated all API calls to use new endpoints
- **Updated Functions**:
  - `validateToken()`
  - `signIn()`
  - `checkEmail()`
  - `verifyPassword()`
  - `verifyOtp()`

## Available Authentication Flows

### 1. Multi-Tenant Flow (Recommended)
```
POST /api/v1/auth/check-email        → Email and organization check
POST /api/v1/auth/verify-password    → Password verification + OTP send
POST /api/v1/auth/verify-otp         → OTP verification + login completion
```

### 2. Advanced 2FA Flow (Alternative)
```
POST /api/v1/auth/verify-credentials → Credential verification
POST /api/v1/auth/request-otp        → OTP request
POST /api/v1/auth/verify-login-otp   → OTP verification + login
POST /api/v1/auth/resend-otp         → OTP resend
```

### 3. Legacy Flow (Backward Compatibility)
```
POST /api/v1/auth/login              → Direct login (single step)
```

## Features Supported

### Multi-Tenant Support
- ✅ Single organization users
- ✅ Multi-organization users
- ✅ Organization selection
- ✅ Organization context in tokens

### Security Features
- ✅ OTP-based authentication
- ✅ Session tokens
- ✅ Rate limiting
- ✅ IP and device tracking
- ✅ Login notifications
- ✅ 2FA support

### Token Management
- ✅ JWT access tokens
- ✅ Refresh tokens
- ✅ Organization context in tokens
- ✅ Token validation
- ✅ Token refresh

### User Management
- ✅ Profile management
- ✅ User preferences
- ✅ Notification settings
- ✅ 2FA toggle

## Database Schema Review

The existing Prisma schema supports all the features:

### Key Models Used
- `User` - User accounts with organization association
- `Organization` - Organization data and settings
- `EmailOtpVerification` - OTP management
- `TempLoginSession` - Session management
- `UserRole` - Role-based access
- `ActivityLog` - Login activity tracking

### Relationships
- Users belong to organizations (multi-tenant)
- Users can have multiple roles
- Sessions are linked to users
- OTP records are user-specific
- Activity logs track organization context

## Migration Benefits

1. **Better API Organization**: Authentication endpoints are now properly grouped
2. **Consolidated Functionality**: All auth features in one controller
3. **Enhanced Security**: Improved multi-tenant support and 2FA
4. **Backward Compatibility**: Legacy endpoints still work
5. **Better Maintainability**: Cleaner code structure

## Testing

### Manual Testing Steps
1. Test multi-tenant login flow
2. Test single organization login
3. Test OTP verification
4. Test token validation
5. Test token refresh
6. Test logout functionality
7. Test profile management

### Frontend Testing
1. Verify SignIn page works
2. Test MultiTenantLoginForm
3. Test organization selection
4. Test OTP verification component
5. Test error handling

## Rollback Plan

If issues occur, revert by:
1. Restore original `auth.controller.js`
2. Revert `auth.router.js` changes  
3. Revert frontend API dictionary changes
4. Revert AuthContext changes

The general controller endpoints remain unchanged for backward compatibility.

## Next Steps

1. Monitor authentication logs
2. Gradually deprecate general endpoints
3. Update documentation
4. Add comprehensive tests
5. Consider removing legacy endpoints after migration period
