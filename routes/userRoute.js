const express = require("express");
const userRouter = express.Router();
const bcrypt = require("bcryptjs");
const userModel = require("../models/userModel");
require("dotenv").config();
const jwt = require("jsonwebtoken");

// Middleware: Validates signup input fields (username, email, password)
const validateSignupInput = (req, res, next) => {
  const { username, email, password } = req.body;

  // Check required fields
  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields (username, email, password) are required",
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format",
    });
  }

  // Password length check
  if (password.length < 4) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 4 characters long",
    });
  }

  next();
};

// POST /signup — Create new user with validation & hashed password
userRouter.post("/signup", validateSignupInput, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if email or username already exist
    const existingUser = await userModel.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      let conflictField, message;

      if (existingUser.email === email && existingUser.username === username) {
        conflictField = "both";
        message = "Both email and username are already in use";
      } else if (existingUser.email === email) {
        conflictField = "email";
        message = "User with this email already exists";
      } else {
        conflictField = "username";
        message = "This username is already taken";
      }

      return res.status(409).json({
        success: false,
        message,
        conflict: conflictField,
        available: false,
      });
    }

    // Hash password with bcrypt and configured salt rounds
    const passwordHash = bcrypt.hashSync(password, +process.env.SALT_ROUND);

    // Create new user document
    const newUser = new userModel({
      username,
      email,
      password: passwordHash,
      collaborator: [], // Initialize empty collaborators array
    });

    const savedUser = await newUser.save();

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        id: savedUser._id,
        username: savedUser.username,
        email: savedUser.email,
        collaborator: savedUser.collaborator,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST /login — Authenticate user, generate access & refresh tokens, set cookies
userRouter.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Username and password are required"
      });
    }

    // Find user by username
    const user = await userModel.findOne({ username });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Generate JWT tokens with different expirations
    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.ACCESS_SECRET,
      { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Set tokens as httpOnly cookies for security
    res.cookie('accessToken', accessToken, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Return tokens and user info in response JSON too (optional, handy for front-end)
    return res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// POST /logout — Clear the JWT cookies to log out user
userRouter.post('/logout', (req, res) => {

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/', // Must match the login cookie path
  };

  // Clear both access and refresh tokens from cookies
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);

  return res.status(200).json({
    success: true,
    message: "Logged out successfully"
  });
});

module.exports = userRouter;
