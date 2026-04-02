const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Alumni = require('../models/Alumni');

const DEPARTMENT_MAP = {
  'Computer Science Engineering (CSE)': 'Computer Science (CSE)',
  'Electronics & Communication Engineering (ECE)': 'Electronics & Communication (ECE)'
};

const SAMPLE_PASSWORD = 'sample123';

const loadSampleAlumni = () => {
  const sampleFilePath = path.join(__dirname, '../../frontend/src/data/sampleAlumni.js');
  const fileContents = fs.readFileSync(sampleFilePath, 'utf8');
  const sanitized = fileContents.replace(/export\s+const\s+sampleAlumni\s*=\s*/, 'module.exports = ');
  const sandbox = { module: { exports: [] }, exports: {} };

  try {
    vm.runInNewContext(sanitized, sandbox, { filename: sampleFilePath });
    return Array.isArray(sandbox.module.exports) ? sandbox.module.exports : [];
  } catch (vmError) {
    const arrayMatch = fileContents.match(/export\s+const\s+sampleAlumni\s*=\s*(\[[\s\S]*\]);?\s*$/);

    if (!arrayMatch) {
      throw vmError;
    }

    return Function(`"use strict"; return (${arrayMatch[1]});`)();
  }
};

const mapDepartment = (department) => DEPARTMENT_MAP[department] || department;

const buildEnrollmentNumber = (sampleId) => `DIR${String(sampleId).padStart(4, '0')}`;

const ensureSampleAlumni = async () => {
  const sampleAlumni = loadSampleAlumni();
  let created = 0;
  let updated = 0;

  for (const entry of sampleAlumni) {
    const email = String(entry.email || '').toLowerCase().trim();
    if (!email) {
      continue;
    }

    const alumni = await Alumni.findOne({ email }).select('+password');
    const baseData = {
      name: entry.name,
      email,
      mobile: entry.mobile,
      graduationYear: Number(entry.graduationYear),
      department: mapDepartment(entry.department),
      jobTitle: entry.jobTitle,
      company: entry.company,
      linkedinUrl: entry.linkedinUrl,
      location: entry.location,
      bio: entry.bio,
      profileImage: entry.profileImage,
      status: 'approved',
      isVerified: true,
      registrationDate: entry.registrationDate ? new Date(entry.registrationDate) : new Date(),
      enrollmentNumber: buildEnrollmentNumber(entry.id),
      password: SAMPLE_PASSWORD
    };

    if (!alumni) {
      await Alumni.create(baseData);
      created += 1;
      continue;
    }

    let changed = false;
    const updates = {
      name: baseData.name,
      mobile: baseData.mobile,
      graduationYear: baseData.graduationYear,
      department: baseData.department,
      jobTitle: baseData.jobTitle,
      company: baseData.company,
      linkedinUrl: baseData.linkedinUrl,
      location: baseData.location,
      bio: baseData.bio,
      profileImage: baseData.profileImage,
      status: 'approved',
      isVerified: true
    };

    Object.entries(updates).forEach(([key, value]) => {
      if (alumni[key] !== value) {
        alumni[key] = value;
        changed = true;
      }
    });

    if (!alumni.enrollmentNumber) {
      alumni.enrollmentNumber = baseData.enrollmentNumber;
      changed = true;
    }

    if (!alumni.registrationDate && baseData.registrationDate) {
      alumni.registrationDate = baseData.registrationDate;
      changed = true;
    }

    if (!alumni.password) {
      alumni.password = SAMPLE_PASSWORD;
      changed = true;
    }

    if (changed) {
      await alumni.save();
      updated += 1;
    }
  }

  console.log(`Sample alumni sync complete. Created: ${created}, Updated: ${updated}`);
};

module.exports = {
  ensureSampleAlumni
};
