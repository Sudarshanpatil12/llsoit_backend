const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Workshop',
      'Seminar',
      'Conference',
      'Networking',
      'Reunion',
      'Career Fair',
      'Webinar',
      'Social Event',
      'Sports',
      'Cultural',
      'Technical Talk',
      'Other'
    ]
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  image: {
    type: String,
    default: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop&q=80'
  },
  registrationUrl: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Please provide a valid URL'
    }
  },
  attendees: {
    type: Number,
    default: 0
  },
  maxAttendees: {
    type: Number,
    default: null
  },
  registrationDeadline: {
    type: Date
  },
  organizer: {
    name: String,
    email: String,
    phone: String
  },
  tags: [{
    type: String,
    trim: true
  }],
  requirements: [{
    type: String,
    trim: true
  }],
  isOnline: {
    type: Boolean,
    default: false
  },
  meetingLink: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Please provide a valid meeting link'
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alumni',
    required: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alumni'
  },
  approvedAt: Date
}, {
  timestamps: true
});

// Indexes
eventSchema.index({ date: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ isApproved: 1 });

// Virtual for registration status
eventSchema.virtual('isRegistrationOpen').get(function() {
  if (!this.registrationDeadline) return true;
  return new Date() < this.registrationDeadline;
});

// Virtual for attendance status
eventSchema.virtual('isFull').get(function() {
  if (!this.maxAttendees) return false;
  return this.attendees >= this.maxAttendees;
});

// Add pagination plugin
eventSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Event', eventSchema);
