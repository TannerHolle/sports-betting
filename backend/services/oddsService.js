const axios = require('axios');

const ODDS_API_KEY = '668efbb2094aacf76a3630c60000a669';
const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';

// Sports mapping for Odds API
const SPORTS_MAPPING = {
  'nba': 'basketball_nba',
  'ncaa-basketball': 'basketball_ncaab',
  'ncaa-football': 'americanfootball_ncaaf'
};

class OddsService {
  constructor() {
    this.lastFetchDate = null;
    this.cachedOdds = {};
  }

  // Check if odds need to be updated (once per day)
  needsUpdate() {
    const today = new Date().toDateString();
    return this.lastFetchDate !== today;
  }

  // Fetch odds from the Odds API
  async fetchOdds(sport) {
    try {
      const sportKey = SPORTS_MAPPING[sport];
      if (!sportKey) {
        throw new Error(`Unsupported sport: ${sport}`);
      }

      const response = await axios.get(`${ODDS_API_BASE_URL}/sports/${sportKey}/odds`, {
        params: {
          apiKey: ODDS_API_KEY,
          regions: 'us', // US betting markets
          markets: 'h2h,spreads,totals', // Moneyline, spreads, and totals
          oddsFormat: 'american',
          dateFormat: 'iso'
        }
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching odds for ${sport}:`, error.message);
      
      // If API quota exceeded or other error, return mock data
      if (error.response?.status === 401 || error.response?.status === 429) {
        return this.generateMockOdds(sport);
      }
      
      throw error;
    }
  }

  // Generate mock odds data when API is unavailable
  generateMockOdds(sport) {
    const mockGames = {
      'nba': [
        {
          id: 'mock-nba-1',
          home_team: 'Detroit Pistons',
          away_team: 'Cleveland Cavaliers',
          commence_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          bookmakers: [{
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Detroit Pistons', price: 120 },
                  { name: 'Cleveland Cavaliers', price: -142 }
                ]
              },
              {
                key: 'spreads',
                outcomes: [
                  { name: 'Detroit Pistons', point: 2.5, price: -110 },
                  { name: 'Cleveland Cavaliers', point: -2.5, price: -110 }
                ]
              },
              {
                key: 'totals',
                outcomes: [
                  { name: 'Over', point: 231.5, price: -110 },
                  { name: 'Under', point: 231.5, price: -110 }
                ]
              }
            ]
          }]
        },
        {
          id: 'mock-nba-2',
          home_team: 'Philadelphia 76ers',
          away_team: 'Orlando Magic',
          commence_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          bookmakers: [{
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Philadelphia 76ers', price: 145 },
                  { name: 'Orlando Magic', price: -175 }
                ]
              },
              {
                key: 'spreads',
                outcomes: [
                  { name: 'Philadelphia 76ers', point: 3.5, price: -110 },
                  { name: 'Orlando Magic', point: -3.5, price: -110 }
                ]
              },
              {
                key: 'totals',
                outcomes: [
                  { name: 'Over', point: 225.5, price: -110 },
                  { name: 'Under', point: 225.5, price: -110 }
                ]
              }
            ]
          }]
        },
        {
          id: 'mock-nba-3',
          home_team: 'Los Angeles Lakers',
          away_team: 'Golden State Warriors',
          commence_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          bookmakers: [{
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Los Angeles Lakers', price: -110 },
                  { name: 'Golden State Warriors', price: -110 }
                ]
              },
              {
                key: 'spreads',
                outcomes: [
                  { name: 'Los Angeles Lakers', point: -1.5, price: -110 },
                  { name: 'Golden State Warriors', point: 1.5, price: -110 }
                ]
              },
              {
                key: 'totals',
                outcomes: [
                  { name: 'Over', point: 235.5, price: -110 },
                  { name: 'Under', point: 235.5, price: -110 }
                ]
              }
            ]
          }]
        },
        {
          id: 'mock-nba-4',
          home_team: 'Boston Celtics',
          away_team: 'Miami Heat',
          commence_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          bookmakers: [{
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Boston Celtics', price: -165 },
                  { name: 'Miami Heat', price: 140 }
                ]
              },
              {
                key: 'spreads',
                outcomes: [
                  { name: 'Boston Celtics', point: -4.5, price: -110 },
                  { name: 'Miami Heat', point: 4.5, price: -110 }
                ]
              },
              {
                key: 'totals',
                outcomes: [
                  { name: 'Over', point: 228.5, price: -110 },
                  { name: 'Under', point: 228.5, price: -110 }
                ]
              }
            ]
          }]
        }
      ],
      'ncaa-basketball': [
        {
          id: 'mock-ncaa-bb-1',
          home_team: 'Duke Blue Devils',
          away_team: 'North Carolina Tar Heels',
          commence_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          bookmakers: [{
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Duke Blue Devils', price: -110 },
                  { name: 'North Carolina Tar Heels', price: -110 }
                ]
              },
              {
                key: 'spreads',
                outcomes: [
                  { name: 'Duke Blue Devils', point: -1.5, price: -110 },
                  { name: 'North Carolina Tar Heels', point: 1.5, price: -110 }
                ]
              },
              {
                key: 'totals',
                outcomes: [
                  { name: 'Over', point: 145.5, price: -110 },
                  { name: 'Under', point: 145.5, price: -110 }
                ]
              }
            ]
          }]
        }
      ],
      'ncaa-football': [
        {
          id: 'mock-ncaa-fb-1',
          home_team: 'Alabama Crimson Tide',
          away_team: 'Georgia Bulldogs',
          commence_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          bookmakers: [{
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Alabama Crimson Tide', price: -150 },
                  { name: 'Georgia Bulldogs', price: 130 }
                ]
              },
              {
                key: 'spreads',
                outcomes: [
                  { name: 'Alabama Crimson Tide', point: -3.5, price: -110 },
                  { name: 'Georgia Bulldogs', point: 3.5, price: -110 }
                ]
              },
              {
                key: 'totals',
                outcomes: [
                  { name: 'Over', point: 52.5, price: -110 },
                  { name: 'Under', point: 52.5, price: -110 }
                ]
              }
            ]
          }]
        }
      ]
    };

    return mockGames[sport] || [];
  }

  // Fetch all supported sports odds
  async fetchAllOdds() {
    const sports = Object.keys(SPORTS_MAPPING);
    const allOdds = {};

    for (const sport of sports) {
      try {
        allOdds[sport] = await this.fetchOdds(sport);
      } catch (error) {
        console.error(`Failed to fetch odds for ${sport}:`, error.message);
        allOdds[sport] = [];
      }
    }

    this.lastFetchDate = new Date().toDateString();
    this.cachedOdds = allOdds;
    
    return allOdds;
  }

  // Get cached odds for a specific sport
  getCachedOdds(sport) {
    return this.cachedOdds[sport] || [];
  }

  // Get all cached odds
  getAllCachedOdds() {
    return this.cachedOdds;
  }

  // Process odds data to match our frontend format
  processOddsData(oddsData, sport) {
    if (!Array.isArray(oddsData)) {
      return [];
    }

    return oddsData.map(game => {
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;
      const commenceTime = game.commence_time;
      
      // Extract odds from bookmakers
      const odds = this.extractOddsFromBookmakers(game.bookmakers);
      
      return {
        id: game.id,
        sport: sport,
        homeTeam: homeTeam,
        awayTeam: awayTeam,
        commenceTime: commenceTime,
        odds: odds,
        lastUpdated: new Date().toISOString()
      };
    });
  }

  // Extract odds from bookmakers data
  extractOddsFromBookmakers(bookmakers) {
    if (!Array.isArray(bookmakers) || bookmakers.length === 0) {
      return {};
    }

    // Use the first bookmaker for simplicity (you can modify this logic)
    const bookmaker = bookmakers[0];
    const odds = {};

    bookmaker.markets.forEach(market => {
      if (market.key === 'h2h') {
        // Moneyline odds
        market.outcomes.forEach(outcome => {
          odds[`${outcome.name}_moneyline`] = outcome.price;
        });
      } else if (market.key === 'spreads') {
        // Spread odds
        market.outcomes.forEach(outcome => {
          odds[`${outcome.name}_spread`] = {
            line: outcome.point,
            price: outcome.price
          };
        });
      } else if (market.key === 'totals') {
        // Total odds
        market.outcomes.forEach(outcome => {
          odds[`${outcome.name}_total`] = {
            line: outcome.point,
            price: outcome.price
          };
        });
      }
    });

    return odds;
  }
}

module.exports = new OddsService();
