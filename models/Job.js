const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    required: true,
    trim: true
  },
  companyLogo: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Remote'],
    default: 'Full-time'
  },
  category: {
    type: String,
    trim: true,
    default: 'Technology'
  },
  salary: {
    type: Number,
    min: 0,
    default: 0
  },
  salaryLabel: {
    type: String,
    trim: true,
    default: ''
  },
  experienceRequired: {
    type: Number,
    min: 0,
    default: 0
  },
  companySize: {
    type: String,
    trim: true,
    default: ''
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  requirements: [{
    type: String,
    trim: true
  }],
  skills: [{
    type: String,
    trim: true
  }],
  applyLink: {
    type: String,
    required: true,
    trim: true
  },
  contactEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alumni',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  approvedAt: Date,
  rejectionReason: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ company: 1 });
jobSchema.index({ category: 1 });
jobSchema.index({ submittedBy: 1 });

jobSchema.virtual('postedDate').get(function postedDate() {
  return this.createdAt;
});

jobSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Job', jobSchema);
