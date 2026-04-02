const express = require('express');
const passport = require('passport');
const mongoose = require('mongoose');
const Alumni = require('../models/Alumni');
const Admin = require('../models/Admin');
const { generateToken } = require('../middleware/auth');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// LinkedIn OAuth routes
router.get('/linkedin', passport.authenticate('linkedin', {
  scope: ['r_emailaddress', 'r_liteprofile']
}));

router.get('/linkedin/callback', 
  passport.authenticate('linkedin', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const alumni = req.user;
      
      // Generate JWT token
      const token = generateToken({
        id: alumni._id,
        email: alumni.email,
        type: 'alumni'
      });

      // Redirect to frontend with token
      res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}&type=alumni`);
    } catch (error) {
      console.error('LinkedIn callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=linkedin_error`);
    }
  }
);

// Alumni registration
router.post('/register', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database is unavailable. Please try again shortly.'
      });
    }

    const {
      name,
      email,
      enrollmentNumber,
      password,
      mobile,
      graduationYear,
      department,
      profileImage,
      jobTitle,
      company,
      location,
      bio,
      linkedinUrl,
      skills = [],
      achievements = []
    } = req.body;

    if (!enrollmentNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'Enrollment number and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const trimmedLinkedin = String(linkedinUrl || '').trim();
    if (trimmedLinkedin && !/^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?$/.test(trimmedLinkedin)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid LinkedIn profile URL (linkedin.com/in/...) or leave it empty'
      });
    }

    // Check if alumni already exists
    const existingAlumni = await Alumni.findOne({
      $or: [
        { email: String(email || '').toLowerCase() },
        { enrollmentNumber: String(enrollmentNumber || '').toUpperCase() }
      ]
    });
    if (existingAlumni) {
      return res.status(400).json({
        success: false,
        message: 'Alumni with this email or enrollment number already exists'
      });
    }

    // Create new alumni (pending approval)
    const alumni = new Alumni({
      name,
      email,
      enrollmentNumber,
      password,
      mobile,
      graduationYear,
      department,
      profileImage,
      jobTitle,
      company,
      location,
      bio,
      linkedinUrl: trimmedLinkedin || undefined,
      skills,
      achievements,
      status: 'pending',
      isVerified: false
    });

    await alumni.save();

    res.status(201).json({
      success: true,
      message: 'Registration submitted. Your account will be available after admin approval.',
      alumni: alumni.getSelfProfile()
    });

  } catch (error) {
    console.error('Registration error:', error);
    if (error.name === 'ValidationError') {
      const firstError = Object.values(error.errors || {})[0];
      return res.status(400).json({
        success: false,
        message: firstError?.message || 'Validation failed'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

// Alumni login (if they have a password set)
router.post('/login', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database is unavailable. Please try again shortly.'
      });
    }

    const { enrollmentNumber, email, identifier, password } = req.body;
    const loginValue = identifier || enrollmentNumber || email;

    if (!loginValue || !password) {
      return res.status(400).json({
        success: false,
        message: 'Enrollment number and password are required'
      });
    }

    const loginFilter = loginValue.includes('@')
      ? { email: String(loginValue).toLowerCase() }
      : { enrollmentNumber: String(loginValue).toUpperCase() };

    const alumni = await Alumni.findOne(loginFilter).select('+password');
    
    if (!alumni) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (alumni.status !== 'approved') {
      return res.status(401).json({
        success: false,
        message: 'Account pending approval'
      });
    }

    if (!alumni.password) {
      return res.status(401).json({
        success: false,
        message: 'Password not set for this account. Please register again.'
      });
    }

    const isMatch = await alumni.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken({
      id: alumni._id,
      email: alumni.email,
      type: 'alumni'
    });

    // Update last login
    alumni.lastLogin = new Date();
    await alumni.save();

    res.json({
      success: true,
      message: 'Login successful',
      token,
      alumni: alumni.getSelfProfile()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// Admin login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    if (admin.isLocked) {
      return res.status(401).json({
        success: false,
        message: 'Account is locked due to too many failed attempts'
      });
    }

    const isMatch = await admin.comparePassword(password);
    
    if (!isMatch) {
      await admin.incLoginAttempts();
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Reset login attempts on successful login
    await admin.resetLoginAttempts();
    admin.lastLogin = new Date();
    await admin.save();

    // Generate token
    const token = generateToken({
      id: admin._id,
      email: admin.email,
      type: 'admin'
    });

    res.json({
      success: true,
      message: 'Admin login successful',
      token,
      admin: admin.getSafeProfile()
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    if (req.userType === 'admin') {
      return res.json({
        success: true,
        user: req.admin.getSafeProfile(),
        userType: 'admin'
      });
    } else {
      return res.json({
        success: true,
        user: req.alumni.getSelfProfile(),
        userType: 'alumni'
      });
    }
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: error.message
    });
  }
});

// Update profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    if (req.userType === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Admin profiles cannot be updated through this endpoint'
      });
    }

    const allowedUpdates = [
      'name', 'email', 'mobile', 'graduationYear', 'department', 'jobTitle', 'company', 'location', 'bio',
      'linkedinUrl', 'skills', 'achievements', 'experience', 'contactPreferences', 'privacySettings'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const alumni = await Alumni.findByIdAndUpdate(
      req.alumni._id,
      {
        pendingUpdates: updates,
        pendingUpdateStatus: 'pending',
        pendingUpdateAt: new Date()
      },
      { new: true, runValidators: false }
    );

    res.json({
      success: true,
      message: 'Changes submitted for admin approval.',
      alumni: alumni.getSelfProfile(),
      pendingUpdates: updates
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// Logout (client-side token removal)
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

module.exports = router;
