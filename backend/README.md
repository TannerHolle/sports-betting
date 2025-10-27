# Sports Betting Backend

A lightweight Node.js/Express backend for the sports betting application.

## Features

- **User Management**: Create and authenticate users
- **Betting System**: Place and resolve bets
- **Data Persistence**: JSON file-based storage
- **API Endpoints**: RESTful API for frontend communication
- **CORS Support**: Cross-origin requests enabled

## Quick Start

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

3. **Server will run on** `http://localhost:3001`

## API Endpoints

### Health Check
- `GET /api/health` - Check if server is running

### User Management
- `GET /api/user/:username` - Get user by username
- `POST /api/user` - Create new user
- `PUT /api/user/:username` - Update user data

### Betting
- `POST /api/user/:username/bet` - Place a bet
- `PUT /api/user/:username/bet/:betId` - Resolve a bet

### Admin
- `GET /api/users` - Get all users (for admin purposes)

## Data Storage

User data is stored in `backend/data/users.json`. This file is automatically created when the first user is created.

## Environment Variables

- `PORT` - Server port (default: 3001)

## Error Handling

The API returns appropriate HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `409` - Conflict (username already exists)
- `500` - Internal Server Error

## CORS

CORS is enabled to allow requests from the frontend running on different ports.
