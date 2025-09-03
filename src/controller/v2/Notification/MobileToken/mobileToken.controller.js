import prisma from "../../../../db/connectDb.js";

/**
 * Register mobile push token for user
 * POST /api/register-token
 */
export const registerMobileToken = async (req, res) => {
  try {
    const { userId, token, platform, deviceId } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ 
        error: 'userId and token are required' 
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if token already exists for this user and device
    const existingToken = await prisma.mobilePushToken.findFirst({
      where: {
        userId,
        token,
      }
    });

    if (existingToken) {
      // Update existing token with new device info
      await prisma.mobilePushToken.update({
        where: { id: existingToken.id },
        data: {
          platform: platform || existingToken.platform,
          deviceId: deviceId || existingToken.deviceId,
          updatedAt: new Date()
        }
      });
      
      return res.status(200).json({ 
        success: true, 
        message: 'Token updated successfully' 
      });
    }

    // Create new token record
    await prisma.mobilePushToken.create({
      data: {
        userId,
        token,
        platform: platform || 'unknown',
        deviceId: deviceId || null,
        isActive: true
      }
    });

    res.status(201).json({ 
      success: true, 
      message: 'Token registered successfully' 
    });

  } catch (error) {
    console.error('Error registering mobile token:', error);
    res.status(500).json({ error: 'Failed to register token' });
  }
};

/**
 * Get all tokens for a user
 * GET /api/tokens/:userId
 */
export const getUserTokens = async (req, res) => {
  try {
    const { userId } = req.params;

    const tokens = await prisma.mobilePushToken.findMany({
      where: { 
        userId,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(tokens);
  } catch (error) {
    console.error('Error fetching user tokens:', error);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
};

/**
 * Deactivate a token (when user logs out or uninstalls)
 * DELETE /api/tokens/:tokenId
 */
export const deactivateToken = async (req, res) => {
  try {
    const { tokenId } = req.params;

    await prisma.mobilePushToken.update({
      where: { id: tokenId },
      data: { isActive: false }
    });

    res.status(200).json({ 
      success: true, 
      message: 'Token deactivated successfully' 
    });
  } catch (error) {
    console.error('Error deactivating token:', error);
    res.status(500).json({ error: 'Failed to deactivate token' });
  }
};

/**
 * Clean up inactive or expired tokens
 * POST /api/tokens/cleanup
 */
export const cleanupTokens = async (req, res) => {
  try {
    // Remove tokens older than 30 days that are inactive
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await prisma.mobilePushToken.deleteMany({
      where: {
        AND: [
          { isActive: false },
          { updatedAt: { lt: thirtyDaysAgo } }
        ]
      }
    });

    res.status(200).json({ 
      success: true, 
      deletedCount: result.count,
      message: `Cleaned up ${result.count} inactive tokens` 
    });
  } catch (error) {
    console.error('Error cleaning up tokens:', error);
    res.status(500).json({ error: 'Failed to cleanup tokens' });
  }
};
