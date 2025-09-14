import crypto from 'crypto';
import jwt from 'jsonwebtoken';

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

function generateTokens(email, userId, accessTokenExpiry, refreshTokenExpiry) {
  try {
    const accessToken = jwt.sign(
      {
        email: email,
        id: userId
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: accessTokenExpiry }
    );
    const decoded = jwt.decode(accessToken);
    console.log(`[TOKEN] Access token will expire at ${new Date(decoded.exp * 1000).toISOString()}`);

    const refreshToken = jwt.sign(
      {
        email: email,
        id: userId

      },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: refreshTokenExpiry }
    );
    const decoded_r = jwt.decode(refreshToken);
    console.log(`[TOKEN] Refresh token will expire at ${new Date(decoded_r.exp * 1000).toISOString()}`);

    return { accessToken, refreshToken };
  } catch (error) {
    console.log(error);
    return null;
  }
}

function generateTokensWithOrg(email, userId, orgId, accessTokenExpiry, refreshTokenExpiry) {
  try {
    const accessToken = jwt.sign(
      {
        email: email,
        id: userId,
        orgId: orgId
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: accessTokenExpiry }
    );
    const decoded = jwt.decode(accessToken);
    console.log(`[TOKEN] Access token with orgId will expire at ${new Date(decoded.exp * 1000).toISOString()}`);

    const refreshToken = jwt.sign(
      {
        email: email,
        id: userId,
        orgId: orgId
      },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: refreshTokenExpiry }
    );
    const decoded_r = jwt.decode(refreshToken);
    console.log(`[TOKEN] Refresh token with orgId will expire at ${new Date(decoded_r.exp * 1000).toISOString()}`);

    return { accessToken, refreshToken };
  } catch (error) {
    console.log(error);
    return null;
  }
}

export { generateTokens, generateTokensWithOrg, generateId };

