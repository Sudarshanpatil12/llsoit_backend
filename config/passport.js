const passport = require('passport');
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
const Alumni = require('../models/Alumni');

// LinkedIn OAuth Strategy
passport.use(new LinkedInStrategy({
  clientID: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  callbackURL: process.env.LINKEDIN_CALLBACK_URL,
  scope: ['r_emailaddress', 'r_liteprofile', 'r_fullprofile'],
  passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    // Check if alumni already exists with this LinkedIn ID
    let alumni = await Alumni.findOne({ linkedinId: profile.id });
    
    if (alumni) {
      // Update existing alumni with fresh LinkedIn data
      alumni.linkedinData = {
        profilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
        headline: profile.headline || '',
        summary: profile.summary || '',
        lastUpdated: new Date()
      };
      
      await alumni.save();
      return done(null, alumni);
    }
    
    // Check if alumni exists with same email
    alumni = await Alumni.findOne({ email: profile.emails[0].value });
    
    if (alumni) {
      // Link LinkedIn account to existing alumni
      alumni.linkedinId = profile.id;
      alumni.linkedinUrl = profile.publicProfileUrl;
      alumni.linkedinData = {
        profilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
        headline: profile.headline || '',
        summary: profile.summary || '',
        lastUpdated: new Date()
      };
      
      await alumni.save();
      return done(null, alumni);
    }
    
    // Create new alumni profile from LinkedIn data
    const newAlumni = new Alumni({
      name: profile.displayName,
      email: profile.emails[0].value,
      linkedinId: profile.id,
      linkedinUrl: profile.publicProfileUrl,
      linkedinData: {
        profilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
        headline: profile.headline || '',
        summary: profile.summary || '',
        lastUpdated: new Date()
      },
      status: 'pending', // Requires manual approval
      isVerified: false
    });
    
    await newAlumni.save();
    return done(null, newAlumni);
    
  } catch (error) {
    console.error('LinkedIn OAuth Error:', error);
    return done(error, null);
  }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const alumni = await Alumni.findById(id);
    done(null, alumni);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;

