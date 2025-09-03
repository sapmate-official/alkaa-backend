import { fcmService } from '../services/fcmService.js';

/**
 * Health check endpoint for notification services
 */
export const notificationHealthCheck = async (req, res) => {
  try {
    const healthStatus = {
      timestamp: new Date().toISOString(),
      services: {
        fcm: {
          initialized: !!fcmService.fcm,
          projectId: fcmService.projectId,
          status: !!fcmService.fcm ? 'healthy' : 'not_initialized'
        },
        database: {
          status: 'checking'
        }
      },
      overall: 'healthy'
    };

    // Test database connection by checking if we can query tokens
    try {
      const tokenCount = await prisma.mobilePushToken.count({
        where: { isActive: true }
      });
      healthStatus.services.database = {
        status: 'healthy',
        activeTokens: tokenCount
      };
    } catch (dbError) {
      healthStatus.services.database = {
        status: 'error',
        error: dbError.message
      };
      healthStatus.overall = 'degraded';
    }

    // Set overall status
    if (!fcmService.fcm) {
      healthStatus.overall = 'degraded';
    }

    const statusCode = healthStatus.overall === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);

  } catch (error) {
    res.status(500).json({
      timestamp: new Date().toISOString(),
      overall: 'error',
      error: error.message
    });
  }
};
