# Simple React + Node.js App

A clean, minimal starting point for web applications with user authentication and modern tooling.

## Features

- **Frontend**: React with Vite, Tailwind CSS, React Router
- **Backend**: Node.js with Express, MongoDB, JWT authentication
- **Authentication**: Email/password and Google OAuth
- **Payments**: Stripe integration ready (for future use)
- **Email**: Nodemailer for transactional emails

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **Backend**: Node.js, Express, MongoDB, Mongoose
- **Authentication**: JWT, Google OAuth
- **Email**: Nodemailer
- **Payments**: Stripe (configured but not implemented)

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Email service (Gmail, SendGrid, etc.)

### Installation

1. **Clone and install dependencies**
   ```bash
   npm install
   cd Front && npm install
   cd ../server && npm install
   ```

2. **Set up environment variables**
   
   **Server** (`server/.env`):
   ```bash
   cp server/env-example.txt server/.env
   ```
   Edit `server/.env` with your configuration:
   - `MONGO_URI`: Your MongoDB connection string
   - `JWT_SECRET` & `JWT_REFRESH_SECRET`: Random secure strings
   - `SMTP_*`: Your email service credentials
   - `GOOGLE_CLIENT_ID`: From Google Cloud Console

   **Frontend** (`Front/.env`):
   ```bash
   cp Front/env-example.txt Front/.env
   ```
   Edit `Front/.env` with your configuration:
   - `VITE_URL_BACKEND`: Backend URL (http://localhost:5001)
   - `VITE_GOOGLE_CLIENT_ID`: Same as server Google Client ID

### Database Setup

1. **Install MongoDB** locally or use a cloud service like MongoDB Atlas
2. **Create a new database** for your application
3. **Update the MONGO_URI** in your server/.env file

Example MongoDB connection strings:
- Local: `mongodb://localhost:27017/your-app-name`
- Atlas: `mongodb+srv://username:password@cluster.mongodb.net/your-app-name`

### Running the Application

```bash
# Start both frontend and backend
npm start

# Or run individually:
npm run server  # Backend only
npm run front   # Frontend only
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:5001

## Project Structure

```
├── Front/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/        # Page components
│   │   ├── context/      # React context (auth)
│   │   └── utils/        # Utilities
│   └── package.json
├── server/               # Node.js backend
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── middleware/      # Express middleware
│   ├── utils/          # Utilities
│   └── package.json
└── package.json         # Root package.json
```

## Configuration

### Email Service Setup

The app uses Nodemailer for sending emails. Configure your email service in `server/.env`:

**Gmail Example**:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Use App Password for Gmail
SMTP_FROM=your-email@gmail.com
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized origins: `http://localhost:5173`, `http://localhost:5001`
6. Add the Client ID to both frontend and backend `.env` files

### Stripe Setup (Optional)

If you plan to use Stripe for payments:
1. Create a Stripe account
2. Get your publishable and secret keys
3. Add them to your `.env` files

## Available Scripts

```bash
npm start          # Run both frontend and backend
npm run server     # Run backend only
npm run front      # Run frontend only
```

## API Endpoints

### Authentication
- `POST /api/auth/signup/user` - User registration
- `POST /api/auth/login/user` - User login
- `POST /api/auth/google/user` - Google OAuth
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/request-password-reset/user` - Request password reset
- `POST /api/auth/reset-password/user/:token` - Reset password

### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this as a starting point for your projects!
