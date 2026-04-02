const axios = require('axios');

class LinkedInService {
  constructor() {
    this.clientId = process.env.LINKEDIN_CLIENT_ID;
    this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    this.redirectUri = process.env.LINKEDIN_CALLBACK_URL;
  }

  // Get LinkedIn profile data using access token
  async getProfileData(accessToken) {
    try {
      const response = await axios.get('https://api.linkedin.com/v2/people/~', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          projection: '(id,firstName,lastName,profilePicture(displayImage~:playableStreams),headline,summary)'
        }
      });

      return response.data;
    } catch (error) {
      console.error('LinkedIn API Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch LinkedIn profile data');
    }
  }

  // Get LinkedIn email using access token
  async getEmail(accessToken) {
    try {
      const response = await axios.get('https://api.linkedin.com/v2/emailAddress', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          q: 'members',
          projection: '(elements*(handle~))'
        }
      });

      if (response.data.elements && response.data.elements.length > 0) {
        return response.data.elements[0]['handle~'].emailAddress;
      }
      return null;
    } catch (error) {
      console.error('LinkedIn Email API Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch LinkedIn email');
    }
  }

  // Get LinkedIn experience data
  async getExperience(accessToken) {
    try {
      const response = await axios.get('https://api.linkedin.com/v2/people/~/positions', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          projection: '(elements*(id,title,company,location,startDate,endDate,description))'
        }
      });

      return response.data.elements || [];
    } catch (error) {
      console.error('LinkedIn Experience API Error:', error.response?.data || error.message);
      return [];
    }
  }

  // Get LinkedIn education data
  async getEducation(accessToken) {
    try {
      const response = await axios.get('https://api.linkedin.com/v2/people/~/educations', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          projection: '(elements*(id,schoolName,degreeName,fieldOfStudy,startDate,endDate))'
        }
      });

      return response.data.elements || [];
    } catch (error) {
      console.error('LinkedIn Education API Error:', error.response?.data || error.message);
      return [];
    }
  }

  // Get LinkedIn skills
  async getSkills(accessToken) {
    try {
      const response = await axios.get('https://api.linkedin.com/v2/people/~/skills', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          projection: '(elements*(id,name))'
        }
      });

      return response.data.elements?.map(skill => skill.name) || [];
    } catch (error) {
      console.error('LinkedIn Skills API Error:', error.response?.data || error.message);
      return [];
    }
  }

  // Extract LinkedIn profile ID from URL
  extractProfileId(linkedinUrl) {
    const match = linkedinUrl.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  }

  // Validate LinkedIn URL format
  isValidLinkedInUrl(url) {
    const linkedinRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?$/;
    return linkedinRegex.test(url);
  }

  // Format LinkedIn data for alumni profile
  formatLinkedInData(profileData, email, experience = [], education = [], skills = []) {
    return {
      profilePicture: profileData.profilePicture?.displayImage?.elements?.[0]?.identifiers?.[0]?.identifier || null,
      headline: profileData.headline || '',
      summary: profileData.summary || '',
      experience: experience.map(exp => ({
        title: exp.title || '',
        company: exp.company?.name || '',
        duration: this.formatDuration(exp.startDate, exp.endDate),
        description: exp.description || ''
      })),
      education: education.map(edu => ({
        school: edu.schoolName || '',
        degree: edu.degreeName || '',
        field: edu.fieldOfStudy || '',
        duration: this.formatDuration(edu.startDate, edu.endDate)
      })),
      skills: skills,
      lastUpdated: new Date()
    };
  }

  // Format date duration
  formatDuration(startDate, endDate) {
    if (!startDate) return '';
    
    const start = new Date(startDate.year, (startDate.month || 1) - 1);
    const end = endDate ? new Date(endDate.year, (endDate.month || 1) - 1) : new Date();
    
    const startStr = start.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    const endStr = endDate ? end.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : 'Present';
    
    return `${startStr} - ${endStr}`;
  }
}

module.exports = new LinkedInService();

