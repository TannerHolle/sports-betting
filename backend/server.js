const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const oddsDatabase = require('./services/oddsDatabase');
const { checkAndUpdateOdds } = require('./middleware/oddsMiddleware');
const betResolver = require('./services/betResolver');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data', 'users.json');

// Check if we should use MongoDB (production) or JSON files (local)
const USE_MONGODB = process.env.MONGODB_URI && process.env.NODE_ENV === 'production';

// MongoDB imports and setup (only if using MongoDB)
let User, Bet, connectDB;
if (USE_MONGODB) {
  try {
    const mongoose = require('mongoose');
    // Suppress mongoose deprecation warning
    mongoose.set('strictQuery', false);
    
    connectDB = require('./config/database');
    User = require('./models/User');
    Bet = require('./models/Bet');
  } catch (error) {
    console.error('MongoDB setup failed, falling back to JSON files:', error.message);
  }
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// JSON file functions (for local development)
const ensureDataDir = async () => {
  const dataDir = path.dirname(DATA_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
};

const loadUsers = async () => {
  try {
    await fs.access(DATA_FILE);
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
};

const saveUsers = async (users) => {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(users, null, 2));
};

// Password validation
const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/(?=.*\d)/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  
  if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }
  
  return { valid: true };
};

// Hash password
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Verify password
const verifyPassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// User validation
const validateUser = (user) => {
  const requiredFields = ['username', 'email', 'balance', 'totalWagered', 'totalWon', 'totalLost', 'bets'];
  return requiredFields.every(field => user.hasOwnProperty(field)) &&
         typeof user.balance === 'number' &&
         typeof user.totalWagered === 'number' &&
         typeof user.totalWon === 'number' &&
         typeof user.totalLost === 'number' &&
         Array.isArray(user.bets);
};

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: USE_MONGODB ? 'MongoDB' : 'JSON Files'
  });
});

