# ALKAA API Reference

This reference is derived from the Express routers and controllers in `src/`. It documents every HTTP route mounted by `src/app.js`, including legacy v1 endpoints, v2 endpoints, v3 endpoints, and public routes mounted outside the versioned routers.

## Base URL and request conventions

- Base URL: the deployed backend origin (for local development, use the host/port configured by `server.js`).
- Send JSON request bodies with `Content-Type: application/json`. The server also accepts URL-encoded bodies.
- Unless otherwise stated, path identifiers such as `:id`, `:orgId`, `:userId`, and `:month` are strings in the URL. Month/year values are numeric calendar values where applicable.
- `Authorization: Bearer <accessToken>` is accepted by token middleware. The backend also reads the `accessToken` cookie. Login flows may set cookies; browser clients must honor the configured CORS credentials/origins.
- Responses are JSON unless marked as a file download or the route explicitly returns plain text. Response fields/status codes are handler-specific; there is no common response envelope or uniform validation/error contract.
- Query parameters are accepted where stated by individual handlers. Most endpoints do not have request validation schemas declared in the route layer. For exact writable fields, use the linked handler and Prisma model as the source of truth.

## Authentication and access behavior

| Scope | Effective behavior |
|---|---|
| `GET /health`, `/`, static files | No application token middleware. `/` serves the API interface HTML; `/health` returns `{ "status": "OK" }`. |
| `/api/v1/*` | Authentication is per route as listed below. `validateToken` accepts bearer token or cookie. Some legacy profile, registration, and logout routes are intentionally/unintentionally public in the router. |
| `/api/v2/*` | Global `validateToken` applies unless request path begins `/onboarding/verify/`, `/onboarding/submit/`, `/public/`, or `/super-admin/`. Super-admin subroutes then apply their own super-admin token middleware selectively. Explicit middleware shown below is additional/local. |
| `/api/v3/*` | Global `validateToken` applies to all routes. Individual v3 payroll routes also attach token validation locally. |
| Public billing/demo | `/api/public/billing/:id`, `/api/public/billing/:id/payment`, and `/api/public/demo-request` are mounted outside versioned middleware and are public. |

The standard user token middleware returns HTTP 401 for missing, expired, invalid, or unknown-user tokens (`expired` is included for missing/expired/invalid-token cases). The super-admin middleware returns 401 when no token is supplied and 403 for an invalid token. Role/permission checks may also be performed inside handlers; the route inventory alone cannot guarantee a user's authorization.

## Health and root

| Method | Path | Auth | Result |
|---|---|---|---|
| GET | `/health` | Public | `200 { "status": "OK" }` |
| GET | `/` | Public | Serves `public/interface.html`. |

## API v1 — legacy employee, manager, leave and login APIs

### Authentication (`/api/v1/auth`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| POST | `/api/v1/auth/verify-credentials` | Public | `verifyLoginCredentials` — first-factor credential verification. |
| POST | `/api/v1/auth/request-otp` | Public | `requestLoginOTP` — request login OTP. |
| POST | `/api/v1/auth/verify-otp` | Public | `verifyLoginOTP` — verify login OTP. |
| POST | `/api/v1/auth/resend-otp` | Public | `resendLoginOTP` — resend login OTP. |
| POST | `/api/v1/auth/toggle-2fa` | User token | `toggle2FA`. |
| PUT | `/api/v1/auth/notification-preferences` | User token | `updateNotificationPreferences`. |

### General login/profile (`/api/v1/general`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| POST | `/api/v1/general/check-email` | Public | `checkEmailForLogin` — multi-tenant login email lookup. |
| POST | `/api/v1/general/verify-password` | Public | `verifyPasswordAndSendOtp` — password check and OTP initiation. |
| POST | `/api/v1/general/verify-otp` | Public | `verifyOtpAndLogin` — verify OTP and complete login. |
| POST | `/api/v1/general/set-password` | Public | `setPassword` — legacy password setup. |
| POST | `/api/v1/general/login` | Public | `loginUser` — legacy login. |
| GET | `/api/v1/general/validate-token` | User token | `validatetoken`. |
| POST | `/api/v1/general/refresh-token` | Public | `refreshToken` — refresh-token flow. |
| POST | `/api/v1/general/logout` | Public | `logout` — clears/revokes login state as implemented by handler. |
| GET | `/api/v1/general/profile/:id` | Public | `Profiledetails`. |
| PUT | `/api/v1/general/profile/:id` | Public | `updateProfile`. |

