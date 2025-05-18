const jwt = require("jsonwebtoken");

// Middleware checks if user is authenticated via tokens sent in headers (not cookies)
const authMiddleware = async (req, res, next) => {
  // Expect access token in Authorization header: "Bearer <token>"
  const authHeader = req.headers.authorization || "";

  // Extract token from "Bearer <token>" format
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7, authHeader.length)
    : null;

  // Also allow refresh token in headers (custom header)
  const refreshToken = req.headers["x-refresh-token"] || null;

  // If no tokens, unauthorized
  if (!accessToken && !refreshToken) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    // Verify access token first
    const decoded = jwt.verify(accessToken, process.env.ACCESS_SECRET);
    req.userId = decoded.userId;
    return next();
  } catch (accessTokenError) {
    // Access token invalid or expired, try refresh token
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Session expired, please login again",
      });
    }

    try {
      // Verify refresh token
      const decodedRefresh = jwt.verify(refreshToken, process.env.REFRESH_SECRET);

      // Generate new access token
      const newAccessToken = jwt.sign(
        { userId: decodedRefresh.userId },
        process.env.ACCESS_SECRET,
        { expiresIn: "15m" }
      );

      // Attach user ID to request
      req.userId = decodedRefresh.userId;

      // Make new access token available in response locals (optional)
      res.locals.newAccessToken = newAccessToken;

      return next();
    } catch (refreshTokenError) {
      return res.status(401).json({
        success: false,
        message: "Session expired, please login again",
      });
    }
  }
};

module.exports = authMiddleware;
