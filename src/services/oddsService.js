import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'

class OddsService {
  constructor() {
    this.cachedOdds = {}
    this.lastFetchTime = null
  }

  // Get odds for a specific sport
  async getOddsForSport(sport) {
    try {
      const response = await axios.get(`${API_BASE_URL}/odds/${sport}`)
      return response.data
    } catch (error) {
      console.error(`Error fetching odds for ${sport}:`, error)
      return []
    }
  }

  // Get all odds
  async getAllOdds() {
    try {
      const response = await axios.get(`${API_BASE_URL}/odds`)
      this.cachedOdds = response.data
      this.lastFetchTime = new Date()
      return response.data
    } catch (error) {
      console.error('Error fetching all odds:', error)
      return {}
    }
  }

  // Get last update time
  async getLastUpdateTime() {
    try {
      const response = await axios.get(`${API_BASE_URL}/odds/last-update`)
      return response.data.lastUpdated
    } catch (error) {
      console.error('Error fetching last update time:', error)
      return null
    }
  }

  // Convert odds data to betting format for game cards
  convertOddsToBettingFormat(oddsData, homeTeam, awayTeam) {
    if (!oddsData || !oddsData.odds) {
      return null
    }

    const betting = {}

    // Use the actual team names from the odds data, not the ESPN team names
    const actualHomeTeam = oddsData.homeTeam
    const actualAwayTeam = oddsData.awayTeam

    // Moneyline
    const homeMoneylineKey = `${actualHomeTeam}_moneyline`
    const awayMoneylineKey = `${actualAwayTeam}_moneyline`
    
    if (oddsData.odds[homeMoneylineKey] && oddsData.odds[awayMoneylineKey]) {
      betting.moneyline = {
        home: {
          close: {
            odds: oddsData.odds[homeMoneylineKey]
          }
        },
        away: {
          close: {
            odds: oddsData.odds[awayMoneylineKey]
          }
        }
      }
    }

    // Point Spread
    const homeSpreadKey = `${actualHomeTeam}_spread`
    const awaySpreadKey = `${actualAwayTeam}_spread`
    
    if (oddsData.odds[homeSpreadKey] && oddsData.odds[awaySpreadKey]) {
      betting.pointSpread = {
        home: {
          close: {
            line: oddsData.odds[homeSpreadKey].line,
            odds: oddsData.odds[homeSpreadKey].price
          }
        },
        away: {
          close: {
            line: oddsData.odds[awaySpreadKey].line,
            odds: oddsData.odds[awaySpreadKey].price
          }
        }
      }
    }

    // Total (Over/Under)
    if (oddsData.odds[`Over_total`] && oddsData.odds[`Under_total`]) {
      betting.total = {
        over: {
          close: {
            line: oddsData.odds[`Over_total`].line,
            odds: oddsData.odds[`Over_total`].price
          }
        },
        under: {
          close: {
            line: oddsData.odds[`Under_total`].line,
            odds: oddsData.odds[`Under_total`].price
          }
        }
      }
    }

    return Object.keys(betting).length > 0 ? betting : null
  }

  // Find odds for a specific game
  findGameOdds(allOdds, sport, homeTeam, awayTeam) {
    if (!allOdds[sport]) return null

    // Get team name variations for matching
    const homeVariations = this.getTeamNameVariations(homeTeam)
    const awayVariations = this.getTeamNameVariations(awayTeam)

    const result = allOdds[sport].find(game => {
      const homeMatch = homeVariations.some(variation => 
        game.homeTeam === variation || game.homeTeam.includes(variation) || variation.includes(game.homeTeam)
      )
      const awayMatch = awayVariations.some(variation => 
        game.awayTeam === variation || game.awayTeam.includes(variation) || variation.includes(game.awayTeam)
      )
      
      return homeMatch && awayMatch
    })

    return result
  }

  // Get team name variations for matching
  getTeamNameVariations(teamName) {
    const variations = [teamName]
    
    // Common team name variations
    const nameMap = {
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
    }

    if (nameMap[teamName]) {
      variations.push(...nameMap[teamName])
    }

    return variations
  }

}

export default new OddsService()
