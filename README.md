# Chat History Viewer

A secure React application for viewing chat histories from MongoDB with advanced filtering and authentication.

## Features

- 🔒 **Secure Authentication** - JWT-based auth with rate limiting
- 📅 **Date-First & User-First** - Dual navigation modes  
- 🔍 **Advanced Search** - Search users by name or email
- ⚡ **Fast Loading** - Optimized API calls with loading indicators
- 🎨 **Clean UI** - Modern, responsive interface
- 🛡️ **Production Ready** - Enterprise-grade security

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: MongoDB
- **Auth**: JWT + bcrypt
- **Security**: Rate limiting, environment variables

## Environment Variables

Create a `.env` file in the root directory:

```env
# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
MONGODB_DATABASE_NAME=your_database

# Authentication (CHANGE THESE\!)
ADMIN_PASSWORD="YourSecurePassword123\!@#"
JWT_SECRET="your-super-secret-jwt-key-for-production"
```

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB credentials and secure passwords
   ```

3. **Start the development servers**:
   ```bash
   # Terminal 1: Start backend
   node server.js
   
   # Terminal 2: Start frontend  
   npm run dev
   ```

4. **Access the application**:
   - Open http://localhost:5173
   - Login with your ADMIN_PASSWORD

## Deployment to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit: Secure chat history viewer"
git remote add origin https://github.com/yourusername/chat-viewer.git
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and import your GitHub repo
2. **Set Environment Variables** in Vercel dashboard:
   - `MONGODB_URI`
   - `MONGODB_DATABASE_NAME` 
   - `ADMIN_PASSWORD`
   - `JWT_SECRET`

3. Deploy\! Vercel will automatically build and deploy your app.

## Security Features

- ✅ **Environment Variables** - Secrets never in code
- ✅ **Rate Limiting** - 5 login attempts per 15 minutes
- ✅ **JWT Authentication** - Secure session management
- ✅ **HTTPS Only** - Encrypted data transmission
- ✅ **Git Protection** - .env files excluded from version control

## Production Security Checklist

- [ ] Change default passwords in `.env`
- [ ] Set strong JWT_SECRET (32+ random characters)
- [ ] Enable HTTPS in production
- [ ] Set environment variables in hosting platform
- [ ] Never commit `.env` files to Git
- [ ] Use different passwords for UAT vs Production

## Password

The default password is set in your `.env` file under `ADMIN_PASSWORD`.

## Support

For issues or questions, contact the development team.

---

**⚠️ SECURITY WARNING**: This application contains sensitive production data. Always use strong passwords and never share credentials.
EOF < /dev/null