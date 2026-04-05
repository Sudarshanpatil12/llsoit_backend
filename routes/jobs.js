const express = require('express');
const Job = require('../models/Job');
const { authenticateToken, requireApproved } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      category,
      location
    } = req.query;

    const filter = { status: 'approved' };

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (location && location !== 'all') {
      filter.location = new RegExp(location, 'i');
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { title: searchRegex },
        { company: searchRegex },
        { location: searchRegex },
        { description: searchRegex },
        { skills: { $in: [searchRegex] } }
      ];
    }

    const jobs = await Job.paginate(filter, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 },
      populate: {
        path: 'submittedBy',
        select: 'name company jobTitle profileImage'
      }
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
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs',
      error: error.message
    });
  }
});

router.post('/', authenticateToken, requireApproved, async (req, res) => {
  try {
    if (req.userType !== 'alumni') {
      return res.status(403).json({
        success: false,
        message: 'Alumni access required'
      });
    }

    const payload = {
      ...req.body,
      submittedBy: req.alumni._id,
      status: 'pending'
    };

    const job = await Job.create(payload);

    res.status(201).json({
      success: true,
      message: 'Job submitted for admin approval.',
      data: job
    });
  } catch (error) {
    console.error('Create job error:', error);
    if (error.name === 'ValidationError') {
      const firstError = Object.values(error.errors || {})[0];
      return res.status(400).json({
        success: false,
        message: firstError?.message || 'Validation failed'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to submit job',
      error: error.message
    });
  }
});

router.get('/mine', authenticateToken, requireApproved, async (req, res) => {
  try {
    if (req.userType !== 'alumni') {
      return res.status(403).json({
        success: false,
        message: 'Alumni access required'
      });
    }

    const jobs = await Job.find({ submittedBy: req.alumni._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: jobs
    });
  } catch (error) {
    console.error('Get my jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your jobs',
      error: error.message
    });
  }
});

module.exports = router;
