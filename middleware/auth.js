const jwt = require('jsonwebtoken');
const Alumni = require('../models/Alumni');
const Admin = require('../models/Admin');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if it's an admin token
    if (decoded.type === 'admin') {
      const admin = await Admin.findById(decoded.id).select('-password');
      if (!admin || !admin.isActive) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid admin token' 
        });
      }
      req.admin = admin;
      req.userType = 'admin';
    } else {
      // Regular alumni token
      const alumni = await Alumni.findById(decoded.id);
      if (!alumni) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid token' 
        });
      }
      req.alumni = alumni;
      req.userType = 'alumni';
    }

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.userType !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
  next();
};

// Middleware to check if alumni is verified
const requireVerified = (req, res, next) => {
  if (req.userType === 'alumni' && !req.alumni.isVerified) {
    return res.status(403).json({ 
      success: false, 
      message: 'Account verification required' 
    });
  }
  next();
};

// Middleware to check if alumni is approved
const requireApproved = (req, res, next) => {
  if (req.userType === 'alumni' && req.alumni.status !== 'approved') {
    return res.status(403).json({ 
      success: false, 
      message: 'Account approval required' 
    });
  }
  next();
};

// Generate JWT token
const generateToken = (payload, expiresIn = '7d') => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireVerified,
  requireApproved,
  generateToken
};