### Employees (`/api/v1/employee`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| POST | `/api/v1/employee/register` | Public | `registerEmployee`. |
| POST | `/api/v1/employee/leave/apply` | User token + employee role | `applyLeave`. |
| GET | `/api/v1/employee/list-of-leave` | User token + employee role | `listLeave`. |
| GET | `/api/v1/employee/leave-balance` | User token + employee role | `leaveBalance`. |

### Managers (`/api/v1/manager`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| POST | `/api/v1/manager/register` | Public | `registerManager`. |
| GET | `/api/v1/manager/list-of-leave` | User token + manager role | `listOfLeave`. |
| POST | `/api/v1/manager/respond-leave` | User token + manager role | `responseLeave`. |
| POST | `/api/v1/manager/leave-type/create` | Public | `leaveTypeCreate`. |
| GET | `/api/v1/manager/employee-list` | User token + manager role | `employeeList`. |

### Leave (`/api/v1/leave`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| GET | `/api/v1/leave/type` | Public | `leaveTypeList`. |

### Attendance (`/api/v1/attendance`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| POST | `/api/v1/attendance/check-in` | User token | `checkIn`. |
| POST | `/api/v1/attendance/check-out` | User token | `checkOut`. |
| GET | `/api/v1/attendance/session` | User token | `sessionListByDate`. |
| GET | `/api/v1/attendance/history` | User token | `getEmployeeAttendance`. |

### Salary (`/api/v1/salary`)

No active v1 salary route is registered (the only route in its router is commented out).

## API v2 — organization and workforce APIs

All paths below are prefixed `/api/v2`. Authentication column refers to effective middleware, including the global v2 rule above. “Global user token” means a normal access token is required even if the route declaration has no local token middleware.

### Organizations (`/organization`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| GET | `/organization/` | Global user token | `getOrganization` — list organizations. |
| GET | `/organization/:id` | Global user token | `getOrganizationById`. |
| GET | `/organization/:orgId/chart` | Global user token | `getOrganizationChart`. |
| GET | `/organization/:orgId/manager-chart` | Global user token | `getManagerSubordinateChart`. |
| GET | `/organization/subordinate-list/` | Global user token | Inline placeholder response. |
| POST | `/organization/` | Global user token | `createOrganization`. |
| POST | `/organization/complete` | Global user token + super-admin token | `createCompleteOrganization`. |
| PUT, PATCH | `/organization/` | Global user token | `updateOrganization`. |
| DELETE | `/organization/` | Global user token | `deleteOrganization`. |
| GET | `/organization/employee-list/:orgId` | Global user token | `listOfEmployees`. |
| POST | `/organization/set-admin/` | Global user token + super-admin token | `setOrgAdmin`. |
| GET | `/organization/:id/admins` | Global user token | `getOrganizationAdmins`. |
| POST | `/organization/:id/admins` | Global user token | `setOrgAdmin`. |
| DELETE | `/organization/:id/admins/:adminId` | Global user token | `removeOrganizationAdmin`. |

#### Organization employees (`/organization/employees`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| GET | `/organization/employees/:id` | Global user token | `getEmployeeById`. |
| POST | `/organization/employees/` | Global user token | `createEmployee`. |
| PUT | `/organization/employees/` | Global user token | `updateEmployee`. |
| DELETE | `/organization/employees/` | Global user token | `deleteEmployee`. |
| GET | `/organization/employees/employee-id/:orgId` | Global user token | `generateEmployeeId`. |
| GET | `/organization/employees/employee-id/:orgId/check/:employeeId` | Global user token | `checkEmployeeId`. |

#### Employee drafts (`/organization/employees/draft`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| POST | `/organization/employees/draft/` | Global user token | `createDraft`. |
| PUT | `/organization/employees/draft/:id` | Global user token | `updateDraft`. |
| GET | `/organization/employees/draft/` | Global user token | `getAllDrafts`. |
| GET | `/organization/employees/draft/:id` | Global user token | `getDraft`. |
| DELETE | `/organization/employees/draft/:id` | Global user token | `deleteDraft`. |

