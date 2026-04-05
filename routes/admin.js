const express = require('express');
const Alumni = require('../models/Alumni');
const Admin = require('../models/Admin');
const Event = require('../models/Event');
const Job = require('../models/Job');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendApprovalEmail } = require('../utils/emailService');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Admin dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalAlumni,
      pendingAlumni,
      approvedAlumni,
      totalEvents,
      upcomingEvents,
      totalAdmins
    ] = await Promise.all([
      Alumni.countDocuments(),
      Alumni.countDocuments({ status: 'pending' }),
      Alumni.countDocuments({ status: 'approved' }),
      Event.countDocuments(),
      Event.countDocuments({ status: 'upcoming' }),
      Admin.countDocuments({ isActive: true })
    ]);

    // Recent registrations
    const recentRegistrations = await Alumni.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email department graduationYear status createdAt');

    // Recent events
    const recentEvents = await Event.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title category date status createdAt');

    res.json({
      success: true,
      data: {
        stats: {
          totalAlumni,
          pendingAlumni,
          approvedAlumni,
          totalEvents,
          upcomingEvents,
          totalAdmins
        },
        recentRegistrations,
        recentEvents
      }
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
});

// Get all alumni with admin details
router.get('/alumni', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      department,
      graduationYear,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (department) filter.department = department;
    if (graduationYear) filter.graduationYear = parseInt(graduationYear);
    
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { company: new RegExp(search, 'i') },
        { jobTitle: new RegExp(search, 'i') }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
    };

    const alumni = await Alumni.paginate(filter, options);

    res.json({
      success: true,
      data: alumni.docs,
      pagination: {
        currentPage: alumni.page,
        totalPages: alumni.totalPages,
        totalAlumni: alumni.totalDocs,
        hasNextPage: alumni.hasNextPage,
        hasPrevPage: alumni.hasPrevPage
      }
    });

  } catch (error) {
    console.error('Admin get alumni error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alumni',
      error: error.message
    });
  }
});

// Get a single alumni record with full admin details
router.get('/alumni/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const alumni = await Alumni.findById(id);

    if (!alumni) {
      return res.status(404).json({
        success: false,
        message: 'Alumni not found'
      });
    }

    res.json({
      success: true,
      data: alumni
    });
  } catch (error) {
    console.error('Admin get alumni by id error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alumni details',
      error: error.message
    });
  }
});

// Update alumni status
router.put('/alumni/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const update = {
      status,
      ...(status === 'approved' && { isVerified: true })
    };

    const alumni = await Alumni.findByIdAndUpdate(id, update, { new: true });

    if (!alumni) {
      return res.status(404).json({
        success: false,
        message: 'Alumni not found'
      });
    }

    let emailResult = null;
    if (status === 'approved') {
      try {
        emailResult = await sendApprovalEmail(alumni);
      } catch (emailError) {
        console.error('Approval email error:', emailError);
      }
    }

    res.json({
      success: true,
      message: `Alumni status updated to ${status}`,
      data: alumni,
      email: emailResult
    });

  } catch (error) {
    console.error('Update alumni status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update alumni status',
      error: error.message
    });
  }
});

// Approve pending alumni profile updates
router.put('/alumni/:id/updates/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const alumni = await Alumni.findById(id);

    if (!alumni) {
      return res.status(404).json({
        success: false,
        message: 'Alumni not found'
      });
    }

    if (!alumni.pendingUpdates) {
      return res.status(400).json({
        success: false,
        message: 'No pending updates to approve'
      });
    }

    Object.assign(alumni, alumni.pendingUpdates);
    alumni.pendingUpdates = null;
    alumni.pendingUpdateStatus = 'approved';
    alumni.pendingUpdateAt = null;

    await alumni.save();

    let emailResult = null;
    try {
      emailResult = await sendApprovalEmail(alumni);
    } catch (emailError) {
      console.error('Update approval email error:', emailError);
    }

    res.json({
      success: true,
      message: 'Pending updates approved',
      data: alumni,
      email: emailResult
    });
  } catch (error) {
    console.error('Approve updates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve updates',
      error: error.message
    });
  }
});

// Reject pending alumni profile updates
router.put('/alumni/:id/updates/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const alumni = await Alumni.findById(id);

    if (!alumni) {
      return res.status(404).json({
        success: false,
        message: 'Alumni not found'
      });
    }

    if (!alumni.pendingUpdates) {
      return res.status(400).json({
        success: false,
        message: 'No pending updates to reject'
      });
    }

    alumni.pendingUpdates = null;
    alumni.pendingUpdateStatus = 'rejected';
    alumni.pendingUpdateAt = null;

    await alumni.save();

    res.json({
      success: true,
      message: 'Pending updates rejected',
      data: alumni
    });
  } catch (error) {
    console.error('Reject updates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject updates',
      error: error.message
    });
  }
});

