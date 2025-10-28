import axios from 'axios'

class LiveScoreService {
  constructor() {
    this.cache = new Map()
    this.cacheTimeout = 30000 // 30 seconds
  }

  // Get live score data for a specific game
  async getLiveScore(gameId, sport = 'nba') {
    try {
      // Check cache first
      const cached = this.cache.get(gameId)
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data
      }

      // Determine API URL based on sport
      let apiUrl
      switch (sport.toLowerCase()) {
        case 'nba':
          apiUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard'
          break
        case 'nfl':
          apiUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
          break
        case 'ncaa-basketball':
          apiUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'
          break
        case 'ncaa-football':
          apiUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard'
          break
        default:
          apiUrl = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard'
      }

      const response = await axios.get(apiUrl)
      const games = response.data.events || []

      // Find the specific game
      const game = games.find(g => g.id === gameId)
      if (!game) {
        return null
      }

      const competition = game.competitions?.[0]
      if (!competition) {
        return null
      }

      const competitors = competition.competitors || []
      const homeTeam = competitors.find(c => c.homeAway === 'home')
      const awayTeam = competitors.find(c => c.homeAway === 'away')
      const status = competition.status

      if (!homeTeam || !awayTeam) {
        return null
      }

      const liveData = {
        homeTeam: homeTeam.team?.shortDisplayName || homeTeam.team?.displayName || 'Home',
        awayTeam: awayTeam.team?.shortDisplayName || awayTeam.team?.displayName || 'Away',
        homeScore: homeTeam.score || '0',
        awayScore: awayTeam.score || '0',
        status: this.formatStatus(status),
        isLive: status?.type?.state === 'in',
        isCompleted: status?.type?.completed || false
      }

      // Cache the result
      this.cache.set(gameId, {
        data: liveData,
        timestamp: Date.now()
      })

      return liveData
    } catch (error) {
      console.error('Error fetching live score:', error)
      return null
    }
  }

  // Format game status
  formatStatus(status) {
    if (!status) return 'Scheduled'
    
    if (status.type?.completed) {
      return 'Final'
    }
    
    if (status.type?.state === 'in') {
      const time = status.displayClock || '0:00'
      const period = status.period || 1
      
      // Check for halftime (0 seconds in 2nd quarter for basketball and football)
      if (time === '0:00' && period === 2 && (status.type?.name?.toLowerCase().includes('basketball') || status.type?.name?.toLowerCase().includes('football'))) {
        return 'HALFTIME'
      }
      
      const periodText = this.getPeriodText(period, status.type?.name)
      return `${time} - ${periodText}`
    }
    
    return status.type?.shortDetail || 'Scheduled'
  }

  // Get period text based on sport
  getPeriodText(period, sportType) {
    if (sportType?.toLowerCase().includes('basketball')) {
      return `${period}${this.getOrdinalSuffix(period)} Quarter`
    } else if (sportType?.toLowerCase().includes('football')) {
      return `${period}${this.getOrdinalSuffix(period)} Quarter`
    }
    return `${period}${this.getOrdinalSuffix(period)}`
  }

  // Get ordinal suffix
  getOrdinalSuffix(num) {
    if (num >= 11 && num <= 13) return 'th'
    switch (num % 10) {
      case 1: return 'st'
      case 2: return 'nd'
      case 3: return 'rd'
      default: return 'th'
    }
  }

  // Get live scores for multiple games
  async getLiveScores(gameIds, sport = 'nba') {
    const promises = gameIds.map(gameId => this.getLiveScore(gameId, sport))
    const results = await Promise.all(promises)
    
    const liveScores = new Map()
    results.forEach((data, index) => {
      if (data) {
        liveScores.set(gameIds[index], data)
      }
    })
    
    return liveScores
  }

  // Clear cache
  clearCache() {
    this.cache.clear()
  }
}

export default new LiveScoreService()