### Users (`/user`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| GET | `/user/fetch-managers/org/:orgId` | Global user token | `fetchManagers`. |
| GET | `/user/subordinates/:managerId` | Global user token | `fetchAllSubordinates`. |
| GET | `/user/subordinate-list` | Global user token | `fetchAllSubordinates`. |
| GET | `/user/org/:orgId` | Global user token | `getUser` — organization user listing. |
| GET | `/user/all` | Global user token | `fetchAllUsersFromOrg`. |
| GET | `/user/user-list` | Global user token | `fetchAllUsersFromOrg`. |
| GET | `/user/:id` | Global user token | `getUserById`. |
| POST | `/user/` | Global user token | `createUser`. |
| PUT, PATCH | `/user/:id` | Global user token | `updateUser`. |
| DELETE | `/user/` | Global user token | `hardDeleteUser` (request body is used by handler). |
| DELETE | `/user/org/:orgId/user/:userId` | Global user token | `hardDeleteUserFromOrg`. |
| PUT | `/user/:userId/role/:prevRole/:roleId` | Global user token | `updateUserRole`. |
| PUT | `/user/:userId/department/:departmentId` | Global user token | `updateUserDepartment`. |

### Departments (`/department`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| GET | `/department/org/:orgId` | Global user token | `getDepartment` — list by organization. |
| GET | `/department/:id` | Global user token | `getDepartmentById`. |
| POST | `/department/` | Global user token | `createDepartment`. |
| PUT | `/department/:id` | Global user token | `updateDepartment`. |
| PATCH | `/department/` | Global user token | `updateDepartment`. |
| DELETE | `/department/:id` | Global user token | `deleteDepartment`. |
| PUT | `/department/:id/head/:userId` | Global user token | `updateDepartmentHead`. |

### Bank details (`/bank-details`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| GET | `/bank-details/user/:Userid` | Global user token | `getBankByUserId`. |
| GET | `/bank-details/` | Global user token | `getBank`. |
| GET | `/bank-details/:id` | Global user token | `getBankById`. |
| POST | `/bank-details/` | Global user token | `createBank`. |
| PUT, PATCH | `/bank-details/` | Global user token | `updateBank`. |
| DELETE | `/bank-details/` | Global user token | `deleteBank`. |

### Leave types, balances and requests

#### Leave types (`/leave-type`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| GET | `/leave-type/org/:org_id` | Global user token | `getLeaveTypes`. |
| GET | `/leave-type/:id` | Global user token | `getLeaveTypeById`. |
| POST | `/leave-type/` | Global user token | `createLeaveType`. |
| PUT, PATCH | `/leave-type/:id` | Global user token | `updateLeaveType`. |
| DELETE | `/leave-type/:id` | Global user token | `deleteLeaveType`. |

#### Leave balances (`/leave-balance`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| GET | `/leave-balance/` | Global user token | `getLeaveBalances`. |
| GET | `/leave-balance/:id` | Global user token | `getLeaveBalanceById`. |
| POST | `/leave-balance/` | Global user token | `createLeaveBalance`. |
| PUT, PATCH | `/leave-balance/:id` | Global user token | `updateLeaveBalance`. |
| DELETE | `/leave-balance/:id` | Global user token | `deleteLeaveBalance`. |
| GET | `/leave-balance/user/:userId` | Global user token | `getLeaveBalanceByUserId`. |
| GET | `/leave-balance/:leavetypeId/:userId` | Global user token | `getLeaveBalanceByleaveTypeIdAndUserId`. |

#### Leave requests (`/leave-request`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| GET | `/leave-request/org/:id` | Global user token | `getLeaveRequests`. |
| GET | `/leave-request/:id` | Global user token | `getLeaveRequestById`. |
| POST | `/leave-request/` | Global user token | `createLeaveRequest`. |
| PUT, PATCH | `/leave-request/:id` | Global user token | `updateLeaveRequest`. |
| DELETE | `/leave-request/:id` | Global user token | `deleteLeaveRequest`. |
| GET | `/leave-request/user/:id` | Global user token | `getLeaveRequestByUserId`. |
| GET | `/leave-request/manager/:id` | Global user token | `getLeaveRequestByManagerId`. |
| POST | `/leave-request/approve/:id` | Global user token | `approveLeaveRequest`. |
| POST | `/leave-request/reject/:id` | Global user token | `rejectLeaveRequest`. |
| POST | `/leave-request/cancel/:id` | Global user token | `cancelLeaveRequest`. |

