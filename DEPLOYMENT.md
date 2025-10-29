# Deployment Guide

## Quick Deploy to Railway (Free)

### 1. Set up MongoDB Atlas
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Sign up for free
3. Create a new cluster (M0 Sandbox - free tier)
4. Create a database user with read/write permissions
5. Whitelist all IPs (0.0.0.0/0) for now
6. Get your connection string

### 2. Deploy to Railway
1. Go to [Railway](https://railway.app)
2. Sign up with GitHub
3. Create new project from GitHub repo
4. Add MongoDB service (Railway will create Atlas cluster for you)
5. Set environment variables:
   - `MONGODB_URI` = your MongoDB connection string
   - `PORT` = 3001 (Railway will set this automatically)
6. Deploy!

### 3. Deploy Frontend
1. Use Vercel, Netlify, or Railway for frontend
2. Update API URL in frontend to point to your Railway backend URL
3. Deploy!

## Environment Variables

### Backend (.env)
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sports-betting
PORT=3001
NODE_ENV=production
```

### Frontend
Update `src/stores/userStore.js`:
```javascript
const API_BASE_URL = 'https://your-railway-app.railway.app/api'
```

## Migration

After deployment, run the migration to move your existing data:
```bash
npm run migrate
```

## Free Tier Limits

- **Railway**: 500 hours/month, $5 credit
- **MongoDB Atlas**: 512MB storage, shared clusters
- **Vercel/Netlify**: Unlimited static hosting

## URLs After Deployment

- Backend: `https://your-app.railway.app`
- Frontend: `https://your-app.vercel.app`
- Health Check: `https://your-app.railway.app/api/health`
