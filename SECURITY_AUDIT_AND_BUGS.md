# Alkaa Backend - Comprehensive Security Audit & Codebase Bug Report

**Date:** November 2026  
**Target Codebase:** `alkaa-backend` (Node.js, Express, Prisma ORM, PostgreSQL/Neon)  
**Audit Scope:** Authentication, Authorization & Multi-Tenancy (BOLA/IDOR), Input Validation, Session Management, API Endpoints, and Dependencies.

---

## 1. Executive Summary

A comprehensive code audit of the `alkaa-backend` codebase revealed several **Critical** and **High-severity** security vulnerabilities alongside significant business-logic bugs. The primary concerns stem from **missing multi-tenant organization scoping** in several v2 controllers, **unauthenticated Super-Admin routes**, **unrestricted password reset endpoints**, and **weak cryptographic implementations**.

These findings justify the decision to create a clean, parallel TypeScript backend (`alkaa-backend-ts`) where tenant-scoping middleware, Zod schema validation, and typed RBAC permissions can be enforced natively at compile time.

---

## 2. Vulnerability Severity Matrix

| ID | Finding | Severity | Category | Affected File(s) |
|---|---|---|---|---|
| **SEC-01** | Unauthenticated Super-Admin CRUD & Takeover | **CRITICAL** | Broken Authentication / BOLA | `src/router/v2/child/superAdmin.router.js`<br>`src/app.js` |
| **SEC-02** | Cross-Tenant Salary Data Leak & Unrestricted Modification | **CRITICAL** | Multi-Tenant Data Exposure | `src/controller/v2/Salary/salary.controller.js` |
| **SEC-03** | Cross-Tenant Bank Account Exposure | **CRITICAL** | Multi-Tenant Data Exposure | `src/controller/v2/bank/Bank.controller.js` |
| **SEC-04** | Cross-Tenant Full Attendance Record Exposure | **CRITICAL** | Multi-Tenant Data Exposure | `src/controller/v2/Attendance/attendance.controller.js` |
| **SEC-05** | Account Takeover via `setPassword` / Token Replay | **CRITICAL** | Authentication Logic Flaw | `src/controller/v1/general/general.controller.js` |
| **SEC-06** | Horizontal Privilege Escalation in Role Assignment | **HIGH** | Broken Object-Level Auth (BOLA) | `src/controller/v2/user/User.controller.js` |
| **SEC-07** | Broken `roleCheck` Middleware | **HIGH** | Logic Bug / Crash Vulnerability | `src/middleware/roleCheck.js` |
| **SEC-08** | Insecure Cryptographic Pseudo-Random Generator for OTP | **MEDIUM** | Cryptographic Weakness | `src/controller/v1/general/general.controller.js` |
| **SEC-09** | Global Cookie Re-transmission Performance & Leak Risk | **MEDIUM** | Session / Cookie Management | `src/app.js` |
| **SEC-10** | Missing Multi-Tenant Verification on Department Queries | **MEDIUM** | Broken Access Control | `src/controller/v2/Department/department.controller.js` |
| **SEC-11** | Deprecated & Vulnerable Dependencies (`html-pdf`, `crypto`) | **LOW** | Dependency Hygiene | `package.json` |
| **SEC-12** | Excessive Access Token Expiration (2 Days) | **LOW** | Session Security | `src/controller/v1/general/general.controller.js` |

---

## 3. Detailed Vulnerability Analysis & Proof of Mechanics

### [SEC-01] CRITICAL: Unauthenticated Super-Admin CRUD & Account Takeover
* **Location:** `src/router/v2/child/superAdmin.router.js` (lines 37–47) and `src/app.js` (lines 85–100)
* **Mechanics:**
  In `src/app.js`, `/api/v2/` declares `/super-admin/` inside the `publicRoutes` array, completely bypassing the global `validateTokenMiddlewear`.
  In `superAdmin.router.js`:
  ```javascript
  router.get("/", getSuperAdmins);
  router.get("/:id", getSuperAdminById);
  router.put("/:id", updateSuperAdmin);
  router.patch("/:id", updateSuperAdmin);
  router.delete("/:id", deleteSuperAdmin);
  ```
  None of these routes are guarded by `validateSuperAdminTokenMiddleware`.
* **Impact:** Any unauthenticated attacker on the public internet can send a `PUT /api/v2/super-admin/<id>` with a new password and take over any Super Admin account, or call `DELETE /api/v2/super-admin/<id>` to delete the entire administrative root account.
* **Remediation:** Remove `/super-admin/` from public routes. Require `validateSuperAdminTokenMiddleware` on all CRUD operations.

