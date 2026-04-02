const express = require('express');
const Event = require('../models/Event');
const Alumni = require('../models/Alumni');
const { authenticateToken, requireApproved } = require('../middleware/auth');

const router = express.Router();

// Get all events (public endpoint)
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      status = 'upcoming',
      search,
      sortBy = 'date',
      sortOrder = 'asc'
    } = req.query;

    // Build filter
    const filter = { 
      isApproved: true,
      ...(status && { status })
    };
    
    if (category && category !== 'all') {
      filter.category = category;
    }
    
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
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
      error: error.message
    });
  }
});

// Get event by ID (public endpoint)
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'name email department graduationYear');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (!event.isApproved) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      data: event
    });

  } catch (error) {
    console.error('Get event by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event',
      error: error.message
    });
  }
});

// Get event categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await Event.aggregate([
      {
        $match: { isApproved: true }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('Get event categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event categories',
      error: error.message
    });
  }
});

// Get upcoming events
router.get('/upcoming/list', async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const events = await Event.find({
      isApproved: true,
      status: 'upcoming',
      date: { $gte: new Date() }
    })
    .sort({ date: 1 })
    .limit(parseInt(limit))
    .populate('createdBy', 'name email department');

    res.json({
      success: true,
      data: events
    });

  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming events',
      error: error.message
    });
  }
});

// Create event (authenticated alumni only)
router.post('/', authenticateToken, requireApproved, async (req, res) => {
  try {
    if (req.userType !== 'alumni') {
      return res.status(403).json({
        success: false,
        message: 'Alumni access required'
      });
    }

    const {
      title,
      description,
      date,
      time,
      location,
      category,
      image,
      registrationUrl,
      maxAttendees,
      registrationDeadline,
      organizer,
      tags = [],
      requirements = [],
      isOnline = false,
      meetingLink
    } = req.body;

    const event = new Event({
      title,
      description,
      date: new Date(date),
      time,
      location,
      category,
      image,
      registrationUrl,
      maxAttendees,
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      organizer,
      tags,
      requirements,
      isOnline,
      meetingLink,
      createdBy: req.alumni._id,
      isApproved: false // Requires admin approval
    });

    await event.save();

    res.status(201).json({
      success: true,
      message: 'Event created successfully. It will be reviewed by admin before publication.',
      data: event
    });

  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create event',
      error: error.message
    });
  }
});

// Update event (authenticated alumni only - own events)
router.put('/:id', authenticateToken, requireApproved, async (req, res) => {
  try {
    if (req.userType !== 'alumni') {
      return res.status(403).json({
        success: false,
        message: 'Alumni access required'
      });
    }

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user owns the event
    if (event.createdBy.toString() !== req.alumni._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own events'
      });
    }

    const allowedUpdates = [
      'title', 'description', 'date', 'time', 'location', 'category',
      'image', 'registrationUrl', 'maxAttendees', 'registrationDeadline',
      'organizer', 'tags', 'requirements', 'isOnline', 'meetingLink'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Reset approval status when event is updated
    updates.isApproved = false;
    updates.approvedBy = null;
    updates.approvedAt = null;

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Event updated successfully. It will be reviewed by admin again.',
      data: updatedEvent
    });

  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update event',
      error: error.message
    });
  }
});

// Delete event (authenticated alumni only - own events)
router.delete('/:id', authenticateToken, requireApproved, async (req, res) => {
  try {
    if (req.userType !== 'alumni') {
      return res.status(403).json({
        success: false,
        message: 'Alumni access required'
      });
    }

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user owns the event
    if (event.createdBy.toString() !== req.alumni._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own events'
      });
    }

    await Event.findByIdAndDelete(req.params.id);

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

// Get user's events
router.get('/user/my-events', authenticateToken, requireApproved, async (req, res) => {
  try {
    if (req.userType !== 'alumni') {
      return res.status(403).json({
        success: false,
        message: 'Alumni access required'
      });
    }

    const { page = 1, limit = 10 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };

    const events = await Event.paginate(
      { createdBy: req.alumni._id },
      options
    );

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
    console.error('Get user events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your events',
      error: error.message
    });
  }
});

module.exports = router;