### Attendance (`/attendance`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| GET | `/attendance/` | Global user token | `getAttendances`. |
| GET | `/attendance/:id` | Global user token | `getAttendanceById`. |
| POST | `/attendance/` | Global user token | `createAttendance`. |
| PUT, PATCH | `/attendance/:id` | Global user token | `updateAttendance`. |
| DELETE | `/attendance/:id` | Global user token | `deleteAttendance`. |
| GET | `/attendance/live/all/` | Global user token | `getAllUserLiveAttendance`. |
| POST | `/attendance/check-in` | Global user token | `checkIn`. |
| POST | `/attendance/check-out` | Global user token | `checkOut`. |
| GET | `/attendance/check-out/past` | Global user token | `getCheckOutPast`. |
| POST | `/attendance/check-out/past` | Global user token | `postPastCheckOut`. |
| POST | `/attendance/past-attendance` | Global user token | `createPastAttendance`. |
| GET | `/attendance/session/:date` | Global user token | `sessionListByDate`. |
| GET | `/attendance/employees` | Global user token | `getEmployeeAttendance`. |
| GET | `/attendance/user/:id` | Global user token | `getUserAttendance`. |
| GET | `/attendance/manager/verification/:managerId` | Global user token | `getEmployeeRecords`. |
| POST | `/attendance/manager/verification` | Global user token | `verifyAttendance`. |
| GET | `/attendance/manager/live/:managerId` | Global user token | `getTodaysAttendance`. |
| GET | `/attendance/admin/verification/:userId` | Global user token | `getAdminVerificationRecords`. |
| POST | `/attendance/admin/verification` | Global user token | `adminVerifyAttendance`. |

### Salary records (`/salary`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| GET | `/salary/` | Global user token | `getSalaries`. |
| GET | `/salary/:id` | Global user token | `getSalaryById`. |
| POST | `/salary/` | Global user token | `createSalary`. |
| PUT, PATCH | `/salary/:id` | Global user token | `updateSalary`. |
| DELETE | `/salary/:id` | Global user token | `deleteSalary`. |
| GET | `/salary/user/:userId` | Global user token | Salary records for a user (inline handler). |
| POST | `/salary/generate` | Global user token | Generate salary; JSON body fields read by handler: `userId`, `month`, `year`. |
| PATCH | `/salary/:id/status` | Global user token | Update salary status; JSON body field: `status`. |
| GET | `/salary/statistics` | Global user token | Aggregate statistics; query fields read by handler: `orgId`, `month`, `year`. |
| GET | `/salary/user/:userId/monthly/:month/year/:year` | Global user token | `getExistenceOfSalaryRecordBasedOnMonthAndYearForUserID`. |

### Roles and permissions

#### Roles (`/role`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| GET | `/role/org/:orgId` | Global user token | `getRole`. |
| GET | `/role/:id` | Global user token | `getRoleById`. |
| POST | `/role/` | Global user token | `createRole`. |
| PUT | `/role/:roleId` | Global user token | `updateRole`. |
| PATCH | `/role/` | Global user token | `updateRole`. |
| DELETE | `/role/:roleId` | Global user token | `deleteRole`. |
| POST | `/role/:roleId/permissions/add` | Global user token | `addPermissionsToRole`. |
| POST | `/role/:roleId/permissions/remove` | Global user token | `removePermissionsFromRole`. |

#### Permissions (`/permission`)

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| GET | `/permission/` | Global user token | `getPermissions`. |
| GET | `/permission/:id` | Global user token | `getPermissionById`. |
| POST | `/permission/` | Global user token | `createPermission`. |
| PUT, PATCH | `/permission/` | Global user token | `updatePermission`. |
| DELETE | `/permission/` | Global user token | `deletePermission`. |
| GET | `/permission/org/:orgId` | Global user token | `getPermissionsByOrgId`. |

#### Role-permission links (`/role-permission`) and user-role links (`/user-role`)