---

### [SEC-02] CRITICAL: Cross-Tenant Salary Data Leak & Unrestricted Mutation
* **Location:** `src/controller/v2/Salary/salary.controller.js` (lines 2–72)
* **Mechanics:**
  ```javascript
  export const getSalaries = async (req, res) => {
      try {
          const salaries = await prisma.salaryRecord.findMany();
          res.status(200).json(salaries);
      } catch (error) { ... }
  };
  ```
  `findMany()` performs **zero** filtering by `orgId` or `userId`. Furthermore, `createSalary`, `updateSalary`, and `deleteSalary` take arbitrary `id` or `userId` from request bodies without verifying that the requesting user has administrative rights within that specific organization.
* **Impact:** Any logged-in employee of Company A can view, edit, or delete every salary record and net pay of employees in Company B and Company C.
* **Remediation:** Enforce `where: { user: { orgId: req.user.orgId } }` on all queries and require the `view_salary_all` permission preset.

---

### [SEC-03] CRITICAL: Cross-Tenant Bank Account Exposure
* **Location:** `src/controller/v2/bank/Bank.controller.js` (lines 27–31)
* **Mechanics:**
  ```javascript
  const hasViewAllPermission = await prisma.rolePermission.findFirst({ ... });
  if (!hasViewAllPermission) return res.status(403);
  
  const banks = await prisma.bankDetails.findMany();
  res.status(200).json(banks);
  ```
  If a user has the `view_bank_all_user` permission in their own company, the controller fetches all bank records from the table with no tenant scope (`prisma.bankDetails.findMany()`).
* **Impact:** An administrator of one organization gains access to all bank account numbers, IFSC codes, branch names, and account holder names across all organizations on the platform.
* **Remediation:** Filter by `where: { user: { orgId: req.user.orgId } }`.

---

### [SEC-04] CRITICAL: Cross-Tenant Attendance Record Exposure
* **Location:** `src/controller/v2/Attendance/attendance.controller.js` (lines 10–18)
* **Mechanics:**
  ```javascript
  export const getAttendances = async (req, res) => {
      const attendances = await prisma.attendanceRecord.findMany();
      res.status(200).json(attendances);
  };
  ```
* **Impact:** Any authenticated user can download all biometric, check-in, check-out, and geolocation coordinates of all companies on the platform.
* **Remediation:** Scope all attendance lookups to `req.user.orgId`.

---

### [SEC-05] CRITICAL: Account Takeover via `setPassword` / Token Replay
* **Location:** `src/controller/v1/general/general.controller.js` (lines 519–544)
* **Mechanics:**
  ```javascript
  const { password, verificationToken } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.findFirst({
      where: { verificationToken }
  });
  if (user) {
      const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: { hashedPassword, status: "active" },
      });
      res.status(200).json(updatedUser);
  }
  ```
  1. `verificationToken` is **never invalidated** (not set to `null`). An attacker who obtains an onboarding link once can indefinitely change the user's password.
  2. If `verificationToken` is `null` or omitted in `req.body`, Prisma matches against `verificationToken: null` (which all active users have), resetting the password of whichever user is retrieved first.
  3. `res.status(200).json(updatedUser)` returns the full record, leaking the `hashedPassword` back to the browser.
* **Remediation:** 
  - Validate that `verificationToken` is a non-empty string with an expiration timestamp.
  - Set `verificationToken: null` upon successful password update.
  - Exclude `hashedPassword` from the response payload.

---

### [SEC-06] HIGH: Horizontal Privilege Escalation in Role Assignment
* **Location:** `src/controller/v2/user/User.controller.js` (lines 1062–1140)
* **Mechanics:**
  `export const updateUserRole = async (req, res)` extracts `{ userId, prevRole, roleId }` from parameters.
  It queries `targetUser = await findUserByIdOrEmployeeId(userId)`.
  It does **not** check:
  1. Whether `req.user.orgId === targetUser.orgId`.
  2. Whether `req.user` has permissions to manage roles.
* **Impact:** Any logged-in user can assign an `Org_Admin` role to themselves or any account across organizations.
* **Remediation:** Enforce role-assignment permission check and tenant equality assertion.

---

