import crypto from 'crypto';
import jwt from 'jsonwebtoken';

function generateTokens(email,userId, accessTokenExpiry, refreshTokenExpiry) {
    try {
      const accessToken = jwt.sign(
        { email: email,
          id:userId
         },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: accessTokenExpiry }
      );
    
      const refreshToken = jwt.sign(
        { email: email,
          id:userId

         },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: refreshTokenExpiry }
      );
    
      return { accessToken, refreshToken };
    } catch (error) {
      console.log(error);
      return null;
    }
  }
  export { generateTokens };