Both resources expose `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `PATCH /:id`, and `DELETE /:id` under their respective prefixes. Handlers are `getRolePermissions`, `getRolePermissionById`, `createRolePermission`, `updateRolePermission`, `deleteRolePermission`; and corresponding `getUserRoles`, `getUserRoleById`, `createUserRole`, `updateUserRole`, `deleteUserRole`. All require the global user token.

### Holidays and holiday types

| Resource | Method | Path | Handler |
|---|---|---|---|
| Holiday | GET | `/holiday/:orgId` | `getHolidays` |
| Holiday | GET | `/holiday/:id` | `getHolidayById` |
| Holiday | POST | `/holiday/` | `createHoliday` |
| Holiday | PUT, PATCH | `/holiday/:id` | `updateHoliday` |
| Holiday | DELETE | `/holiday/:id` | `deleteHoliday` |
| Holiday type | GET | `/holiday-type/:orgId` | `getAllHolidayTypes` |
| Holiday type | GET | `/holiday-type/:id` | `getHolidayType` |
| Holiday type | POST | `/holiday-type/` | `createHolidayType` |
| Holiday type | PUT, PATCH | `/holiday-type/:id` | `updateHolidayType` |
| Holiday type | DELETE | `/holiday-type/:id` | `deleteHolidayType` |

All require the global user token. The two GET patterns within each resource have the same Express shape; route declaration order means the first matching GET handler receives a one-segment path.

### Payroll (`/payroll`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/payroll/user/:userId` | Global user token | Read salary records for a user. |
| GET | `/payroll/check-for-extra-days/:userId/:month/:year` | Global user token | Calculate extra days for a payroll period. |
| POST | `/payroll/generate` | Global user token | Generate salary record. |
| DELETE | `/payroll/:id` | Global user token | Delete salary record. |
| PATCH | `/payroll/:id/status` | Global user token | Update salary status. |
| GET | `/payroll/statistics/:userId` | Global user token | Salary statistics. |
| GET | `/payroll/users/active/:org_id` | Global user token | Active users in an organization. |
| POST | `/payroll/parameters/:userId` | Global user token | Create/update salary parameters. |
| GET | `/payroll/parameters/:userId` | Global user token | Read salary parameters. |
| POST | `/payroll/initiate-transaction` | Global user token | Initiate a salary transaction. |
| POST | `/payroll/complete-transaction` | Global user token | Complete a salary transaction. |
| GET | `/payroll/manager/employees` | Global user token | Manager employee payroll data. |
| GET | `/payroll/admin/all-employees/:orgId` | Global user token | Organization employee payroll data. |
| GET | `/payroll/employee/:employeeId` | Global user token | Employee payroll data. |

These handlers are inline in `src/router/v2/child/payroll.router.js`; the route-level exact body and query fields are defined in each handler. Salary calculations use `SalaryRecord`, attendance, leave requests, salary parameters, and organization settings.

### Tasks and task groups

Both prefixes require the global user token and additionally run `checkUserRoles`.

#### Tasks (`/task`)

| Method | Path | Handler |
|---|---|---|
| POST | `/task/` | `createTask` |
| GET | `/task/` | `getAllTasks` |
| GET | `/task/:id` | `getTaskById` |
| PUT | `/task/:id` | `updateTask` |
| PATCH | `/task/:id` | `patchTask` |
| DELETE | `/task/:id` | `deleteTask` |
| GET | `/task/user/:userId` | `getTasksByUser` |
| GET | `/task/manager/:managerId` | `getTasksByManager` |
| POST | `/task/:taskId/updates` | `addTaskUpdate` |
| GET | `/task/:taskId/updates` | `getTaskUpdates` |
| POST | `/task/:taskId/assign` | `assignTask` |
| DELETE | `/task/:taskId/unassign` | `unassignTask` |
| GET | `/task/:taskId/assignments` | `getTaskAssignments` |

#### Task groups (`/task-group`)

| Method | Path | Handler |
|---|---|---|
| POST | `/task-group/` | `createGroup` |
| GET | `/task-group/` | `getAllGroups` |
| GET | `/task-group/:id` | `getGroupById` |
| PUT | `/task-group/:id` | `updateGroup` |
| DELETE | `/task-group/:id` | `deleteGroup` |
| POST | `/task-group/:id/members` | `addMembers` |
| DELETE | `/task-group/:id/members` | `removeMembers` |
| PUT | `/task-group/:id/members/role` | `updateMemberRole` |

### Notifications and events

#### Notifications (`/notification`)

