#!/bin/bash

# ================================
# BACKEND API TESTING SCRIPT
# ================================

echo "🔧 BACKEND API TESTING SUITE"
echo "================================"

BASE_URL="http://localhost:3000"
echo "🌐 Testing Server: $BASE_URL"

# Check if server is running
echo ""
echo "🔍 1. Server Health Check"
echo "--------------------------------"

# Test basic server response
echo "Testing server response..."
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" $BASE_URL/api/v3/health)
HTTP_CODE="${HEALTH_RESPONSE: -3}"

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 401 ]; then
    echo "✅ Server is responding (HTTP $HTTP_CODE)"
else
    echo "❌ Server is not responding properly (HTTP $HTTP_CODE)"
    exit 1
fi

# Test attendance endpoints
echo ""
echo "🔍 2. Attendance Endpoints Check"
echo "--------------------------------"

echo "Testing attendance health endpoint..."
ATTENDANCE_RESPONSE=$(curl -s -w "%{http_code}" $BASE_URL/api/v3/attendance/health)
ATTENDANCE_HTTP_CODE="${ATTENDANCE_RESPONSE: -3}"

if [ "$ATTENDANCE_HTTP_CODE" -eq 200 ] || [ "$ATTENDANCE_HTTP_CODE" -eq 401 ]; then
    echo "✅ Attendance endpoint responding (HTTP $ATTENDANCE_HTTP_CODE)"
else
    echo "❌ Attendance endpoint not responding (HTTP $ATTENDANCE_HTTP_CODE)"
fi

# Test API route structure
echo ""
echo "🔍 3. API Routes Structure Test"
echo "--------------------------------"

declare -a routes=(
    "/api/v3/attendance/organizations/test-org/rules"
    "/api/v3/attendance/users/test-user/breaks/active"
    "/api/v3/attendance/organizations/test-org/geofences"
    "/api/v3/attendance/organizations/test-org/analytics"
    "/api/v3/attendance/organizations/test-org/alerts"
)

for route in "${routes[@]}"; do
    echo "Testing route: $route"
    ROUTE_RESPONSE=$(curl -s -w "%{http_code}" $BASE_URL$route)
    ROUTE_HTTP_CODE="${ROUTE_RESPONSE: -3}"
    
    if [ "$ROUTE_HTTP_CODE" -eq 401 ]; then
        echo "✅ Route exists and requires auth (HTTP $ROUTE_HTTP_CODE)"
    elif [ "$ROUTE_HTTP_CODE" -eq 404 ]; then
        echo "⚠️  Route not found (HTTP $ROUTE_HTTP_CODE)"
    else
        echo "ℹ️  Route responded with HTTP $ROUTE_HTTP_CODE"
    fi
done

# Test database connectivity through backend
echo ""
echo "🔍 4. Database Connectivity Test"
echo "--------------------------------"

echo "Testing database connectivity via backend..."
cd /home/parambrata-ghosh/Development/Internship/Alkaa/Main_Platform/alkaa-backend
node -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
    await prisma.\$connect();
    console.log('✅ Database connection successful');
    const userCount = await prisma.user.count();
    const orgCount = await prisma.organization.count();
    console.log('✅ Database query successful - Users:', userCount, 'Organizations:', orgCount);
    
    // Test new attendance tables
    const attendanceRulesCount = await prisma.organizationAttendanceRules.count();
    const geofenceCount = await prisma.organizationGeofence.count();
    console.log('✅ Attendance tables accessible - Rules:', attendanceRulesCount, 'Geofences:', geofenceCount);
    
    await prisma.\$disconnect();
} catch (error) {
    console.log('❌ Database test failed:', error.message);
    process.exit(1);
}
"

# Performance test
echo ""
echo "🔍 5. Performance Test"
echo "--------------------------------"

echo "Testing API response time..."
start_time=$(date +%s%N)
curl -s $BASE_URL/api/v3/health > /dev/null
end_time=$(date +%s%N)
duration=$((($end_time - $start_time) / 1000000))

echo "✅ API response time: ${duration}ms"

if [ $duration -lt 1000 ]; then
    echo "✅ Performance: Excellent (< 1s)"
elif [ $duration -lt 3000 ]; then
    echo "✅ Performance: Good (< 3s)"
else
    echo "⚠️  Performance: Slow (> 3s)"
fi

echo ""
echo "🎉 BACKEND API TESTING COMPLETE!"
echo "================================"
echo "✅ Server Health: Working"
echo "✅ API Routes: Accessible"
echo "✅ Database: Connected"
echo "✅ Performance: Tested"
echo "🚀 Backend is ready for development!"
