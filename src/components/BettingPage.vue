<template>
  <div class="betting-page">
    <div class="page-header">
      <h1 class="page-title">
        Betting Summary
      </h1>
      <p class="page-description">
        Aren't you glad this isnt real money?
      </p>
    </div>

    <!-- Quick Stats Dashboard -->
    <div class="stats-dashboard" v-if="userStats">
      <div class="stat-card">
        <div class="stat-value">${{ userBalance.toLocaleString() }}</div>
        <div class="stat-label">Available Cash</div>
      </div>
      <div class="stat-card" v-if="outstandingBetAmount > 0">
        <div class="stat-value">${{ outstandingBetAmount.toLocaleString() }}</div>
        <div class="stat-label">Outstanding Bets</div>
      </div>
      <div class="stat-card" v-if="userStats.activeBets > 0">
        <div class="stat-value">{{ userStats.activeBets }}</div>
        <div class="stat-label">Active Bets</div>
      </div>
      <div class="stat-card" v-if="userStats.winRate > 0">
        <div class="stat-value" :class="{ 'positive': userStats.winRate > 50, 'negative': userStats.winRate < 50 }">
          {{ userStats.winRate }}%
        </div>
        <div class="stat-label">Win Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ userStats.totalBets }}</div>
        <div class="stat-label">Total Bets</div>
      </div>
      <div class="stat-card" v-if="userStats.currentStreak !== 0">
        <div class="stat-value" :class="{ 'positive': userStats.currentStreak > 0, 'negative': userStats.currentStreak < 0 }">
          {{ userStats.currentStreak > 0 ? '+' : '' }}{{ userStats.currentStreak }}
        </div>
        <div class="stat-label">Current Streak</div>
      </div>
      <div class="stat-card" v-if="winPotential > 0">
        <div class="stat-value positive">${{ winPotential.toLocaleString() }}</div>
        <div class="stat-label">Win Potential</div>
      </div>
      <div class="stat-card" v-if="userStats.todaysProfitLoss !== 0">
        <div class="stat-value" :class="{ 'positive': userStats.todaysProfitLoss > 0, 'negative': userStats.todaysProfitLoss < 0 }">
          {{ userStats.todaysProfitLoss >= 0 ? '+' : '' }}${{ userStats.todaysProfitLoss.toLocaleString() }}
        </div>
        <div class="stat-label">Today's P/L</div>
      </div>
    </div>

    <!-- Bet History -->
    <BetHistory />

    <!-- Leaderboard -->
    <Leaderboard :user-leagues="userLeaguesForLeaderboard" />

    <!-- Games Header -->
    <div class="games-header">
      <h2>
        Games {{ showingDate === 'tomorrow' ? 'Tomorrow' : 'Today' }} Available for Betting
      </h2>
      <p class="section-description" v-if="!loading && gamesWithBetting.length === 0">
        No games with betting lines available at this time.
      </p>
      <p class="section-description" v-else>
        Games with betting lines scheduled for {{ showingDate === 'tomorrow' ? 'tomorrow' : 'today' }} are shown below. To browse and bet on games from other dates or leagues, visit the Live Scores page.
      </p>
    </div>

    <!-- League Selection -->
    <div class="league-selection">
      <button 
        v-for="sport in availableSports" 
        :key="sport.id"
        @click="setActiveLeague(sport.id)" 
        :class="{ active: activeLeague === sport.id }"
        class="league-chip"
      >
        <span class="chip-icon">{{ sport.icon }}</span>
        <span class="chip-text">{{ sport.name }}</span>
      </button>
    </div>

    <!-- Games with Betting -->
    <div class="games-section">
      
      <div v-if="error" class="error-message">
        <h3>⚠️ Error Loading Games</h3>
        <p>{{ error }}</p>
        <button @click="fetchData" class="retry-btn">Try Again</button>
      </div>

      <div v-else-if="loading && !games.length" class="loading-container">
        <div class="spinner-large"></div>
        <p>Loading games...</p>
      </div>

      <div v-else-if="gamesWithBetting.length === 0" class="no-games">
        <h3>No games with betting lines</h3>
        <p>There are no games with betting lines available for {{ currentSport.name }} at the moment. Try switching to a different league or check back later.</p>
      </div>

      <div v-else class="games-grid">
        <component 
          :is="currentGameCardComponent"
          v-for="game in gamesWithBetting" 
          :key="game.id" 
          :game="game"
          :sport="activeLeague"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import axios from 'axios'
