const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const connectDB = require('./config/database');
const User = require('./models/User');
const Bet = require('./models/Bet');
const oddsDatabase = require('./services/oddsDatabase');
const { checkAndUpdateOdds } = require('./middleware/oddsMiddleware');
const betResolver = require('./services/betResolver');

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

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

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get user by username
app.get('/api/user/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).populate('bets');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
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
    
    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    // Hash the password
    const hashedPassword = await hashPassword(password);
    
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
  } catch (error) {
    console.error('Error resolving bet:', error);
    res.status(500).json({ error: 'Failed to resolve bet' });
  }
});

// Get all users (for admin purposes)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}).populate('bets');
    res.json(users);
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Sports Betting Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  
  // Start automatic bet resolution (checks every 1 minutes)
  betResolver.startAutoResolution(1);
});
