const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const bcrypt = require('bcryptjs');

const alumniSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  enrollmentNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false
  },
  mobile: {
    type: String,
    required: true,
    trim: true
  },
  
  // Academic Information
  graduationYear: {
    type: Number,
    required: true,
    min: 2000,
    max: new Date().getFullYear() + 5
  },
  department: {
    type: String,
    required: true,
    enum: [
      'Computer Science (CSE)',
      'Electronics & Communication (ECE)',
      'Mechanical Engineering (ME)',
      'Information Technology (IT)',
      'Civil Engineering (CE)',
      'Electrical Engineering (EE)',
      'Biotechnology (BT)',
      'Chemical Engineering (CHE)',
      'Computer Science & Business Systems (CSBS)',
      'AI & Machine Learning (AIML)',
      'CSE Data Science (CSE-DS)',
      'Cybersecurity',
      'IoT & Automation (IoTA)'
    ]
  },
  degree: {
    type: String,
    default: 'B.Tech'
  },
  
  // Professional Information
  jobTitle: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  bio: {
    type: String,
    maxlength: 1000,
    trim: true
  },
  
  // LinkedIn Integration
  linkedinUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?$/.test(v);
      },
      message: 'Please provide a valid LinkedIn URL'
    }
  },
  linkedinId: {
    type: String,
    unique: true,
    sparse: true
  },
  linkedinData: {
    profilePicture: String,
    headline: String,
    summary: String,
    experience: [{
      title: String,
      company: String,
      duration: String,
      description: String
    }],
    education: [{
      school: String,
      degree: String,
      field: String,
      duration: String
    }],
    skills: [String],
    lastUpdated: Date
  },
  
  // Profile Management
  profileImage: {
    type: String,
    default: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&q=80'
  },
  skills: [{
    type: String,
    trim: true
  }],
  achievements: [{
    type: String,
    trim: true
  }],
  experience: [{
    type: String,
    trim: true
  }],
  careerHistory: [{
    company: {
      type: String,
      trim: true
    },
    title: {
      type: String,
      trim: true
    },
    location: {
      type: String,
      trim: true
    },
    startDate: {
      type: String,
      trim: true
    },
    endDate: {
      type: String,
      trim: true
    },
    isCurrent: {
      type: Boolean,
      default: false
    },
    summary: {
      type: String,
      trim: true
    }
  }],
  pendingUpdates: {
    type: Object,
    default: null
  },
  pendingUpdateStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none'
  },
  pendingUpdateAt: Date,
  
  // Status and Verification
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationExpires: Date,
  
  // Registration and Updates
  registrationDate: {
    type: Date,
    default: Date.now
  },
  lastLogin: Date,
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  // Contact Preferences
  contactPreferences: {
    email: { type: Boolean, default: true },
    phone: { type: Boolean, default: true },
    linkedin: { type: Boolean, default: true }
  },
  
  // Privacy Settings
  privacySettings: {
    profileVisibility: {
      type: String,
      enum: ['public', 'alumni-only', 'private'],
      default: 'alumni-only'
    },
    showEmail: { type: Boolean, default: false },
    showPhone: { type: Boolean, default: false },
    showLocation: { type: Boolean, default: true }
  }
}, {
  timestamps: true
});

// Indexes for better performance
alumniSchema.index({ graduationYear: 1 });
alumniSchema.index({ department: 1 });
alumniSchema.index({ company: 1 });
alumniSchema.index({ status: 1 });

// Virtual for full profile URL
alumniSchema.virtual('profileUrl').get(function() {
  return `/api/alumni/${this._id}`;
});

// Method to update LinkedIn data
alumniSchema.methods.updateLinkedInData = function(linkedinData) {
  this.linkedinData = {
    ...this.linkedinData,
    ...linkedinData,
    lastUpdated: new Date()
  };
  this.lastUpdated = new Date();
  return this.save();
};

// Method to get public profile data
alumniSchema.methods.getPublicProfile = function() {
  const profile = this.toObject();
  
  // Remove sensitive information based on privacy settings
  if (!profile.privacySettings.showEmail) {
    delete profile.email;
  }
  if (!profile.privacySettings.showPhone) {
    delete profile.mobile;
  }
  if (!profile.privacySettings.showLocation) {
    delete profile.location;
  }
  
  // Remove internal fields
  delete profile.verificationToken;
  delete profile.verificationExpires;
  delete profile.linkedinId;
  delete profile.password;
  delete profile.pendingUpdates;
  delete profile.pendingUpdateStatus;
  delete profile.pendingUpdateAt;
  delete profile.__v;
  
  return profile;
};

alumniSchema.methods.getSelfProfile = function() {
  const profile = this.toObject();
  delete profile.password;
  delete profile.verificationToken;
  delete profile.verificationExpires;
  delete profile.linkedinId;
  delete profile.__v;
  return profile;
};

alumniSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Pre-save middleware to update lastUpdated
alumniSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

alumniSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Add pagination plugin
alumniSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Alumni', alumniSchema);
