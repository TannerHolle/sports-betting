const oddsService = require('../services/oddsService');
const oddsDatabase = require('../services/oddsDatabase');

// Middleware to check and update odds if needed
const checkAndUpdateOdds = async (req, res, next) => {
  try {
    // Check if odds need updating
    const needsUpdate = await oddsDatabase.needsUpdate();
    
    if (needsUpdate) {
      console.log('Odds need updating, fetching from Odds API...');
      
      try {
        // Fetch fresh odds from API
        const freshOdds = await oddsService.fetchAllOdds();
        
        // Process the odds data
        const processedOdds = {};
        for (const [sport, oddsData] of Object.entries(freshOdds)) {
          processedOdds[sport] = oddsService.processOddsData(oddsData, sport);
        }
        
        // Save to database
        await oddsDatabase.updateOdds(processedOdds);
        
        console.log('Odds updated successfully');
      } catch (error) {
        console.error('Failed to update odds:', error.message);
        // Continue with cached data if API fails
      }
    }
    
    next();
  } catch (error) {
    console.error('Error in odds middleware:', error.message);
    next(); // Continue even if middleware fails
  }
};

module.exports = {
  checkAndUpdateOdds
};

