# RGPV Alumni Portal Backend

A comprehensive backend API for the RGPV School of Information Technology Alumni Portal with MongoDB integration and LinkedIn OAuth authentication.

## Features

- **Authentication & Authorization**
  - LinkedIn OAuth integration
  - JWT-based authentication
  - Role-based access control (Admin, Alumni)
  - Password hashing with bcrypt

- **Alumni Management**
  - Alumni registration and profile management
  - LinkedIn profile data synchronization
  - Profile verification and approval system
  - Advanced search and filtering

- **Event Management**
  - Event creation and management
  - Event approval system
  - Category-based organization
  - Registration tracking

- **Admin Panel**
  - Dashboard with statistics
  - Alumni approval system
  - Event management
  - User management

- **Database**
  - MongoDB with Mongoose ODM
  - Pagination support
  - Data validation and indexing

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: Passport.js with LinkedIn OAuth
- **Security**: JWT, bcrypt
- **Validation**: Mongoose validation
- **Pagination**: mongoose-paginate-v2

## Installation

1. **Clone and navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/rgpv_alumni
   
   # JWT Secret
   JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
   
   # Server
   PORT=5000
   NODE_ENV=development
   
   # LinkedIn OAuth
   LINKEDIN_CLIENT_ID=your_linkedin_client_id
   LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
   LINKEDIN_CALLBACK_URL=http://localhost:5000/auth/linkedin/callback
   
   # Frontend URL
   FRONTEND_URL=http://localhost:3000
   ```

4. **Start MongoDB**
   ```bash
   # Using MongoDB service
   sudo systemctl start mongod
   
   # Or using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

5. **Run the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Alumni registration
- `POST /api/auth/login` - Alumni login
- `POST /api/auth/admin/login` - Admin login
- `GET /api/auth/linkedin` - LinkedIn OAuth
- `GET /api/auth/linkedin/callback` - LinkedIn callback
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/logout` - Logout

### Alumni
- `GET /api/alumni` - Get all alumni (public)
- `GET /api/alumni/:id` - Get alumni by ID (public)
- `GET /api/alumni/stats/overview` - Get alumni statistics
- `GET /api/alumni/search/:query` - Search alumni
- `GET /api/alumni/profile/me` - Get current alumni profile
- `POST /api/alumni/linkedin/sync` - Sync LinkedIn data

### Events
- `GET /api/events` - Get all events (public)
- `GET /api/events/:id` - Get event by ID (public)
- `GET /api/events/categories/list` - Get event categories
- `GET /api/events/upcoming/list` - Get upcoming events
- `POST /api/events` - Create event (authenticated)
- `PUT /api/events/:id` - Update event (authenticated)
- `DELETE /api/events/:id` - Delete event (authenticated)
- `GET /api/events/user/my-events` - Get user's events

### Admin
- `GET /api/admin/dashboard` - Admin dashboard
- `GET /api/admin/alumni` - Get all alumni (admin)
- `PUT /api/admin/alumni/:id/status` - Update alumni status
- `DELETE /api/admin/alumni/:id` - Delete alumni
- `GET /api/admin/events` - Get all events (admin)
- `PUT /api/admin/events/:id/approve` - Approve/reject event
- `DELETE /api/admin/events/:id` - Delete event
- `POST /api/admin/admins` - Create admin
- `GET /api/admin/admins` - Get all admins
- `PUT /api/admin/admins/:id` - Update admin
- `DELETE /api/admin/admins/:id` - Delete admin

## Database Models

### Alumni Model
```javascript
{
  name: String,
  email: String (unique),
  mobile: String,
  graduationYear: Number,
  department: String,
  jobTitle: String,
  company: String,
  location: String,
  bio: String,
  linkedinUrl: String,
  linkedinId: String,
  linkedinData: Object,
  profileImage: String,
  skills: [String],
  achievements: [String],
  status: String (pending/approved/rejected),
  isVerified: Boolean,
  privacySettings: Object,
  contactPreferences: Object
}
```

### Event Model
```javascript
{
  title: String,
  description: String,
  date: Date,
  time: String,
  location: String,
  category: String,
  status: String (upcoming/ongoing/completed/cancelled),
  image: String,
  registrationUrl: String,
  attendees: Number,
  maxAttendees: Number,
  organizer: Object,
  tags: [String],
  requirements: [String],
  isOnline: Boolean,
  meetingLink: String,
  createdBy: ObjectId,
  isApproved: Boolean
}
```

### Admin Model
```javascript
{
  username: String (unique),
  email: String (unique),
  password: String (hashed),
  role: String (super_admin/admin/moderator),
  permissions: Object,
  isActive: Boolean,
  profile: Object
}
```

## LinkedIn Integration

The backend supports LinkedIn OAuth for seamless profile data import:

1. **OAuth Flow**
   - Users authenticate with LinkedIn
   - Profile data is automatically imported
   - Alumni profile is created/updated

2. **Data Synchronization**
   - Profile picture
   - Headline and summary
   - Work experience
   - Education history
   - Skills

3. **LinkedIn API Endpoints Used**
   - `/v2/people/~` - Basic profile
   - `/v2/emailAddress` - Email address
   - `/v2/people/~/positions` - Work experience
   - `/v2/people/~/educations` - Education
   - `/v2/people/~/skills` - Skills

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **Input Validation**: Mongoose schema validation
- **CORS Configuration**: Controlled cross-origin requests
- **Rate Limiting**: Login attempt tracking
- **Account Locking**: Temporary lock after failed attempts

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `PORT` | Server port | No (default: 5000) |
| `NODE_ENV` | Environment mode | No (default: development) |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth client ID | Yes |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth client secret | Yes |
| `LINKEDIN_CALLBACK_URL` | LinkedIn OAuth callback URL | Yes |
| `FRONTEND_URL` | Frontend application URL | Yes |

## Development

### Project Structure
```
backend/
├── config/
│   └── passport.js          # Passport configuration
├── middleware/
│   ├── auth.js              # Authentication middleware
│   └── errorHandler.js      # Error handling middleware
├── models/
│   ├── Alumni.js            # Alumni model
│   ├── Event.js             # Event model
│   └── Admin.js             # Admin model
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── alumni.js            # Alumni routes
│   ├── admin.js             # Admin routes
│   └── events.js            # Event routes
├── utils/
│   └── linkedinService.js   # LinkedIn API service
├── server.js                # Main server file
├── package.json             # Dependencies
└── README.md                # Documentation
```

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests (to be implemented)

## Deployment

### Using PM2
```bash
npm install -g pm2
pm2 start server.js --name "rgpv-alumni-api"
pm2 save
pm2 startup
```

### Using Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Environment Setup
1. Set up MongoDB (local or cloud)
2. Configure environment variables
3. Set up LinkedIn OAuth app
4. Deploy to your preferred platform

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.

# llsoit_backend