| Method | Path | Auth | Handler |
|---|---|---|---|
| GET | `/notification/` | Global user token | `getAllnotification` |
| POST | `/notification/` | Global user token | `createNotification` |
| GET | `/notification/:id` | Global user token | `getNotificationByUserId` |
| PUT | `/notification/:id` | Global user token | `updateNotification` |
| DELETE | `/notification/:id` | Global user token | `deleteNotification` |
| GET | `/notification/test-push/:userId` | Global user token | `sendTestPushNotification` |
| GET | `/notification/template` | Global user token | `getAllnotificationTemplate` |
| POST | `/notification/template` | Global user token | `createNotificationTemplate` |
| GET | `/notification/template/:id` | Global user token | `getNotificationTemplateById` |
| PUT | `/notification/template/:id` | Global user token | `updateNotificationTemplate` |
| DELETE | `/notification/template/:id` | Global user token | `deleteNotificationTemplate` |

The router also contains commented-out push subscription and schedule routes; they are not active API endpoints.

#### Special events (`/events`)

| Method | Path | Auth | Handler |
|---|---|---|---|
| GET | `/events/` | Global user token (also router-level token middleware) | `getSpecialEvents` |

### Screens, activity and relationships

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| GET | `/screen/dashboard/:userId` | Global user token | `dashboardController`. |
| GET | `/activity-logs/` | Global user token | `getActivityLogs` (filters/pagination are handler-defined). |
| GET | `/activity-logs/stats` | Global user token | `getActivityStats`. |
| GET | `/activity-logs/user/:targetUserId/recent` | Global user token | `getUserRecentActivities`. |
| GET | `/relationship/user/:targetUserId` | Global user token | `getUserRelationship`. |
| GET | `/relationship/organization` | Global user token | `getUserRelationship`. |

### Onboarding (`/onboarding`)

Only the token verification and candidate submission paths are public. Remaining onboarding endpoints require the global user token and router-level `validateToken`.

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| GET | `/onboarding/verify/:token` | Public | `verifyOnboardingToken`. |
| POST | `/onboarding/submit/:token` | Public | `submitCandidateForm`. |
| GET | `/onboarding/` | User token | `getCandidates`. |
| GET | `/onboarding/:id` | User token | `getCandidateById`. |
| GET | `/onboarding/:id/review` | User token | `getCandidateReviewData`. |
| POST | `/onboarding/` | User token | `createCandidate`. |
| PUT | `/onboarding/:id` | User token | `updateCandidateData`. |
| DELETE | `/onboarding/:id` | User token | `deleteCandidate`. |
| POST | `/onboarding/:id/invite` | User token | `sendInvitation`. |
| POST | `/onboarding/:id/mark-review` | User token | `markUnderReview`. |
| POST | `/onboarding/:id/approve` | User token | `approveCandidate`. |
| POST | `/onboarding/:id/request-changes` | User token | `requestChanges`. |
| POST | `/onboarding/:id/reject` | User token | `rejectCandidate`. |
| POST | `/onboarding/:id/complete` | User token | `completeOnboarding`. |

### Public v2 service routes

| Method | Path | Auth | Handler |
|---|---|---|---|
| POST | `/public/demo-request` | Public (global bypass) | `sendDemoRequestEmail`. |

### Billing and subscription plans

#### Billing (`/billing`)

| Method | Path | Auth | Handler |
|---|---|---|---|
| GET | `/billing/dashboard` | Global user token | `getBillingDashboard` |
| GET | `/billing/history` | Global user token | `getBillHistory` |
| GET | `/billing/bill/:id` | Global user token | `getBillDetails` |
| POST | `/billing/bill/:id/pay` | Global user token | `markBillAsPaid` |
| GET | `/billing/bill/:id/invoice` | Global user token | `downloadBillInvoice` (PDF download) |

#### Subscription plans (`/subscription-plans`)

All endpoints use `validateSuperAdminTokenMiddleware` (in addition to the v2 global middleware except the super-admin bypass applies only to `/super-admin`, not this prefix).

| Method | Path | Handler |
|---|---|---|
| GET | `/subscription-plans/` | `getSubscriptionPlans` |
| GET | `/subscription-plans/:id` | `getSubscriptionPlanById` |
| POST | `/subscription-plans/` | `createSubscriptionPlan` |
| PUT, PATCH | `/subscription-plans/:id` | `updateSubscriptionPlan` |
| DELETE | `/subscription-plans/:id` | `deleteSubscriptionPlan` |
| PATCH | `/subscription-plans/:id/toggle-status` | `toggleSubscriptionPlanStatus` |

