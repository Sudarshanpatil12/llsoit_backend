const Admin = require('../models/Admin');

const DEFAULT_ADMIN = {
  username: 'admin',
  email: 'admin@rgpv.com',
  password: 'admin123',
  role: 'super_admin',
  permissions: {
    manageAlumni: true,
    manageEvents: true,
    manageUsers: true,
    viewAnalytics: true,
    sendNotifications: true
  },
  isActive: true,
  profile: {
    firstName: 'SOIT',
    lastName: 'Admin',
    department: 'School of Information Technology'
  }
};

const ensureDefaultAdmin = async () => {
  let admin = await Admin.findOne({ email: DEFAULT_ADMIN.email });

  if (!admin) {
    admin = new Admin(DEFAULT_ADMIN);
    await admin.save();
    console.log(`Default admin created: ${DEFAULT_ADMIN.email}`);
    return;
  }

  admin.username = DEFAULT_ADMIN.username;
  admin.role = DEFAULT_ADMIN.role;
  admin.permissions = DEFAULT_ADMIN.permissions;
  admin.isActive = true;
  admin.profile = DEFAULT_ADMIN.profile;

  const passwordMatches = await admin.comparePassword(DEFAULT_ADMIN.password);
  if (!passwordMatches) {
    admin.password = DEFAULT_ADMIN.password;
  }

  await admin.save();
  console.log(`Default admin ready: ${DEFAULT_ADMIN.email}`);
};

module.exports = {
  DEFAULT_ADMIN,
  ensureDefaultAdmin
};
