import crypto from 'crypto';
import jwt from 'jsonwebtoken';

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
export { generateTokens };

