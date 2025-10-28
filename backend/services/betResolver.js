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
      // Determine sport from the first bet (all bets for same game should have same sport)
      const sport = bets[0]?.sport || 'nba'; // Default to NBA for old bets
      
      // Get game data for the correct sport
      const gameData = await this.getLiveGameData(gameId, sport);
      
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
    
    // Common team name variations - Updated based on actual data analysis
    const nameVariations = {
      // NBA Teams
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
      'Spurs': ['San Antonio Spurs'],
      
      // NFL Teams
      'Chiefs': ['Kansas City Chiefs', 'KC Chiefs'],
      'Commanders': ['Washington Commanders', 'WSH Commanders'],
      'Cowboys': ['Dallas Cowboys'],
      'Giants': ['New York Giants', 'NY Giants'],
      'Eagles': ['Philadelphia Eagles', 'PHI Eagles'],
      'Patriots': ['New England Patriots', 'NE Patriots'],
      'Bills': ['Buffalo Bills'],
      'Dolphins': ['Miami Dolphins'],
      'Jets': ['New York Jets', 'NY Jets'],
      'Ravens': ['Baltimore Ravens'],
      'Bengals': ['Cincinnati Bengals'],
      'Browns': ['Cleveland Browns'],
      'Steelers': ['Pittsburgh Steelers'],
      'Texans': ['Houston Texans'],
      'Colts': ['Indianapolis Colts'],
      'Jaguars': ['Jacksonville Jaguars'],
      'Titans': ['Tennessee Titans'],
      'Broncos': ['Denver Broncos'],
      'Raiders': ['Las Vegas Raiders', 'Oakland Raiders'],
      'Chargers': ['Los Angeles Chargers', 'LA Chargers'],
      'Cardinals': ['Arizona Cardinals'],
      'Rams': ['Los Angeles Rams', 'LA Rams'],
      '49ers': ['San Francisco 49ers', 'SF 49ers'],
      'Seahawks': ['Seattle Seahawks'],
      'Packers': ['Green Bay Packers'],
      'Bears': ['Chicago Bears'],
      'Lions': ['Detroit Lions'],
      'Vikings': ['Minnesota Vikings'],
      'Falcons': ['Atlanta Falcons'],
      'Panthers': ['Carolina Panthers'],
      'Saints': ['New Orleans Saints'],
      'Buccaneers': ['Tampa Bay Buccaneers', 'TB Buccaneers'],
      
      // NCAA Basketball Teams - Based on actual odds.json and ESPN API data
      'Arizona Wildcats': ['Arizona', 'Arizona Wildcats', 'UA Wildcats'],
      'Florida Gators': ['Florida', 'Florida Gators', 'UF Gators'],
      'Duke Blue Devils': ['Duke', 'Duke Blue Devils'],
      'North Carolina Tar Heels': ['North Carolina', 'North Carolina Tar Heels', 'UNC Tar Heels', 'UNC'],
      'BYU Cougars': ['BYU', 'BYU Cougars', 'Brigham Young Cougars'],
      'Villanova Wildcats': ['Villanova', 'Villanova Wildcats', 'Nova Wildcats'],
      'Texas Longhorns': ['Texas', 'Texas Longhorns', 'UT Longhorns'],
      'Kansas Jayhawks': ['Kansas', 'Kansas Jayhawks', 'KU Jayhawks'],
      'Kentucky Wildcats': ['Kentucky', 'Kentucky Wildcats', 'UK Wildcats'],
      'Michigan State Spartans': ['Michigan State', 'Michigan State Spartans', 'MSU Spartans', 'MSU'],
      'UCLA Bruins': ['UCLA', 'UCLA Bruins', 'UC Los Angeles Bruins'],
      'USC Trojans': ['USC', 'USC Trojans', 'Southern California Trojans'],
      'Stanford Cardinal': ['Stanford', 'Stanford Cardinal', 'SU Cardinal'],
      'California Golden Bears': ['California', 'California Golden Bears', 'Cal Golden Bears', 'Cal'],
      'Arizona State Sun Devils': ['Arizona State', 'Arizona State Sun Devils', 'ASU Sun Devils'],
      'Oregon Ducks': ['Oregon', 'Oregon Ducks', 'UO Ducks'],
      'Oregon State Beavers': ['Oregon State', 'Oregon State Beavers', 'OSU Beavers'],
      'Washington Huskies': ['Washington', 'Washington Huskies', 'UW Huskies'],
      'Washington State Cougars': ['Washington State', 'Washington State Cougars', 'WSU Cougars'],
      'Houston Cougars': ['Houston', 'Houston Cougars', 'UH Cougars'],
      'Colorado Buffaloes': ['Colorado', 'Colorado Buffaloes', 'CU Buffaloes'],
      'Utah Utes': ['Utah', 'Utah Utes', 'UU Utes'],
      'Texas Tech Red Raiders': ['Texas Tech', 'Texas Tech Red Raiders', 'TTU Red Raiders'],
      'Baylor Bears': ['Baylor', 'Baylor Bears', 'BU Bears'],
      'TCU Horned Frogs': ['TCU', 'TCU Horned Frogs', 'Texas Christian Horned Frogs'],
      'Oklahoma Sooners': ['Oklahoma', 'Oklahoma Sooners', 'OU Sooners'],
      'Oklahoma State Cowboys': ['Oklahoma State', 'Oklahoma State Cowboys', 'OSU Cowboys'],
      'Kansas State Wildcats': ['Kansas State', 'Kansas State Wildcats', 'KSU Wildcats'],
      'Iowa State Cyclones': ['Iowa State', 'Iowa State Cyclones', 'ISU Cyclones'],
      'West Virginia Mountaineers': ['West Virginia', 'West Virginia Mountaineers', 'WVU Mountaineers'],
      'Syracuse Orange': ['Syracuse', 'Syracuse Orange', 'SU Orange'],
      'Louisville Cardinals': ['Louisville', 'Louisville Cardinals', 'UL Cardinals'],
      'Notre Dame Fighting Irish': ['Notre Dame', 'Notre Dame Fighting Irish', 'ND Fighting Irish'],
      'Pittsburgh Panthers': ['Pittsburgh', 'Pittsburgh Panthers', 'Pitt Panthers'],
      'Boston College Eagles': ['Boston College', 'Boston College Eagles', 'BC Eagles'],
      'Clemson Tigers': ['Clemson', 'Clemson Tigers', 'CU Tigers'],
      'Florida State Seminoles': ['Florida State', 'Florida State Seminoles', 'FSU Seminoles'],
      'Miami Hurricanes': ['Miami', 'Miami Hurricanes', 'UM Hurricanes'],
      'North Carolina State Wolfpack': ['North Carolina State', 'North Carolina State Wolfpack', 'NC State Wolfpack', 'NC State'],
      'Wake Forest Demon Deacons': ['Wake Forest', 'Wake Forest Demon Deacons', 'WF Demon Deacons'],
      'Georgia Tech Yellow Jackets': ['Georgia Tech', 'Georgia Tech Yellow Jackets', 'GT Yellow Jackets'],
      'Virginia Cavaliers': ['Virginia', 'Virginia Cavaliers', 'UVA Cavaliers'],
      'Virginia Tech Hokies': ['Virginia Tech', 'Virginia Tech Hokies', 'VT Hokies'],
      'Georgia Bulldogs': ['Georgia', 'Georgia Bulldogs', 'UGA Bulldogs'],
      'South Carolina Gamecocks': ['South Carolina', 'South Carolina Gamecocks', 'USC Gamecocks'],
      'Tennessee Volunteers': ['Tennessee', 'Tennessee Volunteers', 'UT Volunteers'],
      'Vanderbilt Commodores': ['Vanderbilt', 'Vanderbilt Commodores', 'VU Commodores'],
      'Auburn Tigers': ['Auburn', 'Auburn Tigers', 'AU Tigers'],
      'Alabama Crimson Tide': ['Alabama', 'Alabama Crimson Tide', 'UA Crimson Tide'],
      'Mississippi State Bulldogs': ['Mississippi State', 'Mississippi State Bulldogs', 'MSU Bulldogs'],
      'Ole Miss Rebels': ['Ole Miss', 'Ole Miss Rebels', 'Mississippi Rebels'],
      'LSU Tigers': ['LSU', 'LSU Tigers', 'Louisiana State Tigers'],
      'Arkansas Razorbacks': ['Arkansas', 'Arkansas Razorbacks', 'UA Razorbacks'],
      'Missouri Tigers': ['Missouri', 'Missouri Tigers', 'MU Tigers'],
      'Texas A&M Aggies': ['Texas A&M', 'Texas A&M Aggies', 'TAMU Aggies'],
      'Michigan Wolverines': ['Michigan', 'Michigan Wolverines', 'UM Wolverines'],
      'Ohio State Buckeyes': ['Ohio State', 'Ohio State Buckeyes', 'OSU Buckeyes'],
      'Indiana Hoosiers': ['Indiana', 'Indiana Hoosiers', 'IU Hoosiers'],
      'Purdue Boilermakers': ['Purdue', 'Purdue Boilermakers', 'PU Boilermakers'],
      'Wisconsin Badgers': ['Wisconsin', 'Wisconsin Badgers', 'UW Badgers'],
      'Maryland Terrapins': ['Maryland', 'Maryland Terrapins', 'UMD Terrapins'],
      'Illinois Fighting Illini': ['Illinois', 'Illinois Fighting Illini', 'UI Fighting Illini'],
      'Iowa Hawkeyes': ['Iowa', 'Iowa Hawkeyes', 'UI Hawkeyes'],
      'Minnesota Golden Gophers': ['Minnesota', 'Minnesota Golden Gophers', 'UM Golden Gophers'],
      'Nebraska Cornhuskers': ['Nebraska', 'Nebraska Cornhuskers', 'UNL Cornhuskers'],
      'Northwestern Wildcats': ['Northwestern', 'Northwestern Wildcats', 'NU Wildcats'],
      'Rutgers Scarlet Knights': ['Rutgers', 'Rutgers Scarlet Knights', 'RU Scarlet Knights'],
      'Penn State Nittany Lions': ['Penn State', 'Penn State Nittany Lions', 'PSU Nittany Lions'],
      
      // NCAA Football Teams - Based on actual odds.json and ESPN API data
      'Texas State Bobcats': ['Texas State', 'Texas State Bobcats'],
      'James Madison Dukes': ['James Madison', 'James Madison Dukes'],
      'Kennesaw State Owls': ['Kennesaw State', 'Kennesaw State Owls'],
      'UTEP Miners': ['UTEP', 'UTEP Miners'],
      'Middle Tennessee Blue Raiders': ['Middle Tennessee', 'Middle Tennessee Blue Raiders'],
      'Jacksonville State Gamecocks': ['Jacksonville State', 'Jacksonville State Gamecocks'],
      'Missouri State Bears': ['Missouri State', 'Missouri State Bears'],
      'Florida International Panthers': ['Florida International', 'Florida International Panthers', 'FIU Panthers'],
      'Coastal Carolina Chanticleers': ['Coastal Carolina', 'Coastal Carolina Chanticleers'],
      'Marshall Thundering Herd': ['Marshall', 'Marshall Thundering Herd'],
      'UTSA Roadrunners': ['UTSA', 'UTSA Roadrunners'],
      'Tulane Green Wave': ['Tulane', 'Tulane Green Wave'],
      'Rice Owls': ['Rice', 'Rice Owls'],
      'Memphis Tigers': ['Memphis', 'Memphis Tigers'],
      'Syracuse Orange': ['Syracuse', 'Syracuse Orange'],
      'North Carolina Tar Heels': ['North Carolina', 'North Carolina Tar Heels', 'UNC Tar Heels', 'UNC'],
      'Louisiana Tech Bulldogs': ['Louisiana Tech', 'Louisiana Tech Bulldogs'],
      'Sam Houston State Bearkats': ['Sam Houston State', 'Sam Houston State Bearkats'],
      'Air Force Falcons': ['Air Force', 'Air Force Falcons'],
      'Army Black Knights': ['Army', 'Army Black Knights'],
      'Baylor Bears': ['Baylor', 'Baylor Bears'],
      'UCF Knights': ['UCF', 'UCF Knights'],
      'Bowling Green Falcons': ['Bowling Green', 'Bowling Green Falcons'],
      'Buffalo Bulls': ['Buffalo', 'Buffalo Bulls'],
      'Clemson Tigers': ['Clemson', 'Clemson Tigers'],
      'Duke Blue Devils': ['Duke', 'Duke Blue Devils'],
      'Houston Cougars': ['Houston', 'Houston Cougars', 'UH Cougars'],
      'BYU Cougars': ['BYU', 'BYU Cougars', 'Brigham Young Cougars'],
      'West Virginia Mountaineers': ['West Virginia', 'West Virginia Mountaineers', 'WVU Mountaineers'],
      'Illinois Fighting Illini': ['Illinois', 'Illinois Fighting Illini'],
      'Rutgers Scarlet Knights': ['Rutgers', 'Rutgers Scarlet Knights'],
      'SMU Mustangs': ['SMU', 'SMU Mustangs'],
      'Miami Hurricanes': ['Miami', 'Miami Hurricanes', 'UM Hurricanes'],
      'North Texas Mean Green': ['North Texas', 'North Texas Mean Green'],
      'Navy Midshipmen': ['Navy', 'Navy Midshipmen'],
      'Ohio State Buckeyes': ['Ohio State', 'Ohio State Buckeyes', 'OSU Buckeyes'],
      'Penn State Nittany Lions': ['Penn State', 'Penn State Nittany Lions', 'PSU Nittany Lions'],
      'Texas Longhorns': ['Texas', 'Texas Longhorns', 'UT Longhorns'],
      'Vanderbilt Commodores': ['Vanderbilt', 'Vanderbilt Commodores'],
      'UConn Huskies': ['UConn', 'UConn Huskies'],
      'UAB Blazers': ['UAB', 'UAB Blazers'],
      'Arizona State Sun Devils': ['Arizona State', 'Arizona State Sun Devils', 'ASU Sun Devils'],
      'Iowa State Cyclones': ['Iowa State', 'Iowa State Cyclones', 'ISU Cyclones'],
      'Temple Owls': ['Temple', 'Temple Owls'],
      'East Carolina Pirates': ['East Carolina', 'East Carolina Pirates'],
      'Virginia Tech Hokies': ['Virginia Tech', 'Virginia Tech Hokies', 'VT Hokies'],
      'Louisville Cardinals': ['Louisville', 'Louisville Cardinals'],
      'UNLV Rebels': ['UNLV', 'UNLV Rebels'],
      'New Mexico Lobos': ['New Mexico', 'New Mexico Lobos'],
      'Boise State Broncos': ['Boise State', 'Boise State Broncos'],
      'Fresno State Bulldogs': ['Fresno State', 'Fresno State Bulldogs'],
      'Boston College Eagles': ['Boston College', 'Boston College Eagles', 'BC Eagles'],
      'Notre Dame Fighting Irish': ['Notre Dame', 'Notre Dame Fighting Irish', 'ND Fighting Irish'],
      'Liberty Flames': ['Liberty', 'Liberty Flames'],
      'Delaware Blue Hens': ['Delaware', 'Delaware Blue Hens'],
      'Florida Gators': ['Florida', 'Florida Gators', 'UF Gators'],
      'Georgia Bulldogs': ['Georgia', 'Georgia Bulldogs', 'UGA Bulldogs'],
      'Maryland Terrapins': ['Maryland', 'Maryland Terrapins', 'UMD Terrapins'],
      'Indiana Hoosiers': ['Indiana', 'Indiana Hoosiers', 'IU Hoosiers'],
      'Kansas State Wildcats': ['Kansas State', 'Kansas State Wildcats', 'KSU Wildcats'],
      'Texas Tech Red Raiders': ['Texas Tech', 'Texas Tech Red Raiders', 'TTU Red Raiders'],
      'South Alabama Jaguars': ['South Alabama', 'South Alabama Jaguars'],
      'Louisiana Ragin Cajuns': ['Louisiana', 'Louisiana Ragin Cajuns'],
      'Minnesota Golden Gophers': ['Minnesota', 'Minnesota Golden Gophers', 'UM Golden Gophers'],
      'Michigan State Spartans': ['Michigan State', 'Michigan State Spartans', 'MSU Spartans'],
      'Western Kentucky Hilltoppers': ['Western Kentucky', 'Western Kentucky Hilltoppers'],
      'New Mexico State Aggies': ['New Mexico State', 'New Mexico State Aggies'],
      'UL Monroe Warhawks': ['UL Monroe', 'UL Monroe Warhawks'],
      'Old Dominion Monarchs': ['Old Dominion', 'Old Dominion Monarchs'],
      'Stanford Cardinal': ['Stanford', 'Stanford Cardinal'],
      'Pittsburgh Panthers': ['Pittsburgh', 'Pittsburgh Panthers', 'Pitt Panthers'],
      'California Golden Bears': ['California', 'California Golden Bears', 'Cal Golden Bears'],
      'Virginia Cavaliers': ['Virginia', 'Virginia Cavaliers', 'UVA Cavaliers'],
      'Arkansas Razorbacks': ['Arkansas', 'Arkansas Razorbacks'],
      'Mississippi State Bulldogs': ['Mississippi State', 'Mississippi State Bulldogs', 'MSU Bulldogs'],
      'Western Michigan Broncos': ['Western Michigan', 'Western Michigan Broncos'],
      'Central Michigan Chippewas': ['Central Michigan', 'Central Michigan Chippewas'],
      'Kansas Jayhawks': ['Kansas', 'Kansas Jayhawks', 'KU Jayhawks'],
      'Oklahoma State Cowboys': ['Oklahoma State', 'Oklahoma State Cowboys', 'OSU Cowboys'],
      'Colorado Buffaloes': ['Colorado', 'Colorado Buffaloes', 'CU Buffaloes'],
      'Arizona Wildcats': ['Arizona', 'Arizona Wildcats', 'UA Wildcats'],
      'Michigan Wolverines': ['Michigan', 'Michigan Wolverines', 'UM Wolverines'],
      'Purdue Boilermakers': ['Purdue', 'Purdue Boilermakers', 'PU Boilermakers'],
      'Ole Miss Rebels': ['Ole Miss', 'Ole Miss Rebels', 'Mississippi Rebels'],
      'South Carolina Gamecocks': ['South Carolina', 'South Carolina Gamecocks', 'USC Gamecocks'],
      'San Diego State Aztecs': ['San Diego State', 'San Diego State Aztecs'],
      'Wyoming Cowboys': ['Wyoming', 'Wyoming Cowboys'],
      'Auburn Tigers': ['Auburn', 'Auburn Tigers', 'AU Tigers'],
      'Kentucky Wildcats': ['Kentucky', 'Kentucky Wildcats', 'UK Wildcats'],
      'Florida State Seminoles': ['Florida State', 'Florida State Seminoles', 'FSU Seminoles'],
      'Wake Forest Demon Deacons': ['Wake Forest', 'Wake Forest Demon Deacons', 'WF Demon Deacons'],
      'NC State Wolfpack': ['NC State', 'NC State Wolfpack', 'North Carolina State Wolfpack'],
      'Georgia Tech Yellow Jackets': ['Georgia Tech', 'Georgia Tech Yellow Jackets', 'GT Yellow Jackets'],
      'Nebraska Cornhuskers': ['Nebraska', 'Nebraska Cornhuskers', 'UNL Cornhuskers'],
      'USC Trojans': ['USC', 'USC Trojans', 'Southern California Trojans'],
      'Tennessee Volunteers': ['Tennessee', 'Tennessee Volunteers', 'UT Volunteers'],
      'Oklahoma Sooners': ['Oklahoma', 'Oklahoma Sooners', 'OU Sooners'],
      'Oregon State Beavers': ['Oregon State', 'Oregon State Beavers', 'OSU Beavers'],
      'Washington State Cougars': ['Washington State', 'Washington State Cougars', 'WSU Cougars'],
      'Troy Trojans': ['Troy', 'Troy Trojans'],
      'Arkansas State Red Wolves': ['Arkansas State', 'Arkansas State Red Wolves'],
      'Utah Utes': ['Utah', 'Utah Utes', 'UU Utes'],
      'Cincinnati Bearcats': ['Cincinnati', 'Cincinnati Bearcats'],
      'San Jose State Spartans': ['San Jose State', 'San Jose State Spartans'],
      'Hawaii Rainbow Warriors': ['Hawaii', 'Hawaii Rainbow Warriors']
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