### Super-admin (`/super-admin`)

The global v2 middleware bypasses this prefix. Each route below has its own middleware only where shown; several list/CRUD and bill-payment routes are public in the router. Do not infer protection from the path name.

| Method | Path | Auth | Handler / purpose |
|---|---|---|---|
| POST | `/super-admin/login` | Public | `loginSuperAdmin`. |
| POST | `/super-admin/logout` | Super-admin token | `logoutSuperAdmin`. |
| GET | `/super-admin/get-user-info` | Super-admin token | `getUserInfo`. |
| GET | `/super-admin/validate-token` | Super-admin token | `validateSuperAdminToken`. |
| GET | `/super-admin/` | Public | `getSuperAdmins`. |
| GET | `/super-admin/:id` | Public | `getSuperAdminById`. |
| POST | `/super-admin/` | Shared secret in JSON body (`secretKey`) | `createSuperAdmin`. |
| PUT, PATCH | `/super-admin/:id` | Public | `updateSuperAdmin`. |
| DELETE | `/super-admin/:id` | Public | `deleteSuperAdmin`. |
| GET | `/super-admin/organizations/stats` | Super-admin token | `getOrganizationsStats`. |
| GET | `/super-admin/organization/:id/details` | Super-admin token | `getOrganizationDetails`. |
| GET | `/super-admin/organization/:id/users` | Super-admin token | `getOrganizationUsers`. |
| GET | `/super-admin/organization/:id/admins` | Super-admin token | `getOrganizationAdmins`. |
| GET | `/super-admin/organization/:id/bills` | Super-admin token | `getOrganizationBills`. |
| POST | `/super-admin/organization/:id/bill` | Super-admin token | `generateOrganizationBill`. |
| POST | `/super-admin/organization/:id/send-bill` | Super-admin token | `sendBillEmail`. |
| POST | `/super-admin/organizations/send-bills` | Super-admin token | `sendBillsToAllOrganizations`. |
| PATCH | `/super-admin/bill/:id/status` | Super-admin token | `updateBillStatus`. |
| GET | `/super-admin/billing/statistics` | Super-admin token | `getBillingStatistics`. |
| GET | `/super-admin/bill/:id` | Public | `getBillById`. |
| POST | `/super-admin/bill/:id/payment` | Public | `processBillPayment`. |

### WhatsApp (`/whatsapp`)

All endpoints require the global user token and router-level `validateToken`.

| Method | Path | Handler |
|---|---|---|
| POST | `/whatsapp/send` | `sendNotification` |
| POST | `/whatsapp/task-assignment` | `sendTaskAssignmentNotification` |
| POST | `/whatsapp/task-update` | `sendTaskUpdateNotification` |

### Birthday email utilities (`/birthday-emails`)

| Method | Path | Auth | Handler |
|---|---|---|---|
| POST | `/birthday-emails/test` | Global user token | `testBirthdayEmails` |
| GET | `/birthday-emails/logs` | Global user token | `getBirthdayEmailLogs` |

Comments call these “Admin only”, but the router itself adds no admin-role middleware. Authorization beyond the global token, if any, is handler-defined.

## API v3 — settings, permission catalog and payslips

All paths are prefixed `/api/v3` and require a user token globally.

### Permission catalog (`/permission`)

| Method | Path | Handler |
|---|---|---|
| GET | `/permission/categories` | `getAllCategories` |
| GET | `/permission/category/:id` | `getCategoryById` |
| POST | `/permission/category` | `createCategory` |
| PUT | `/permission/category/:id` | `updateCategory` |
| DELETE | `/permission/category/:id` | `deleteCategory` |
| GET | `/permission/subcategories` | `getAllSubcategories` |
| GET | `/permission/subcategory/:id` | `getSubCategoryById` |
| POST | `/permission/subcategory` | `createSubcategory` |
| PUT | `/permission/subcategory/:id` | `updateSubCategory` |
| DELETE | `/permission/subcategory/:id` | `deleteSubCategory` |
| GET | `/permission/permissions` | `getAllPermissions` |
| GET | `/permission/permission/:id` | `getPermissionById` |
| POST | `/permission/permission` | `createPermission` |
| PUT | `/permission/permission/:id` | `updatePermission` |
| DELETE | `/permission/permission/:id` | `deletePermission` |

