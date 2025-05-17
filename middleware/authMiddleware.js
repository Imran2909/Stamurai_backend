// Importing jsonwebtoken to handle JWT verification and signing
const jwt = require('jsonwebtoken');

// This middleware checks if the user is authenticated via tokens (access & refresh)
const authMiddleware = async (req, res, next) => {
    
  // Grab the access and refresh tokens from cookies
  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;
  
  // If neither token exists, user is clearly not logged in
  if (!accessToken && !refreshToken) {
    return res.status(401).json({
      success: false, 
      message: "Authentication required"
    });
  }

  try {
    // Try verifying the access token first
    const decoded = jwt.verify(accessToken, process.env.ACCESS_SECRET);

    // If it's valid, attach userId to the request object and move on
    req.userId = decoded.userId;
    return next();
  } catch (accessTokenError) {
    // Access token is invalid or has expired

    // If no refresh token either, we can’t proceed
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Session expired, please login again"
      });
    }

    try {
      // Try verifying the refresh token
      const decodedRefresh = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
      
      // Generate a fresh access token using info from the refresh token
      const newAccessToken = jwt.sign(
        { userId: decodedRefresh.userId },
        process.env.ACCESS_SECRET,
        { expiresIn: '15m' } // Short lifespan to keep it secure
      );

      // Set the new access token as a secure HTTP-only cookie
      res.cookie('accessToken', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Use secure cookies only in production
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000 // 15 minutes in milliseconds
      });

      // Attach user ID from the refresh token to the request
      req.userId = decodedRefresh.userId;

      // Optional: Make the new access token available in response for frontend if needed
      res.locals.newAccessToken = newAccessToken;
      
      return next();
    } catch (refreshTokenError) {
      // If refresh token is also invalid/expired, we log the user out
      return res.status(401).json({
        success: false,
        message: "Session expired, please login again"
      });
    }
  }
};

// Export the middleware to use it wherever authentication is needed
module.exports = authMiddleware;