import { useUserStore } from '../stores/userStore.js'
import { API_BASE_URL } from '../config/api.js'
import oddsService from '../services/oddsService.js'
import BetHistory from './BetHistory.vue'
import Leaderboard from './Leaderboard.vue'
import NCAAFootballCard from './NCAAFootballCard.vue'
import NFLGameCard from './NFLGameCard.vue'
import CollegeBasketballCard from './CollegeBasketballCard.vue'
import NBAGameCard from './NBAGameCard.vue'

export default {
  name: 'BettingPage',
  components: {
    BetHistory,
    Leaderboard,
    NCAAFootballCard,
    NFLGameCard,
    CollegeBasketballCard,
    NBAGameCard
  },
  setup() {
    const userStore = useUserStore()
    const games = ref([])
    const loading = ref(false)
    const error = ref(null)
    const activeLeague = ref('ncaa-football') // Default to NCAA Football
    const refreshInterval = ref(null)
    const allSportsRefreshInterval = ref(null)
    const userLeaguesForLeaderboard = ref([])
    const gamesBySport = ref({}) // Store games for each sport
    const showingDate = ref('today') // Track if showing 'today' or 'tomorrow'
    const allOdds = ref({}) // Cache all odds data

    // User data from store
    const userBalance = computed(() => userStore.userBalance.value)
    const userStats = computed(() => userStore.userStats.value)
    
    // Calculate outstanding bet amount (sum of all pending bets)
    const outstandingBetAmount = computed(() => {
      if (!userStore.currentUser.value?.bets) return 0
      return userStore.currentUser.value.bets
        .filter(bet => bet.status === 'pending')
        .reduce((total, bet) => total + bet.amount, 0)
    })

    // Calculate win potential (sum of potential winnings from all pending bets)
    const winPotential = computed(() => {
      if (!userStore.currentUser.value?.bets) return 0
      return userStore.currentUser.value.bets
        .filter(bet => bet.status === 'pending')
        .reduce((total, bet) => total + (bet.potentialWin || 0), 0)
    })

    // Check if current user is admin (tannerholle)
    const isAdmin = computed(() => {
      return userStore.currentUser.value?.username === 'tannerholle' || userStore.currentUser.value?.username === 'tanner'
    })

    // Sports configuration
    const sports = ref([
      {
        id: 'ncaa-football',
        name: 'NCAA Football',
        icon: '🎓',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
        component: 'NCAAFootballCard'
      },
      {
        id: 'nfl',
        name: 'NFL',
        icon: '🏈',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
        component: 'NFLGameCard'
      },
      {
        id: 'ncaa-basketball',
        name: 'NCAA Basketball',
        icon: '🏀',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
        component: 'CollegeBasketballCard'
      },
      {
        id: 'nba',
        name: 'NBA',
        icon: '🏀',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
        component: 'NBAGameCard'
      }
    ])

    const currentSport = computed(() => {
      return sports.value.find(sport => sport.id === activeLeague.value)
    })

    const currentGameCardComponent = computed(() => {
      return currentSport.value?.component || 'NCAAFootballCard'
    })

    // Format date for ESPN API (YYYYMMDD)
    const formatDateForAPI = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}${month}${day}`
    }

    // Check if a game has odds available (check external odds API first, then ESPN embedded odds)
    const gameHasOdds = (game, sportId) => {
      if (!game || !game.competitions?.[0]) return false
      
      const competition = game.competitions[0]
      const competitors = competition.competitors || []
      const homeTeam = competitors.find(c => c.homeAway === 'home')
      const awayTeam = competitors.find(c => c.homeAway === 'away')
      
      if (!homeTeam || !awayTeam) return false
      
      const homeTeamName = homeTeam.team?.shortDisplayName || homeTeam.team?.displayName || ''
      const awayTeamName = awayTeam.team?.shortDisplayName || awayTeam.team?.displayName || ''
      
      if (!homeTeamName || !awayTeamName) {
        return false
      }
      
      // First, check external odds database
      if (allOdds.value && allOdds.value[sportId]) {
        // Try matching with shortDisplayName first (same as game cards do)
        let gameOdds = oddsService.findGameOdds(allOdds.value, sportId, homeTeamName, awayTeamName)
        
        if (!gameOdds) {
          // Try with displayName if shortDisplayName didn't match
          const homeDisplayName = homeTeam.team?.displayName || ''
          const awayDisplayName = awayTeam.team?.displayName || ''
          if (homeDisplayName && awayDisplayName && (homeDisplayName !== homeTeamName || awayDisplayName !== awayTeamName)) {
            gameOdds = oddsService.findGameOdds(allOdds.value, sportId, homeDisplayName, awayDisplayName)
          }
        }
        
        if (gameOdds) {
          return true
        }
      }
      
      // Fall back to checking if odds are embedded in the game data (ESPN format)
      const embeddedOdds = competition.odds?.[0]
      if (embeddedOdds && (embeddedOdds.pointSpread || embeddedOdds.moneyline || embeddedOdds.total)) {
        return true
      }
      
      return false
    }


    // Helper function to check if games have betting available for a specific sport
    // Just checks if there are any scheduled games with odds (no date filtering)
    const hasGamesWithBetting = (sportId, gamesList) => {
      if (!gamesList || gamesList.length === 0) return false
      
      return gamesList.some(game => {
        const competition = game.competitions?.[0]
        const status = competition?.status
        const isScheduled = status?.type?.state === 'pre'
        if (!isScheduled) return false
        return gameHasOdds(game, sportId)
      })
    }

    // Helper function to sort games by rank (for NCAA games)
    const sortGamesByRank = (gamesList) => {
      // Sort by rank for NCAA Football/Basketball
      if (activeLeague.value === 'ncaa-football' || activeLeague.value === 'ncaa-basketball') {
        const getBestTop25Rank = (game) => {
          const competitors = game.competitions?.[0]?.competitors || []
          const ranks = competitors
            .map(c => c.curatedRank?.current)
            .filter(r => typeof r === 'number' && r >= 1 && r <= 25)
          return ranks.length ? Math.min(...ranks) : Number.POSITIVE_INFINITY
        }

        return [...gamesList].sort((a, b) => getBestTop25Rank(a) - getBestTop25Rank(b))
      }

      return gamesList
    }

    // Filter games that have betting information and are available for betting,
    // then sort NCAA games by best Top 25 rank (ascending)
    // Shows all scheduled games with odds (no date re-filtering since we already fetched for the correct date)
    const gamesWithBetting = computed(() => {
      const filtered = games.value.filter(game => {
        const competition = game.competitions?.[0]
        const status = competition?.status
        const isScheduled = status?.type?.state === 'pre'
        if (!isScheduled) return false
        return gameHasOdds(game, activeLeague.value)
      })

      return sortGamesByRank(filtered)
    })

    // Filter sports to only show those with games available for betting
    const availableSports = computed(() => {
      return sports.value.filter(sport => {
        const sportGames = gamesBySport.value[sport.id] || []
        return hasGamesWithBetting(sport.id, sportGames)
      })
    })

    // Fetch games for a specific date
    const fetchGamesForDate = async (date, sportId) => {
      const sport = sports.value.find(s => s.id === sportId)
      if (!sport) return []
      
      const formattedDate = formatDateForAPI(date)
      const apiUrl = `${sport.apiUrl}?dates=${formattedDate}`
      
      try {
        const response = await axios.get(apiUrl)
        return response.data.events || []
      } catch (err) {
        console.error(`Error fetching games for ${sportId} on ${formattedDate}:`, err)
        return []
      }
    }

    // Fetch all odds data
    const fetchAllOdds = async () => {
      try {
        allOdds.value = await oddsService.getAllOdds()
      } catch (err) {
        console.error('Error fetching odds:', err)
        allOdds.value = {}
      }
    }

    // Main fetch function: checks all sports for today first, then tomorrow only if NO sports have games today
    const fetchData = async (showLoading = true) => {
      if (showLoading) {
        loading.value = true
      }
      error.value = null
      
      try {
        // First, ensure we have odds data (refresh it to get latest)
        await fetchAllOdds()
        
        const sportId = activeLeague.value
        const today = new Date()
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        
        // Check all sports for today's games first
        const todayCheckPromises = sports.value.map(async (sport) => {
          try {
            let todayGames = await fetchGamesForDate(today, sport.id)
            let todayGamesWithOdds = todayGames.filter(game => {
              const competition = game.competitions?.[0]
              const status = competition?.status
              const isScheduled = status?.type?.state === 'pre'
              if (!isScheduled) return false
              return gameHasOdds(game, sport.id)
            })
            return { sportId: sport.id, hasGames: todayGamesWithOdds.length > 0, games: todayGames }
          } catch (err) {
            console.error(`Error fetching today's data for ${sport.name}:`, err)
            return { sportId: sport.id, hasGames: false, games: [] }
          }
        })
        
        const todayResults = await Promise.all(todayCheckPromises)
        
        // Check if ANY sport has games today
        const hasAnyGamesToday = todayResults.some(result => result.hasGames)
        
        if (hasAnyGamesToday) {
          // At least one sport has games today - use today's games
          showingDate.value = 'today'
          const activeSportResult = todayResults.find(r => r.sportId === sportId)
          games.value = activeSportResult ? activeSportResult.games : []
          // Update gamesBySport for all sports
          todayResults.forEach(result => {
            gamesBySport.value[result.sportId] = result.games
          })
        } else {
          // No sports have games today - check tomorrow for all sports
          console.log('No games with odds today across all sports, checking tomorrow')
          showingDate.value = 'tomorrow'
          
          const tomorrowCheckPromises = sports.value.map(async (sport) => {
            try {
              const tomorrowGames = await fetchGamesForDate(tomorrow, sport.id)
              const tomorrowGamesWithOdds = tomorrowGames.filter(game => {
                const competition = game.competitions?.[0]
                const status = competition?.status
                const isScheduled = status?.type?.state === 'pre'
                if (!isScheduled) return false
                return gameHasOdds(game, sport.id)
              })
              return { sportId: sport.id, games: tomorrowGames }
            } catch (err) {
              console.error(`Error fetching tomorrow's data for ${sport.name}:`, err)
              return { sportId: sport.id, games: [] }
            }
          })
          
          const tomorrowResults = await Promise.all(tomorrowCheckPromises)
          const activeSportResult = tomorrowResults.find(r => r.sportId === sportId)
          games.value = activeSportResult ? activeSportResult.games : []
          // Update gamesBySport for all sports
          tomorrowResults.forEach(result => {
            gamesBySport.value[result.sportId] = result.games
          })
        }
        
      } catch (err) {
        error.value = err.message || 'Failed to fetch data'
        console.error('Error fetching data:', err)
      } finally {
        if (showLoading) {
          loading.value = false
        }
      }
    }

    // Check all sports to see which have games available (today or tomorrow)
    // Only checks tomorrow if NO sports have games today
    const checkAllSports = async () => {
      // Ensure we have odds data
      if (Object.keys(allOdds.value).length === 0) {
        await fetchAllOdds()
      }
      
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      // First, check all sports for today's games
      const todayCheckPromises = sports.value.map(async (sport) => {
        try {
          let todayGames = await fetchGamesForDate(today, sport.id)
          let todayGamesWithOdds = todayGames.filter(game => {
            const competition = game.competitions?.[0]
            const status = competition?.status
            const isScheduled = status?.type?.state === 'pre'
            if (!isScheduled) return false
            return gameHasOdds(game, sport.id)
          })
          return { sportId: sport.id, hasGames: todayGamesWithOdds.length > 0, games: todayGames }
        } catch (err) {
          console.error(`Error fetching today's data for ${sport.name}:`, err)
          return { sportId: sport.id, hasGames: false, games: [] }
        }
      })
      
      const todayResults = await Promise.all(todayCheckPromises)
      
      // Check if ANY sport has games today
      const hasAnyGamesToday = todayResults.some(result => result.hasGames)
      
      if (hasAnyGamesToday) {
        // At least one sport has games today - store today's games for all sports
        todayResults.forEach(result => {
          gamesBySport.value[result.sportId] = result.games
        })
      } else {
        // No sports have games today - check tomorrow for all sports
        console.log('No games with odds today across all sports, checking tomorrow')
        const tomorrowCheckPromises = sports.value.map(async (sport) => {
          try {
            const tomorrowGames = await fetchGamesForDate(tomorrow, sport.id)
            const tomorrowGamesWithOdds = tomorrowGames.filter(game => {
              const competition = game.competitions?.[0]
              const status = competition?.status
              const isScheduled = status?.type?.state === 'pre'
              if (!isScheduled) return false
              return gameHasOdds(game, sport.id)
            })
            return { sportId: sport.id, games: tomorrowGames }
          } catch (err) {
            console.error(`Error fetching tomorrow's data for ${sport.name}:`, err)
            return { sportId: sport.id, games: [] }
          }
        })
        
        const tomorrowResults = await Promise.all(tomorrowCheckPromises)
        tomorrowResults.forEach(result => {
          gamesBySport.value[result.sportId] = result.games
        })
      }
    }

    const setActiveLeague = (league) => {
      activeLeague.value = league
      // Restart refresh with new league
      stopLiveRefresh()
      startLiveRefresh()
    }

    // Start periodic refresh for live games
    const startLiveRefresh = () => {
      // Initial fetch with loading
      fetchData(true)
      
      // Set up interval to refresh every 30 seconds (without loading indicator)
      // This also refreshes odds data to catch new games
      refreshInterval.value = setInterval(() => {
        fetchData(false)
      }, 30000)
    }

    // Stop live refresh
    const stopLiveRefresh = () => {
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value)
        refreshInterval.value = null
      }
    }

    // Start periodic refresh for all sports (to update available sports list)
    const startAllSportsRefresh = () => {
      // Check all sports every 5 minutes to update availability
      // Also refresh odds data periodically
      allSportsRefreshInterval.value = setInterval(async () => {
        await fetchAllOdds()
        await checkAllSports()
      }, 300000) // 5 minutes
    }

    // Stop all sports refresh
    const stopAllSportsRefresh = () => {
      if (allSportsRefreshInterval.value) {
        clearInterval(allSportsRefreshInterval.value)
        allSportsRefreshInterval.value = null
      }
    }

    const fetchUserLeagues = async () => {
      if (!userStore.currentUser.value?.username) return
      
      try {
        const response = await axios.get(`${API_BASE_URL}/user/${userStore.currentUser.value.username}/leagues`)
        userLeaguesForLeaderboard.value = response.data || []
      } catch (error) {
        console.error('Error fetching user leagues:', error)
        userLeaguesForLeaderboard.value = []
      }
    }

    onMounted(async () => {
      await fetchUserLeagues()
      // Fetch odds data first
      await fetchAllOdds()
      // Check all sports first to see which have games available
      await checkAllSports()
      
      // If current active league doesn't have games, switch to first available
      if (availableSports.value.length > 0) {
        const hasActiveLeagueGames = availableSports.value.some(sport => sport.id === activeLeague.value)
        if (!hasActiveLeagueGames) {
          activeLeague.value = availableSports.value[0].id
        }
      }
      
      startLiveRefresh()
      startAllSportsRefresh()
    })

    onUnmounted(() => {
      stopLiveRefresh()
      stopAllSportsRefresh()
    })

      return {
      games,
      loading,
      error,
      activeLeague,
      sports,
      availableSports,
      currentSport,
      currentGameCardComponent,
      gamesWithBetting,
      userBalance,
      userStats,
      outstandingBetAmount,
      winPotential,
      isAdmin,
      fetchData,
      setActiveLeague,
      userLeaguesForLeaderboard,
      showingDate
    }
  }
}
</script>

