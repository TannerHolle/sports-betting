const fs = require('fs').promises;
const path = require('path');

const ODDS_FILE = path.join(__dirname, '..', 'data', 'odds.json');

class OddsDatabase {
  constructor() {
    this.ensureDataDir();
  }

  async ensureDataDir() {
    const dataDir = path.dirname(ODDS_FILE);
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  // Load odds from file
  async loadOdds() {
    try {
      await fs.access(ODDS_FILE);
      const data = await fs.readFile(ODDS_FILE, 'utf8');
      return JSON.parse(data);
    } catch {
      // Return default structure if file doesn't exist
      return {
        lastUpdated: null,
        odds: {
          nba: [],
          'ncaa-basketball': [],
          'ncaa-football': []
        }
      };
    }
  }

  // Save odds to file
  async saveOdds(oddsData) {
    await this.ensureDataDir();
    await fs.writeFile(ODDS_FILE, JSON.stringify(oddsData, null, 2));
  }

  // Check if odds need updating (once per day)
  async needsUpdate() {
    const oddsData = await this.loadOdds();
    if (!oddsData.lastUpdated) {
      return true;
    }

    const lastUpdate = new Date(oddsData.lastUpdated);
    const today = new Date();
    const diffTime = Math.abs(today - lastUpdate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays >= 1;
  }

  // Update odds data
  async updateOdds(newOdds) {
    const oddsData = {
      lastUpdated: new Date().toISOString(),
      odds: newOdds
    };
    
    await this.saveOdds(oddsData);
    return oddsData;
  }

  // Get odds for a specific sport
  async getOddsForSport(sport) {
    const oddsData = await this.loadOdds();
    return oddsData.odds[sport] || [];
  }

  // Get all odds
  async getAllOdds() {
    const oddsData = await this.loadOdds();
    return oddsData.odds;
  }

  // Get last update time
  async getLastUpdateTime() {
    const oddsData = await this.loadOdds();
    return oddsData.lastUpdated;
  }

  // Check if odds need updating (once per day)
  async needsUpdate() {
    const lastUpdate = await this.getLastUpdateTime();
    if (!lastUpdate) return true;
    
    const lastUpdateDate = new Date(lastUpdate);
    const today = new Date();
    
    // Check if last update was on a different day
    return lastUpdateDate.toDateString() !== today.toDateString();
  }
}

module.exports = new OddsDatabase();