// Update alumni profile directly from admin panel
router.put('/alumni/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'name',
      'email',
      'mobile',
      'department',
      'graduationYear',
      'jobTitle',
      'company',
      'location',
      'bio',
      'linkedinUrl',
      'status',
      'isVerified',
      'enrollmentNumber',
      'skills',
      'achievements',
      'experience',
      'careerHistory',
      'profileImage'
    ];

    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (updates.email) {
      updates.email = String(updates.email).toLowerCase().trim();
    }

    if (updates.enrollmentNumber) {
      updates.enrollmentNumber = String(updates.enrollmentNumber).toUpperCase().trim();
    }

    if (updates.status && !['pending', 'approved', 'rejected'].includes(updates.status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid alumni status'
      });
    }

    const alumni = await Alumni.findById(id);

    if (!alumni) {
      return res.status(404).json({
        success: false,
        message: 'Alumni not found'
      });
    }

    Object.assign(alumni, updates);
    alumni.lastUpdated = new Date();
    alumni.pendingUpdates = null;
    alumni.pendingUpdateStatus = 'none';
    alumni.pendingUpdateAt = null;

    if (updates.status === 'approved' && updates.isVerified === undefined) {
      alumni.isVerified = true;
    }

    await alumni.save();

    res.json({
      success: true,
      message: 'Alumni profile updated successfully',
      data: alumni
    });
  } catch (error) {
    console.error('Admin update alumni error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update alumni profile',
      error: error.message
    });
  }
});

router.get('/jobs', async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 100
    } = req.query;

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const jobs = await Job.paginate(filter, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 },
      populate: [
        { path: 'submittedBy', select: 'name email company jobTitle profileImage' },
        { path: 'approvedBy', select: 'name email' }
      ]
    });

    res.json({
      success: true,
      data: jobs.docs,
      pagination: {
        currentPage: jobs.page,
        totalPages: jobs.totalPages,
        totalJobs: jobs.totalDocs,
        hasNextPage: jobs.hasNextPage,
        hasPrevPage: jobs.hasPrevPage
      }
    });
  } catch (error) {
    console.error('Admin get jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs',
      error: error.message
    });
  }
});

router.put('/jobs/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason = '' } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job status'
      });
    }

    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    job.status = status;
    job.rejectionReason = status === 'rejected' ? rejectionReason : '';
    job.approvedBy = status === 'approved' ? req.admin._id : undefined;
    job.approvedAt = status === 'approved' ? new Date() : undefined;

    await job.save();
    await job.populate([
      { path: 'submittedBy', select: 'name email company jobTitle profileImage' },
      { path: 'approvedBy', select: 'name email' }
    ]);

    res.json({
      success: true,
      message: `Job ${status} successfully`,
      data: job
    });
  } catch (error) {
    console.error('Admin update job status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job status',
      error: error.message
    });
  }
});

// Delete alumni
router.delete('/alumni/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const alumni = await Alumni.findByIdAndDelete(id);

    if (!alumni) {
      return res.status(404).json({
        success: false,
        message: 'Alumni not found'
      });
    }

    res.json({
      success: true,
      message: 'Alumni deleted successfully'
    });

  } catch (error) {
    console.error('Delete alumni error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete alumni',
      error: error.message
    });
  }
});

// Get all events with admin details
router.get('/events', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      isApproved,
      search,
      sortBy = 'date',
      sortOrder = 'asc'
    } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (isApproved !== undefined) filter.isApproved = isApproved === 'true';
    
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { location: new RegExp(search, 'i') }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      populate: 'createdBy'
    };

    const events = await Event.paginate(filter, options);

    res.json({
      success: true,
      data: events.docs,
      pagination: {
        currentPage: events.page,
        totalPages: events.totalPages,
        totalEvents: events.totalDocs,
        hasNextPage: events.hasNextPage,
        hasPrevPage: events.hasPrevPage
      }
    });

  } catch (error) {
    console.error('Admin get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
      error: error.message
    });
  }
});

// Approve/reject event
router.put('/events/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    const event = await Event.findByIdAndUpdate(
      id,
      { 
        isApproved,
        approvedBy: req.admin._id,
        approvedAt: new Date()
      },
      { new: true }
    ).populate('createdBy');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      message: `Event ${isApproved ? 'approved' : 'rejected'}`,
      data: event
    });

  } catch (error) {
    console.error('Approve event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update event approval',
      error: error.message
    });
  }
});

// Delete event
router.delete('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findByIdAndDelete(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });

  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete event',
      error: error.message
    });
  }
});

// Create admin user
router.post('/admins', async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      role = 'admin',
      permissions = {},
      profile = {}
    } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      $or: [{ email }, { username }]
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin with this email or username already exists'
      });
    }

    const admin = new Admin({
      username,
      email,
      password,
      role,
      permissions,
      profile
    });

    await admin.save();

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: admin.getSafeProfile()
    });

  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create admin',
      error: error.message
    });
  }
});

// Get all admins
router.get('/admins', async (req, res) => {
  try {
    const admins = await Admin.find()
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: admins
    });

  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admins',
      error: error.message
    });
  }
});

// Update admin
router.put('/admins/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating password through this endpoint
    delete updates.password;

    const admin = await Admin.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.json({
      success: true,
      message: 'Admin updated successfully',
      data: admin
    });

  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update admin',
      error: error.message
    });
  }
});

// Delete admin
router.delete('/admins/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Don't allow deleting self
    if (id === req.admin._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const admin = await Admin.findByIdAndDelete(id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.json({
      success: true,
      message: 'Admin deleted successfully'
    });

  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete admin',
      error: error.message
    });
  }
});

module.exports = router;