<style scoped>
.betting-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #4169e1 0%, #1e3a8a 100%);
  padding: 2rem 0;
}

.page-header {
  text-align: center;
  margin-bottom: 3rem;
  color: white;
}

.page-title {
  font-size: 3rem;
  font-weight: 800;
  margin: 0 0 1rem 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.title-icon {
  font-size: 3.5rem;
  margin-right: 1rem;
}

.page-description {
  font-size: 1.2rem;
  margin: 0;
  opacity: 0.9;
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
}

.stats-dashboard {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin: 2rem auto;
  max-width: 800px;
  padding: 0 2rem;
}

.stat-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.2);
  min-width: 150px;
  transition: transform 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.stat-value {
  font-size: 2rem;
  font-weight: 800;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
}

.stat-value.positive {
  color: #059669;
}

.stat-value.negative {
  color: #dc2626;
}

.stat-label {
  font-size: 0.9rem;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.league-selection {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin: 0 auto 3rem auto;
  max-width: 900px;
  padding: 0 2rem;
}

.league-chip {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 2rem;
  background: rgba(255, 255, 255, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50px;
  color: white;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
}

.league-chip::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.league-chip:hover::before {
  left: 100%;
}

.league-chip:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.league-chip.active {
  background: rgba(255, 255, 255, 0.95);
  color: #1e3a8a;
  border-color: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 20px rgba(255, 255, 255, 0.3), 0 0 20px rgba(65, 105, 225, 0.3);
  transform: translateY(-2px);
}

.league-chip.active:hover {
  background: white;
  box-shadow: 0 6px 24px rgba(255, 255, 255, 0.4), 0 0 24px rgba(65, 105, 225, 0.4);
}

.chip-icon {
  font-size: 1.5rem;
  line-height: 1;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.league-chip.active .chip-icon {
  filter: drop-shadow(0 2px 4px rgba(65, 105, 225, 0.3));
}

.chip-text {
  white-space: nowrap;
}

.games-header {
  max-width: 1200px;
  margin: 0 auto 2rem auto;
  padding: 0 2rem;
}

.games-header h2 {
  color: white;
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 1rem 0;
  text-align: center;
}

.section-description {
  color: white;
  text-align: center;
  margin: 0;
  opacity: 0.9;
  font-size: 1.1rem;
}

.games-section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.stats-dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin: 2rem auto;
  max-width: 1000px;
  padding: 0 2rem;
}

.error-message {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.error-message h3 {
  color: #dc2626;
  margin: 0 0 1rem 0;
}

.error-message p {
  color: #6b7280;
  margin: 0 0 1.5rem 0;
}

.retry-btn {
  background: #2563eb;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.retry-btn:hover {
  background: #1d4ed8;
}

.loading-container {
  background: white;
  border-radius: 12px;
  padding: 3rem;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.spinner-large {
  width: 50px;
  height: 50px;
  border: 4px solid #e5e7eb;
  border-top: 4px solid #2563eb;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-container p {
  color: #6b7280;
  margin: 0;
  font-size: 1.1rem;
}

.no-games {
  background: white;
  border-radius: 12px;
  padding: 3rem;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.no-games h3 {
  color: #1a1a1a;
  margin: 0 0 1rem 0;
}

.no-games p {
  color: #6b7280;
  margin: 0;
  font-size: 1.1rem;
}

@media (max-width: 768px) {
  .betting-page {
    padding: 1rem 0;
  }
  
  .page-title {
    font-size: 2rem;
  }
  
  .title-icon {
    font-size: 2.5rem;
  }
  
  .page-description {
    font-size: 1rem;
    padding: 0 1rem;
  }
  
  .stats-dashboard {
    flex-direction: column;
    gap: 1rem;
    margin: 1.5rem auto;
    padding: 0 1rem;
  }
  
  .stat-card {
    min-width: auto;
    padding: 1rem;
  }
  
  .stat-value {
    font-size: 1.5rem;
  }
  
  .games-section {
    padding: 0 1rem;
  }
  
  .games-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .league-selection {
    padding: 0 1rem;
    margin: 0 auto 2rem auto;
    gap: 0.75rem;
  }
  
  .league-chip {
    padding: 0.75rem 1.5rem;
    font-size: 0.9rem;
    gap: 0.5rem;
  }
  
  .chip-icon {
    font-size: 1.2rem;
  }
}
</style>