// Get user by username
app.get('/api/user/:username', async (req, res) => {
  try {
    if (USE_MONGODB) {
      const user = await User.findOne({ username: req.params.username }).populate('bets');
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } else {
      const users = await loadUsers();
      const user = users[req.params.username];
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to load user' });
  }
});

// Create new user
app.post('/api/user', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }
    
    // Hash the password
    const hashedPassword = await hashPassword(password);
    
    if (USE_MONGODB) {
      // Check if user already exists
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(409).json({ error: 'Username already exists' });
      }
      
      // Create new user
      const newUser = new User({
        username,
        password: hashedPassword,
        balance: 1000,
        totalWagered: 0,
        totalWon: 0,
        totalLost: 0,
        bets: []
      });
      
      await newUser.save();
      
      // Don't return the hashed password in response
      const userResponse = newUser.toObject();
      delete userResponse.password;
      
      res.status(201).json(userResponse);
    } else {
      const users = await loadUsers();
      
      if (users[username]) {
        return res.status(409).json({ error: 'Username already exists' });
      }
      
      const newUser = {
        id: uuidv4(),
        username,
        password: hashedPassword,
        balance: 1000,
        totalWagered: 0,
        totalWon: 0,
        totalLost: 0,
        bets: [],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      
      users[username] = newUser;
      await saveUsers(users);
      
      // Don't return the hashed password in response
      const { password: _, ...userResponse } = newUser;
      res.status(201).json(userResponse);
    }
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (USE_MONGODB) {
      const user = await User.findOne({ username });
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      // Verify password
      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      // Don't return the hashed password in response
      const userResponse = user.toObject();
      delete userResponse.password;
      
      res.json(userResponse);
    } else {
      const users = await loadUsers();
      const user = users[username];
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      // Verify password
      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      // Don't return the hashed password in response
      const { password: _, ...userResponse } = user;
      res.json(userResponse);
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Update user
app.put('/api/user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const userData = req.body;
    
    if (USE_MONGODB) {
      const user = await User.findOne({ username });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Update user data
      Object.assign(user, userData);
      user.updatedAt = new Date();
      
      await user.save();
      
      // Don't return the hashed password in response
      const userResponse = user.toObject();
      delete userResponse.password;
      
      res.json(userResponse);
    } else {
      const users = await loadUsers();
      const user = users[username];
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Merge with existing user data
      const updatedUser = {
        ...user,
        ...userData,
        lastUpdated: new Date().toISOString()
      };
      
      if (!validateUser(updatedUser)) {
        return res.status(400).json({ error: 'Invalid user data' });
      }
      
      users[username] = updatedUser;
      await saveUsers(users);
      
      res.json(updatedUser);
    }
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Place a bet
app.post('/api/user/:username/bet', async (req, res) => {
  try {
    const { username } = req.params;
    const betData = req.body;
    
    if (USE_MONGODB) {
      const user = await User.findOne({ username });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const { gameId, betType, selection, amount, odds, line, potentialWin, sport, gameData } = betData;
      
      if (user.balance < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }
      
      // Create new bet
      const bet = new Bet({
        user: user._id,
        gameId,
        betType,
        selection,
        amount,
        odds,
        line,
        potentialWin,
        sport,
        status: 'pending',
        gameData
      });
      
      await bet.save();
      
      // Update user
      user.balance -= amount;
      user.totalWagered += amount;
      user.bets.push(bet._id);
      user.updatedAt = new Date();
      
      await user.save();
      
      res.json({ success: true, bet, user });
    } else {
      const users = await loadUsers();
      const user = users[username];
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const { gameId, betType, selection, amount, odds, line, potentialWin, sport, gameData } = betData;
      
      if (user.balance < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }
      
      const bet = {
        id: uuidv4(),
        gameId,
        betType,
        selection,
        amount,
        odds,
        line,
        potentialWin,
        sport,
        status: 'pending',
        placedAt: new Date().toISOString(),
        gameData
      };
      
      // Update user
      user.balance -= amount;
      user.totalWagered += amount;
      user.bets.push(bet);
      user.lastUpdated = new Date().toISOString();
      
      users[username] = user;
      await saveUsers(users);
      
      res.json({ success: true, bet, user });
    }
  } catch (error) {
    console.error('Error placing bet:', error);
    res.status(500).json({ error: 'Failed to place bet' });
  }
});

// Resolve a bet
app.put('/api/user/:username/bet/:betId', async (req, res) => {
  try {
    const { username, betId } = req.params;
    const { status, actualResult } = req.body;
    
    if (USE_MONGODB) {
      const user = await User.findOne({ username });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const bet = await Bet.findOne({ _id: betId, user: user._id });
      
      if (!bet) {
        return res.status(404).json({ error: 'Bet not found' });
      }
      
      bet.status = status;
      bet.resolvedAt = new Date();
      bet.actualResult = actualResult;
      
      await bet.save();
      
      if (status === 'won') {
        const totalWinnings = bet.amount + bet.potentialWin;
        user.balance += totalWinnings;
        user.totalWon += bet.potentialWin;
      } else if (status === 'lost') {
        user.totalLost += bet.amount;
      }
      
      user.updatedAt = new Date();
      await user.save();
      
      res.json({ success: true, user });
    } else {
      const users = await loadUsers();
      const user = users[username];
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const bet = user.bets.find(b => b.id === betId);
      if (!bet) {
        return res.status(404).json({ error: 'Bet not found' });
      }
      
      bet.status = status;
      bet.resolvedAt = new Date().toISOString();
      bet.actualResult = actualResult;
      
      if (status === 'won') {
        const totalWinnings = bet.amount + bet.potentialWin;
        user.balance += totalWinnings;
        user.totalWon += bet.potentialWin;
      } else if (status === 'lost') {
        user.totalLost += bet.amount;
      }
      
      user.lastUpdated = new Date().toISOString();
      users[username] = user;
      await saveUsers(users);
      
      res.json({ success: true, user });
    }
  } catch (error) {
    console.error('Error resolving bet:', error);
    res.status(500).json({ error: 'Failed to resolve bet' });
  }
});

// Get all users (for admin purposes)
app.get('/api/users', async (req, res) => {
  try {
    if (USE_MONGODB) {
      const users = await User.find({}).populate('bets');
      res.json(users);
    } else {
      const users = await loadUsers();
      res.json(users);
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// Odds API endpoints (keeping existing ones)
app.get('/api/odds/:sport', checkAndUpdateOdds, async (req, res) => {
  try {
    const { sport } = req.params;
    const validSports = ['nba', 'ncaa-basketball', 'ncaa-football'];
    
    if (!validSports.includes(sport)) {
      return res.status(400).json({ error: 'Invalid sport. Supported sports: nba, ncaa-basketball, ncaa-football' });
    }
    
    const odds = await oddsDatabase.getOddsForSport(sport);
    res.json(odds);
  } catch (error) {
    console.error('Error fetching odds:', error);
    res.status(500).json({ error: 'Failed to load odds' });
  }
});

app.get('/api/odds', checkAndUpdateOdds, async (req, res) => {
  try {
    const allOdds = await oddsDatabase.getAllOdds();
    res.json(allOdds);
  } catch (error) {
    console.error('Error fetching all odds:', error);
    res.status(500).json({ error: 'Failed to load odds' });
  }
});

app.get('/api/odds/last-update', async (req, res) => {
  try {
    const lastUpdate = await oddsDatabase.getLastUpdateTime();
    res.json({ lastUpdated: lastUpdate });
  } catch (error) {
    console.error('Error fetching last update time:', error);
    res.status(500).json({ error: 'Failed to get last update time' });
  }
});

app.post('/api/odds/force-update', async (req, res) => {
  try {
    const oddsService = require('./services/oddsService');
    
    const freshOdds = await oddsService.fetchAllOdds();
    
    const processedOdds = {};
    for (const [sport, oddsData] of Object.entries(freshOdds)) {
      processedOdds[sport] = oddsService.processOddsData(oddsData, sport);
    }
    
    await oddsDatabase.updateOdds(processedOdds);
    
    res.json({ success: true, message: 'Odds updated successfully' });
  } catch (error) {
    console.error('Error force updating odds:', error);
    res.status(500).json({ error: 'Failed to force update odds', details: error.message });
  }
});

app.post('/api/bets/force-resolve', async (req, res) => {
  try {
    await betResolver.processAllPendingBets();
    res.json({ success: true, message: 'Bets resolved successfully' });
  } catch (error) {
    console.error('Error force resolving bets:', error);
    res.status(500).json({ error: 'Failed to resolve bets', details: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize database connection if using MongoDB
const startServer = async () => {
  if (USE_MONGODB) {
    try {
      await connectDB();
      console.log('✅ MongoDB connected successfully');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      console.log('🔄 Falling back to JSON file storage');
    }
  }
  
  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 Sports Betting Backend running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`💾 Database: ${USE_MONGODB ? 'MongoDB' : 'JSON Files'}`);
    
    // Start automatic bet resolution (checks every 1 minutes)
    betResolver.startAutoResolution(1);
  });
};

startServer();