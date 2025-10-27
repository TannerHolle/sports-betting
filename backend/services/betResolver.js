const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class BetResolver {
  constructor() {
    this.DATA_FILE = path.join(__dirname, '..', 'data', 'users.json');
    this.resolutionInterval = null;
  }

  // Load users from file
  async loadUsers() {
    try {
      await fs.access(this.DATA_FILE);
      const data = await fs.readFile(this.DATA_FILE, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  // Save users to file
  async saveUsers(users) {
    await fs.writeFile(this.DATA_FILE, JSON.stringify(users, null, 2));
  }

  // Get live game data from ESPN API
  async getLiveGameData(gameId, sport = 'nba') {
    try {
      let apiUrl;
      switch (sport.toLowerCase()) {
        case 'nba':
          apiUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
          break;
        case 'nfl':
          apiUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
          break;
        case 'ncaa-basketball':
          apiUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard';
          break;
        case 'ncaa-football':
          apiUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard';
          break;
        default:
          apiUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
      }

      const response = await axios.get(apiUrl);
      const games = response.data.events || [];
      
      return games.find(game => game.id === gameId);
    } catch (error) {
      console.error(`Error fetching game data for ${gameId}:`, error.message);
      return null;
    }
  }

  // Determine bet outcome based on game result
  determineBetOutcome(bet, gameData) {
    if (!gameData || !gameData.competitions?.[0]) {
      return null; // Game not found or no data
    }

    const competition = gameData.competitions[0];
    const competitors = competition.competitors || [];
    const homeTeam = competitors.find(c => c.homeAway === 'home');
    const awayTeam = competitors.find(c => c.homeAway === 'away');
    const status = competition.status;

    if (!homeTeam || !awayTeam || !status) {
      return null;
    }

    // Check if game is completed
    if (!status.type?.completed) {
      return null; // Game not finished yet
    }

    const homeScore = parseInt(homeTeam.score) || 0;
    const awayScore = parseInt(awayTeam.score) || 0;
    const homeTeamName = homeTeam.team?.shortDisplayName || homeTeam.team?.displayName || '';
    const awayTeamName = awayTeam.team?.shortDisplayName || awayTeam.team?.displayName || '';

    // Determine winner
    const homeWon = homeScore > awayScore;
    const awayWon = awayScore > homeScore;
    const totalPoints = homeScore + awayScore;

    let betWon = false;

    switch (bet.betType) {
      case 'moneyline':
        // For moneyline, just check if the selected team won
        if (this.teamNamesMatch(bet.selection, homeTeamName)) {
          betWon = homeWon;
        } else if (this.teamNamesMatch(bet.selection, awayTeamName)) {
          betWon = awayWon;
        }
        break;

      case 'spread':
        // For spread bets, we need to calculate against the actual spread line
        const spreadLine = this.extractSpreadLine(bet);
        if (spreadLine === null) {
          console.error(`Could not extract spread line for bet ${bet.id}`);
          return null;
        }
        
        if (this.teamNamesMatch(bet.selection, homeTeamName)) {
          // Home team was selected, they need to win by more than the spread
          betWon = (homeScore - awayScore) > spreadLine;
        } else if (this.teamNamesMatch(bet.selection, awayTeamName)) {
          // Away team was selected, they need to win or lose by less than the spread
          betWon = (awayScore - homeScore) > spreadLine;
        }
        break;

      case 'total':
        // For total bets, we need the actual total line from the bet
        const totalLine = this.extractTotalLine(bet);
        if (totalLine === null) {
          console.error(`Could not extract total line for bet ${bet.id}`);
          return null;
        }
        
        if (bet.selection === 'Over') {
          betWon = totalPoints > totalLine;
        } else if (bet.selection === 'Under') {
          betWon = totalPoints < totalLine;
        }
        break;

      default:
        return null;
    }

    return {
      status: betWon ? 'won' : 'lost',
      actualResult: {
        homeTeam: homeTeamName,
        awayTeam: awayTeamName,
        homeScore,
        awayScore,
        totalPoints,
        gameStatus: 'Final',
        resolvedAt: new Date().toISOString()
      }
    };
  }

  // Resolve a single bet
  async resolveBet(bet, gameData) {
    const outcome = this.determineBetOutcome(bet, gameData);
    if (!outcome) {
      return false; // Game not finished or couldn't determine outcome
    }

    try {
      const users = await this.loadUsers();
      const user = users[bet.username];
      
      if (!user) {
        console.error(`User ${bet.username} not found for bet ${bet.id}`);
        return false;
      }

      const betIndex = user.bets.findIndex(b => b.id === bet.id);
      if (betIndex === -1) {
        console.error(`Bet ${bet.id} not found for user ${bet.username}`);
        return false;
      }

      // Update bet status
      user.bets[betIndex].status = outcome.status;
      user.bets[betIndex].resolvedAt = new Date().toISOString();
      user.bets[betIndex].actualResult = outcome.actualResult;

      // Update user balance and stats
      if (outcome.status === 'won') {
        const totalWinnings = bet.amount + bet.potentialWin;
        user.balance += totalWinnings;
        user.totalWon += bet.potentialWin;
      } else {
        user.totalLost += bet.amount;
      }

      user.lastUpdated = new Date().toISOString();
      users[bet.username] = user;
      await this.saveUsers(users);

      return true;
    } catch (error) {
      console.error(`Error resolving bet ${bet.id}:`, error);
      return false;
    }
  }

  // Get all pending bets from all users
  async getAllPendingBets() {
    try {
      const users = await this.loadUsers();
      const pendingBets = [];

      for (const [username, user] of Object.entries(users)) {
        if (user.bets) {
          const userPendingBets = user.bets
            .filter(bet => bet.status === 'pending')
            .map(bet => ({ ...bet, username }));
          pendingBets.push(...userPendingBets);
        }
      }

      return pendingBets;
    } catch (error) {
      console.error('Error getting pending bets:', error);
      return [];
    }
  }

  // Process all pending bets
  async processAllPendingBets() {
    const pendingBets = await this.getAllPendingBets();
    if (pendingBets.length === 0) {
      return;
    }

    // Group bets by game ID
    const betsByGame = {};
    for (const bet of pendingBets) {
      if (!betsByGame[bet.gameId]) {
        betsByGame[bet.gameId] = [];
      }
      betsByGame[bet.gameId].push(bet);
    }

    // Process each game
    for (const [gameId, bets] of Object.entries(betsByGame)) {
      // Get game data (assuming NBA for now - you could enhance this)
      const gameData = await this.getLiveGameData(gameId, 'nba');
      
      if (!gameData) {
        continue;
      }

      // Check if game is completed
      const competition = gameData.competitions?.[0];
      const status = competition?.status;
      
      if (!status?.type?.completed) {
        continue;
      }

      // Resolve all bets for this game
      for (const bet of bets) {
        await this.resolveBet(bet, gameData);
      }
    }
  }

  // Start automatic bet resolution
  startAutoResolution(intervalMinutes = 5) {
    // Run immediately
    this.processAllPendingBets();
    
    // Then run on interval
    this.resolutionInterval = setInterval(() => {
      this.processAllPendingBets();
    }, intervalMinutes * 60 * 1000);
  }

  // Stop automatic bet resolution
  stopAutoResolution() {
    if (this.resolutionInterval) {
      clearInterval(this.resolutionInterval);
      this.resolutionInterval = null;
    }
  }

  // Helper method to match team names (handles variations)
  teamNamesMatch(betSelection, liveTeamName) {
    if (!betSelection || !liveTeamName) return false;
    
    // Direct match
    if (betSelection === liveTeamName) return true;
    
    // Check if one contains the other
    if (betSelection.includes(liveTeamName) || liveTeamName.includes(betSelection)) {
      return true;
    }
    
    // Common team name variations
    const nameVariations = {
      'Lakers': ['Los Angeles Lakers', 'LA Lakers'],
      'Warriors': ['Golden State Warriors', 'GS Warriors'],
      'Celtics': ['Boston Celtics'],
      'Heat': ['Miami Heat'],
      'Bulls': ['Chicago Bulls'],
      'Knicks': ['New York Knicks', 'NY Knicks'],
      'Nets': ['Brooklyn Nets'],
      '76ers': ['Philadelphia 76ers', 'Philly 76ers'],
      'Raptors': ['Toronto Raptors'],
      'Hawks': ['Atlanta Hawks'],
      'Hornets': ['Charlotte Hornets'],
      'Pacers': ['Indiana Pacers'],
      'Pistons': ['Detroit Pistons'],
      'Cavaliers': ['Cleveland Cavaliers', 'Cavs'],
      'Bucks': ['Milwaukee Bucks'],
      'Magic': ['Orlando Magic'],
      'Wizards': ['Washington Wizards'],
      'Nuggets': ['Denver Nuggets'],
      'Timberwolves': ['Minnesota Timberwolves', 'Minnesota T-Wolves'],
      'Thunder': ['Oklahoma City Thunder', 'OKC Thunder'],
      'Trail Blazers': ['Portland Trail Blazers', 'Blazers'],
      'Jazz': ['Utah Jazz'],
      'Suns': ['Phoenix Suns'],
      'Kings': ['Sacramento Kings'],
      'Clippers': ['Los Angeles Clippers', 'LA Clippers'],
      'Mavericks': ['Dallas Mavericks', 'Mavs'],
      'Rockets': ['Houston Rockets'],
      'Grizzlies': ['Memphis Grizzlies'],
      'Pelicans': ['New Orleans Pelicans', 'NOLA Pelicans'],
      'Spurs': ['San Antonio Spurs']
    };
    
    // Check if bet selection matches any variation of the live team name
    for (const [shortName, variations] of Object.entries(nameVariations)) {
      if (betSelection === shortName && variations.includes(liveTeamName)) {
        return true;
      }
      if (variations.includes(betSelection) && liveTeamName === shortName) {
        return true;
      }
    }
    
    return false;
  }

  // Extract spread line from bet data
  extractSpreadLine(bet) {
    // The spread line should be stored in the bet data when it's placed
    // For now, we'll try to extract it from the odds or line field
    if (bet.line !== undefined) {
      return parseFloat(bet.line);
    }
    
    // If not in line field, try to parse from odds or other fields
    // This might need to be adjusted based on how you store bet data
    console.warn(`No spread line found for bet ${bet.id}, using default`);
    return 0; // Default to even spread
  }

  // Extract total line from bet data
  extractTotalLine(bet) {
    // The total line should be stored in the bet data when it's placed
    if (bet.line !== undefined) {
      return parseFloat(bet.line);
    }
    
    // If not in line field, try to parse from odds or other fields
    console.warn(`No total line found for bet ${bet.id}, using default`);
    return 220; // Default total
  }
}

module.exports = new BetResolver();