### [SEC-07] HIGH: Broken `roleCheck` Middleware & Unhandled Exceptions
* **Location:** `src/middleware/roleCheck.js` (lines 3–20)
* **Mechanics:**
  ```javascript
  const roleCheckManager = (req, res, next) => {
      const user = req.user;
      if (user.role !== "MANAGER") {
          return res.status(403).json({ error: "You are not authorized" });
      } else if (!user) {
          return res.status(404).json({ error: "User not found" });
      }
      next();
  }
  ```
  1. `validateToken.js` populates `req.user` with `{ id, email, orgId, firstName, lastName }`. It **never sets `req.user.role`**.
  2. Because `req.user.role` is always `undefined`, any route guarded by this middleware will always return `403 Forbidden`.
  3. Line 5 accesses `user.role` before line 7 checks `!user`. If `user` is ever undefined, it crashes with an uncaught `TypeError: Cannot read properties of undefined (reading 'role')`.
* **Remediation:** Roles in Alkaa are a many-to-many relationship (`UserRole -> Role`). Role checks must query user roles through Prisma or carry signed role claims inside the JWT token.

---

### [SEC-08] MEDIUM: Insecure Cryptographic Pseudo-Random Generator for OTP
* **Location:** `src/controller/v1/general/general.controller.js` (line 296)
* **Mechanics:**
  ```javascript
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  ```
  `Math.random()` in Node.js uses the V8 xorshift128+ algorithm, which is not cryptographically secure and is vulnerable to internal state reconstruction from consecutive outputs.
* **Remediation:** Replace with Node.js built-in `crypto.randomInt(100000, 1000000).toString()`.

---

### [SEC-09] MEDIUM: Global Cookie Re-transmission Overhead
* **Location:** `src/app.js` (lines 34–44)
* **Mechanics:**
  On **every single request** (including `/health` and static assets), the middleware calls `res.clearCookie('accessToken')` and `res.cookie('accessToken', ...)` with `sameSite: 'none'`.
* **Impact:** Adds duplicate headers, confuses HTTP client caching, and increases CSRF exposure when paired with wildcard CORS options.
* **Remediation:** Only set cookies in login, refresh, and logout controller handlers.

---

### [SEC-10] MEDIUM: Missing Organization Verification on Department Queries
* **Location:** `src/controller/v2/Department/department.controller.js` (lines 5–23)
* **Mechanics:**
  `getDepartment` takes `orgId` from `req.params` and queries `where: { orgId }` without verifying whether `req.user.orgId === orgId` or if the user is a platform super-admin.
* **Impact:** Organization structures, employee headcounts, and hierarchy can be crawled across organizations.
* **Remediation:** Always force `where: { orgId: req.user.orgId }` unless authenticated as a platform Super Admin.

---

### [SEC-11] LOW: Deprecated & Vulnerable Dependencies
* **Location:** `package.json`
* **Details:**
  1. `"html-pdf": "^3.0.1"`: Relies on PhantomJS, an abandoned headless browser with documented CVEs. Puppeteer is already in `dependencies` and should be used exclusively.
  2. `"crypto": "^1.0.1"`: Unneeded external package. `crypto` is a built-in Node.js module.
* **Remediation:** Remove `crypto` and `html-pdf` from `package.json`.

---

### [SEC-12] LOW: Excessive Access Token Expiration (2 Days)
* **Location:** `src/controller/v1/general/general.controller.js` (lines 128, 247, 674, 824)
* **Mechanics:** Access tokens are issued with `"2d"` lifetime. If an access token is compromised or an employee is terminated, the token remains valid for 48 hours.
* **Remediation:** Reduce Access Token lifetime to `15m`–`1h` and rely on Refresh Token rotation (`/refresh-token`) for continuous sessions.

---

## 4. Architectural Recommendations for `alkaa-backend-ts`

When initializing `alkaa-backend-ts`, implement these design patterns from the start:

1. **Scoped Prisma Middleware / Extensions:**
   Create an organization-scoped Prisma client extension that automatically injects `where: { orgId }` into all multi-tenant models (`User`, `Department`, `SalaryRecord`, `AttendanceRecord`, `BankDetails`).
2. **Zod Validation at Route Boundaries:**
   Define strict Zod schemas for every request. Strip unexpected fields to prevent mass assignment.
3. **Strongly Typed Express Context:**
   ```typescript
   export interface AuthenticatedUser {
     id: string;
     email: string;
     orgId: string;
     roles: string[];
     permissions: string[];
     isSuperAdmin: boolean;
   }

   declare global {
     namespace Express {
       interface Request {
         user?: AuthenticatedUser;
       }
     }
   }
   ```
4. **Standardized Response DTOs:**
   Use DTO mappers that explicitly exclude sensitive fields (`hashedPassword`, `verificationToken`, `refreshToken`) before sending JSON to clients.
5. **Security Headers & Rate Limiting:**
   Install `helmet` and `express-rate-limit` on authentication endpoints (`/login`, `/check-email`, `/verify-otp`).

