# Production Deployment Checklist for Notification System

## 🚨 CRITICAL - Must Complete Before Deployment

### 1. Firebase Service Account Setup
- [ ] Download Firebase service account JSON from Firebase Console
- [ ] Convert JSON to base64: `base64 -i service-account.json`
- [ ] Add `GOOGLE_APPLICATION_CREDENTIALS_JSON` to production environment variables
- [ ] Test FCM service initialization in production

### 2. Environment Variables
- [ ] Update `DATABASE_URL` to production database
- [ ] Set `NODE_ENV=production`
- [ ] Update `FRONTEND_DOMAIN` and `CLIENT_URL` to production URLs
- [ ] Generate new secure JWT secrets (minimum 32 characters)
- [ ] Update CORS allowed origins in `corsOptions.js`
- [ ] Set production email service credentials

### 3. Database
- [ ] ✅ Database already migrated (as mentioned)
- [ ] Verify `MobilePushToken` table exists and is working
- [ ] Clean up any development tokens in production database

### 4. Security
- [ ] Change `SUPER_ADMIN_SECRET_KEY` for production
- [ ] Ensure all API keys are production keys (not test/sandbox)
- [ ] Update Cashfree to production environment if using payments

### 5. Notification System Verification
- [ ] Test FCM service initialization
- [ ] Test single device notification
- [ ] Test bulk notifications
- [ ] Test organization-wide notifications
- [ ] Verify invalid token cleanup works

## 📋 RECOMMENDED - Should Complete

### 6. Monitoring & Logging
- [ ] Set up error monitoring (Sentry, LogRocket, etc.)
- [ ] Configure proper logging for production
- [ ] Set up health check monitoring
- [ ] Monitor FCM token cleanup process

### 7. Performance
- [ ] Review notification sending rate limits
- [ ] Implement notification queuing if needed for large organizations
- [ ] Consider batch processing for bulk notifications

### 8. Documentation
- [ ] Document FCM setup process for team
- [ ] Document notification API endpoints
- [ ] Update deployment documentation

## 🧪 Testing Commands

### Test FCM Service in Production
```bash
# Test endpoint (create this for testing)
curl -X POST https://your-api.com/api/v2/notification/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"userId": "test-user-id"}'
```

### Check FCM Initialization
```javascript
// Add this temporary endpoint for testing
app.get('/test/fcm-status', (req, res) => {
  res.json({
    fcmInitialized: !!fcmService.fcm,
    projectId: fcmService.projectId,
    timestamp: new Date().toISOString()
  });
});
```

## ⚠️ Common Production Issues

1. **FCM Authentication Fails**
   - Solution: Verify service account credentials are correct
   - Check: `GOOGLE_APPLICATION_CREDENTIALS_JSON` is properly base64 encoded

2. **CORS Errors**
   - Solution: Update `allowedOrigins` with production frontend URL
   - Check: Frontend domain matches exactly (including https/http)

3. **Invalid Tokens**
   - Solution: Clean up development tokens from database
   - Monitor: Token cleanup logs in production

4. **Rate Limiting**
   - Solution: Implement queuing for bulk notifications
   - Monitor: FCM response rates and errors

## 📞 Emergency Contacts
- Firebase Console: https://console.firebase.google.com/
- Vercel Dashboard: https://vercel.com/dashboard
- Database Provider: [Your database provider]
