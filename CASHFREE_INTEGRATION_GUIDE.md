# Cashfree Payment Gateway Integration Guide - Alkaa HR System

## 🎉 Integration Status: COMPLETE ✅

Your Alkaa HR System already has **full Cashfree integration** implemented! This guide will help you understand and use the existing integration.

## 📋 Table of Contents

1. [What's Already Implemented](#whats-already-implemented)
2. [Setup Instructions](#setup-instructions)
3. [Testing the Integration](#testing-the-integration)
4. [Using the Integration](#using-the-integration)
5. [API Endpoints](#api-endpoints)
6. [Frontend Components](#frontend-components)
7. [Database Schema](#database-schema)
8. [Troubleshooting](#troubleshooting)

## 🔧 What's Already Implemented

### ✅ Backend Components
- **Cashfree SDK**: `cashfree-pg@5.0.8` installed and configured
- **Environment Configuration**: Sandbox/Production environment support
- **Complete Payout Service**: Full `CashfreePayoutService` class with:
  - Single salary payout initiation
  - Bulk payout processing
  - Status checking and updates
  - Webhook handling for real-time updates
  - Account balance retrieval
- **API Routes**: Full REST API for all Cashfree operations
- **Database Integration**: Proper transaction tracking and status management
- **Error Handling**: Comprehensive error handling and logging

### ✅ Database Schema
- **SalaryRecord**: Enhanced with `paymentMode` and `paymentRef` fields
- **TransactionTable**: Complete with Cashfree-specific fields:
  - `cashfreeTransferId`: Unique transfer identifier
  - `cashfreeResponse`: Full API response storage
- **BankDetails**: Employee bank account information storage

### ✅ Frontend Components
- **CashfreePayoutManager**: Complete React component for payout management
- **Bulk Processing**: Support for processing multiple salaries at once
- **Status Tracking**: Real-time status updates and notifications

## 🚀 Setup Instructions

### Step 1: Get Cashfree Credentials

1. **Sign up** at [Cashfree Dashboard](https://www.cashfree.com)
2. **Navigate** to Developers → API Keys
3. **Generate** Test/Production API keys
4. **Note down**:
   - App ID (Client ID)
   - Secret Key

### Step 2: Configure Environment Variables

Update your `.env` file in the backend:

```env
# Cashfree Payment Gateway Configuration
CASHFREE_APP_ID=CF124567890  # Your actual App ID
CASHFREE_SECRET_KEY=cfsk_ma_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Your actual Secret Key
CASHFREE_ENVIRONMENT=sandbox  # Use 'production' for live
```

### Step 3: Enable Payouts in Cashfree Dashboard

1. **Login** to Cashfree Dashboard
2. **Go to** Payment Products → Payouts
3. **Enable** Payouts feature
4. **Complete** KYC verification if required
5. **Add** wallet balance for testing

### Step 4: Test the Integration

Run the provided test script:

```bash
cd backend
node test-cashfree-integration.js
```

## 🧪 Testing the Integration

### Automated Testing

The system includes a comprehensive test suite (`test-cashfree-integration.js`) that tests:

1. **Environment Setup**: Validates all required environment variables
2. **Database Schema**: Checks all required tables and relationships
3. **API Connection**: Tests connection to Cashfree servers
4. **Test Data Creation**: Creates sample salary records with bank details
5. **Payout Processing**: Tests actual payout initiation
6. **Status Checking**: Validates status update mechanisms

### Manual Testing

#### 1. Test Bank Account Details (Sandbox)
```javascript
// Use Cashfree's test bank details
{
  "bankName": "Test Bank",
  "accountNumber": "3333333333",
  "ifscCode": "YESB0CMSNOC",
  "accountHolderName": "Test Employee"
}
```

#### 2. Test UPI Details (Sandbox)
```javascript
{
  "vpa": "test@paytm"
}
```

## 💼 Using the Integration

### For HR Managers

1. **Access** the Payroll section in your Alkaa dashboard
2. **Generate** salary records for employees
3. **Navigate** to the Cashfree Payout Manager
4. **Review** pending salary records
5. **Initiate** individual or bulk payouts
6. **Track** payment status in real-time

### For Employees

- **Receive** automatic notifications when salary is processed
- **View** payment status in their salary slips
- **See** payment reference numbers for tracking

## 🔌 API Endpoints

### Payout Management

#### Initiate Single Payout
```http
POST /api/v2/payroll/cashfree/initiate-payout
Authorization: Bearer <token>
Content-Type: application/json

{
  "salaryRecordId": "salary_record_id",
  "incentive": 1000,
  "bonus": 500,
  "remarks": "Monthly salary payment"
}
```

#### Initiate Bulk Payout
```http
POST /api/v2/payroll/cashfree/bulk-payout
Authorization: Bearer <token>
Content-Type: application/json

{
  "salaryRecords": [
    {
      "salaryRecordId": "record_1",
      "incentive": 0,
      "bonus": 0
    },
    {
      "salaryRecordId": "record_2", 
      "incentive": 500,
      "bonus": 0
    }
  ]
}
```

#### Check Payout Status
```http
GET /api/v2/payroll/cashfree/status/{transferId}
Authorization: Bearer <token>
```

#### Get Account Balance
```http
GET /api/v2/payroll/cashfree/balance
Authorization: Bearer <token>
```

#### Webhook Endpoint (for Cashfree)
```http
POST /api/v2/payroll/cashfree/webhook
Content-Type: application/json

# Cashfree will send status updates here
```

## 🎨 Frontend Components

### CashfreePayoutManager Component

```jsx
import CashfreePayoutManager from '@/components/payroll/CashfreePayoutManager';

// Usage in your payroll dashboard
<CashfreePayoutManager />
```

**Features:**
- View pending salary records
- Initiate single payouts
- Process bulk payouts
- Check payment status
- View account balance
- Real-time status updates

## 🗄️ Database Schema

### Enhanced SalaryRecord Table
```sql
model SalaryRecord {
  id             String   @id @default(cuid())
  userId         String
  month          Int
  year           Int
  basicSalary    Float
  netSalary      Float
  status         String   -- "PENDING", "PROCESSING", "PAID", "FAILED"
  paymentMode    String?  -- "CASHFREE_PAYOUT", "MANUAL", etc.
  paymentRef     String?  -- Cashfree transfer ID
  processedAt    DateTime?
  remarks        String?
  -- ... other fields
}
```

### TransactionTable
```sql
model TransactionTable {
  id                 String   @id @default(cuid())
  senderUserId       String
  recieverUserId     String
  amount             Float
  type               String   -- "SALARY", "BONUS", etc.
  status             String   -- "PENDING", "COMPLETED", "FAILED"
  cashfreeTransferId String?  -- Unique Cashfree transfer ID
  cashfreeResponse   Json?    -- Full Cashfree API response
  utr                String?  -- Bank UTR number
  createdAt          DateTime @default(now())
  -- ... other fields
}
```

## 🔧 Configuration Options

### Environment Variables
```env
# Required
CASHFREE_APP_ID=your_app_id
CASHFREE_SECRET_KEY=your_secret_key
CASHFREE_ENVIRONMENT=sandbox|production

# Optional (with defaults)
CASHFREE_WEBHOOK_SECRET=your_webhook_secret
CASHFREE_TIMEOUT=30000
```

### Service Configuration
```javascript
// In cashfreePayoutService.js
const config = {
  environment: process.env.CASHFREE_ENVIRONMENT || 'sandbox',
  timeout: 30000,
  retryAttempts: 3,
  webhookVerification: true
};
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Environment Variables Not Set
**Error**: `Cashfree credentials not found in environment variables`
**Solution**: Ensure all required environment variables are set in your `.env` file

#### 2. Invalid Credentials
**Error**: `Authentication failed`
**Solution**: Verify your App ID and Secret Key in Cashfree dashboard

#### 3. Insufficient Balance
**Error**: `Insufficient balance in wallet`
**Solution**: Add funds to your Cashfree wallet in the dashboard

#### 4. Invalid Bank Details
**Error**: `Invalid beneficiary details`
**Solution**: Ensure employee bank details are complete and valid

#### 5. Webhook Not Receiving Updates
**Error**: Status not updating automatically
**Solution**: Configure webhook URL in Cashfree dashboard: `https://your-domain.com/api/v2/payroll/cashfree/webhook`

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=cashfree:*
```

### Test Connectivity
```bash
# Test if Cashfree API is reachable
curl -X GET "https://payout-api.cashfree.com/payout/v1/getBalance" \
  -H "X-Client-Id: YOUR_APP_ID" \
  -H "X-Client-Secret: YOUR_SECRET_KEY"
```

## 📞 Support

### Cashfree Support
- **Documentation**: [Cashfree Payout API Docs](https://docs.cashfree.com/docs/payout-api)
- **Support**: support@cashfree.com
- **Phone**: +91-8080808080

### Integration Support
- **Test Script**: Run `node test-cashfree-integration.js`
- **Logs**: Check application logs for detailed error messages
- **Status Page**: Monitor Cashfree service status

## 🚀 Going Live

### Pre-Production Checklist
- [ ] KYC verification completed in Cashfree dashboard
- [ ] Production API keys obtained
- [ ] Environment variable updated to `production`
- [ ] Webhook URL configured with production domain
- [ ] Sufficient wallet balance added
- [ ] Test transactions verified in production environment

### Production Configuration
```env
CASHFREE_ENVIRONMENT=production
CASHFREE_APP_ID=your_production_app_id
CASHFREE_SECRET_KEY=your_production_secret_key
```

---

## 🎉 Congratulations!

Your Alkaa HR System now has **full Cashfree integration** for automated salary payouts! The system is production-ready and includes:

✅ **Automated Payouts**: Direct bank transfer to employees  
✅ **Bulk Processing**: Handle multiple salaries at once  
✅ **Real-time Tracking**: Live status updates via webhooks  
✅ **Comprehensive UI**: User-friendly payout management interface  
✅ **Error Handling**: Robust error handling and retry mechanisms  
✅ **Security**: Secure API integration with proper authentication  

**Next Steps**: Configure your Cashfree credentials and start processing salary payouts automatically!
