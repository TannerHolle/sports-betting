const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const oddsDatabase = require('./services/oddsDatabase');
const { checkAndUpdateOdds } = require('./middleware/oddsMiddleware');
const betResolver = require('./services/betResolver');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data', 'users.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Ensure data directory exists
const ensureDataDir = async () => {
  const dataDir = path.dirname(DATA_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
};

// Load users from file
const loadUsers = async () => {
  try {
    await fs.access(DATA_FILE);
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
};

// Save users to file
const saveUsers = async (users) => {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(users, null, 2));
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
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get user by username
app.get('/api/user/:username', async (req, res) => {
  try {
    const users = await loadUsers();
    const user = users[req.params.username];
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
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
    
    const users = await loadUsers();
    
    if (users[username]) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    const newUser = {
      id: uuidv4(),
      username,
      password,
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
    
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
app.put('/api/user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const userData = req.body;
    
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Place a bet
app.post('/api/user/:username/bet', async (req, res) => {
  try {
    const { username } = req.params;
    const betData = req.body;
    
    const users = await loadUsers();
    const user = users[username];
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { gameId, betType, selection, amount, odds, line, potentialWin, gameData } = betData;
    
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
      line, // Store the line (spread or total)
      potentialWin,
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to place bet' });
  }
});

// Resolve a bet
app.put('/api/user/:username/bet/:betId', async (req, res) => {
  try {
    const { username, betId } = req.params;
    const { status, actualResult } = req.body;
    
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve bet' });
  }
});

// Get all users (for admin purposes)
app.get('/api/users', async (req, res) => {
  try {
    const users = await loadUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// Odds API endpoints

// Get odds for a specific sport
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
    res.status(500).json({ error: 'Failed to load odds' });
  }
});

// Get all odds
app.get('/api/odds', checkAndUpdateOdds, async (req, res) => {
  try {
    const allOdds = await oddsDatabase.getAllOdds();
    res.json(allOdds);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load odds' });
  }
});

// Get odds last update time
app.get('/api/odds/last-update', async (req, res) => {
  try {
    const lastUpdate = await oddsDatabase.getLastUpdateTime();
    res.json({ lastUpdated: lastUpdate });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get last update time' });
  }
});

// Force update odds (admin endpoint)
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
    res.status(500).json({ error: 'Failed to force update odds', details: error.message });
  }
});

// Force resolve bets (admin endpoint)
app.post('/api/bets/force-resolve', async (req, res) => {
  try {
    await betResolver.processAllPendingBets();
    res.json({ success: true, message: 'Bets resolved successfully' });
  } catch (error) {
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
  
  // Start automatic bet resolution (checks every 5 minutes)
  betResolver.startAutoResolution(5);
});