### Settings (`/settings`)

| Method | Path | Handler |
|---|---|---|
| GET | `/settings/:orgId` | `fetchSettings` |
| PUT | `/settings/:orgId` | `updateSettings` |
| POST | `/settings/reset/:orgId` | `resetSettings` |

### Permission presets (`/permission-preset`)

| Method | Path | Handler |
|---|---|---|
| GET | `/permission-preset/org/:orgId` | `getPresets` |
| GET | `/permission-preset/:id` | `getPresetById` |
| POST | `/permission-preset/` | `createPreset` |
| PUT | `/permission-preset/:id` | `updatePreset` |
| DELETE | `/permission-preset/:id` | `deletePreset` |

### Payroll and payslips (`/payroll`)

| Method | Path | Handler / result |
|---|---|---|
| GET | `/payroll/payslip/:month/:year/:userId` | `getPaySlipBasedOnParams` — read a user's month/year payslip. |
| POST | `/payroll/salary-generate/:month/:year/:userId` | `generateSalaryBasedOnParams` — generate salary. |
| GET | `/payroll/statistics/:salaryRecordId` | `getSalaryStatisticsBasedOnId`. |
| GET | `/payroll/pdf-data/:salaryRecordId` | `getPayslipDataForPDF`. |
| GET | `/payroll/download/:salaryRecordId` | `downloadPayslipAsPDF` — PDF download. |
| POST | `/payroll/check-multiple-status` | `checkMultiplePayslipStatus`. |
| GET | `/payroll/pre-stats/:month/:year/:userId` | `preStatsSalaryGeneration`. |

The v3 payroll router attaches token validation to every endpoint locally as well as inheriting the v3 global token middleware.

## Public API (unversioned)

| Method | Path | Auth | Handler / result |
|---|---|---|---|
| GET | `/api/public/billing/:id` | Public | `getBillById`. |
| POST | `/api/public/billing/:id/payment` | Public | `processBillPayment`. |
| POST | `/api/public/demo-request` | Public | `sendDemoRequestEmail`. |

The demo-request handler is also mounted at `/api/v2/public/demo-request`.

## Route matching notes and source caveats

Express checks routes in declaration order. Confirmed route-order collisions include `GET /attendance/employees` being handled by the earlier `/attendance/:id`, `GET /salary/statistics` being handled by `/salary/:id`, and `GET /notification/template` being handled by `/notification/:id`. In both holiday routers, the first one-segment GET (`/:orgId`) has the same shape as the later `/:id`, so the later `getHolidayById`/`getHolidayType` declaration is unreachable for one-segment paths. The inventory lists registered declarations; where paths collide, the earlier declaration handles the request.

Some aliases and similarly named routes are both active (for example v1 and v2 attendance, v2 `/salary` and `/payroll`, and public bill lookup under two prefixes). The repository has no generated OpenAPI schema, and many route handlers accept fields without a shared validator. Therefore, request/response field lists and status codes must be read from the named handlers; the route tables do not invent undocumented schemas. Source locations:

- Route definitions: `src/router/v1`, `src/router/v2`, `src/router/v3`.
- Mounting, body parsing, health and public endpoints: `src/app.js`.
- Token behavior: `src/middleware/validateToken.js`.
- Data models: `prisma/schema.prisma`.
- Existing user/organization guide: `docs/USER_AND_ORG_API.md` (older partial guide; this reference supersedes its route omissions and method inconsistencies).

## CORS, errors and operational behavior

- JSON parsing, URL-encoded parsing, cookie parsing and CORS are installed globally (`src/app.js`). The v1 employee router declares a local malformed-JSON response, but the global JSON parser runs first, so malformed request JSON is handled by the app error handler before reaching that router.
- The configured app error handler returns `{ "error": "Internal Server Error" }` in production and the exception message outside production, using `err.status || 500`, when execution reaches it. It is registered before the API routers, so errors forwarded by route handlers do not pass through it; Express's default error handling may handle those instead.
- The server exposes no common pagination, sorting, idempotency, rate-limit, or version negotiation contract. Any such behavior is endpoint-specific.
- CORS origin/credential behavior is configured in `src/util/corsOptions.js`.
