const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');
const Bet = require('../models/Bet');

const DATA_FILE = path.join(__dirname, '..', 'data', 'users.json');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sports-betting';

async function migrateData() {
  try {
    console.log('🔄 Starting data migration to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Clear existing data (optional - remove if you want to keep existing data)
    await User.deleteMany({});
    await Bet.deleteMany({});
    console.log('🗑️  Cleared existing data');
    
    // Read existing JSON data
    const jsonData = await fs.readFile(DATA_FILE, 'utf8');
    const users = JSON.parse(jsonData);
    
    console.log(`📊 Found ${Object.keys(users).length} users to migrate`);
    
    for (const [username, userData] of Object.entries(users)) {
      console.log(`👤 Migrating user: ${username}`);
      
      // Create user
      const user = new User({
        _id: userData.id,
        username: userData.username,
        password: userData.password,
        balance: userData.balance,
        totalWagered: userData.totalWagered,
        totalWon: userData.totalWon,
        totalLost: userData.totalLost,
        createdAt: userData.createdAt ? new Date(userData.createdAt) : new Date(),
        updatedAt: userData.lastUpdated ? new Date(userData.lastUpdated) : new Date()
      });
      
      await user.save();
      
      // Migrate bets
      if (userData.bets && userData.bets.length > 0) {
        console.log(`  📝 Migrating ${userData.bets.length} bets...`);
        
        const bets = userData.bets.map(betData => ({
          _id: betData.id,
          user: user._id,
          gameId: betData.gameId,
          betType: betData.betType,
          selection: betData.selection,
          amount: betData.amount,
          odds: betData.odds.toString(),
          line: betData.line ? betData.line.toString() : null,
          potentialWin: betData.potentialWin,
          sport: betData.sport || null,
          status: betData.status,
          gameData: betData.gameData || null,
          actualResult: betData.actualResult || null,
          createdAt: betData.placedAt ? new Date(betData.placedAt) : new Date(),
          resolvedAt: betData.resolvedAt ? new Date(betData.resolvedAt) : null
        }));
        
        await Bet.insertMany(bets);
        
        // Update user's bets array
        user.bets = bets.map(bet => bet._id);
        await user.save();
      }
    }
    
    console.log('✅ Data migration completed successfully!');
    console.log(`📊 Migrated ${await User.countDocuments()} users and ${await Bet.countDocuments()} bets`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateData();
}

module.exports = migrateData;
