const express = require('express');
const Alumni = require('../models/Alumni');
const { authenticateToken, requireApproved } = require('../middleware/auth');

const router = express.Router();

// Get all alumni (public endpoint)
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      department,
      graduationYear,
      company,
      search,
      status = 'approved'
    } = req.query;

    // Build filter object
    const filter = { status };
    
    if (department) filter.department = department;
    if (graduationYear) filter.graduationYear = parseInt(graduationYear);
    if (company) filter.company = new RegExp(company, 'i');
    
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { company: new RegExp(search, 'i') },
        { jobTitle: new RegExp(search, 'i') },
        { bio: new RegExp(search, 'i') }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { graduationYear: -1, name: 1 }
    };

    const alumni = await Alumni.paginate(filter, options);

    // Transform results to public profiles
    const transformedAlumni = alumni.docs.map(alumni => alumni.getPublicProfile());

    res.json({
      success: true,
      data: transformedAlumni,
      pagination: {
        currentPage: alumni.page,
        totalPages: alumni.totalPages,
        totalAlumni: alumni.totalDocs,
        hasNextPage: alumni.hasNextPage,
        hasPrevPage: alumni.hasPrevPage
      }
    });

  } catch (error) {
    console.error('Get alumni error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alumni',
      error: error.message
    });
  }
});

// Get alumni by ID (public endpoint)
router.get('/:id', async (req, res) => {
  try {
    const alumni = await Alumni.findById(req.params.id);
    
    if (!alumni) {
      return res.status(404).json({
        success: false,
        message: 'Alumni not found'
      });
    }

    if (alumni.status !== 'approved') {
      return res.status(404).json({
        success: false,
        message: 'Alumni not found'
      });
    }

    res.json({
      success: true,
      data: alumni.getPublicProfile()
    });

  } catch (error) {
    console.error('Get alumni by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alumni',
      error: error.message
    });
  }
});

// Get alumni statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await Alumni.aggregate([
      {
        $match: { status: 'approved' }
      },
      {
        $group: {
          _id: null,
          totalAlumni: { $sum: 1 },
          departments: { $addToSet: '$department' },
          companies: { $addToSet: '$company' },
          graduationYears: { $addToSet: '$graduationYear' }
        }
      },
      {
        $project: {
          _id: 0,
          totalAlumni: 1,
          totalDepartments: { $size: '$departments' },
          totalCompanies: { $size: '$companies' },
          graduationYearRange: {
            min: { $min: '$graduationYears' },
            max: { $max: '$graduationYears' }
          }
        }
      }
    ]);

    // Get department-wise counts
    const departmentStats = await Alumni.aggregate([
      {
        $match: { status: 'approved' }
      },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get year-wise counts
    const yearStats = await Alumni.aggregate([
      {
        $match: { status: 'approved' }
      },
      {
        $group: {
          _id: '$graduationYear',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: -1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalAlumni: 0,
          totalDepartments: 0,
          totalCompanies: 0,
          graduationYearRange: { min: null, max: null }
        },
        departmentStats,
        yearStats
      }
    });

  } catch (error) {
    console.error('Get alumni stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alumni statistics',
      error: error.message
    });
  }
});

// Search alumni
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 20 } = req.query;

    const searchRegex = new RegExp(query, 'i');
    
    const alumni = await Alumni.find({
      status: 'approved',
      $or: [
        { name: searchRegex },
        { company: searchRegex },
        { jobTitle: searchRegex },
        { department: searchRegex },
        { bio: searchRegex },
        { skills: { $in: [searchRegex] } }
      ]
    })
    .limit(parseInt(limit))
    .sort({ graduationYear: -1, name: 1 });

    const transformedAlumni = alumni.map(alumni => alumni.getPublicProfile());

    res.json({
      success: true,
      data: transformedAlumni,
      count: transformedAlumni.length
    });

  } catch (error) {
    console.error('Search alumni error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message
    });
  }
});

// Get current user's profile (authenticated)
router.get('/profile/me', authenticateToken, async (req, res) => {
  try {
    if (req.userType !== 'alumni') {
      return res.status(403).json({
        success: false,
        message: 'Alumni access required'
      });
    }

    res.json({
      success: true,
      data: req.alumni
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: error.message
    });
  }
});

// Update LinkedIn data manually
router.post('/linkedin/sync', authenticateToken, async (req, res) => {
  try {
    if (req.userType !== 'alumni') {
      return res.status(403).json({
        success: false,
        message: 'Alumni access required'
      });
    }

    const { linkedinUrl } = req.body;
    
    if (!linkedinUrl) {
      return res.status(400).json({
        success: false,
        message: 'LinkedIn URL is required'
      });
    }

    // Update LinkedIn URL
    req.alumni.linkedinUrl = linkedinUrl;
    await req.alumni.save();

    res.json({
      success: true,
      message: 'LinkedIn URL updated successfully',
      data: req.alumni.getPublicProfile()
    });

  } catch (error) {
    console.error('LinkedIn sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync LinkedIn data',
      error: error.message
    });
  }
});

module.exports = router;

