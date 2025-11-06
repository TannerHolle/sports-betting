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
    </div>

    <!-- Bet History -->
    <BetHistory />

    <!-- Leaderboard -->
    <Leaderboard :user-leagues="userLeaguesForLeaderboard" />

    <!-- Games Header -->
    <div class="games-header">
      <h2>{{ noGamesToday ? 'Games Tomorrow Available for Betting' : 'Games Today Available for Betting' }}</h2>
      <p class="section-description" v-if="!loading && gamesWithBetting.length === 0">
        No games left to bet on {{ noGamesToday ? 'tomorrow' : 'today' }}.
      </p>
      <p class="section-description" v-else>
        Scheduled games with betting lines that are happening {{ noGamesToday ? 'tomorrow' : 'today' }} are shown below. If you'd like to bet on a specific game, click on live sports and go to the league and date of the game you want to bet on.
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
    
    <!-- Sportsbook Revenue -->
    <SportsbookRevenue v-if="isAdmin" />

    <!-- Bet Resolver -->
    <BetResolver v-if="isAdmin" />

    <!-- Admin Panel -->
    <AdminPanel v-if="isAdmin" />
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import axios from 'axios'
import { useUserStore } from '../stores/userStore.js'
import { API_BASE_URL } from '../config/api.js'
import { isGameToday } from '../utils/timezoneUtils.js'
import BetHistory from './BetHistory.vue'
import BetResolver from './BetResolver.vue'
import AdminPanel from './AdminPanel.vue'
import SportsbookRevenue from './SportsbookRevenue.vue'
import Leaderboard from './Leaderboard.vue'
import NCAAFootballCard from './NCAAFootballCard.vue'
import NFLGameCard from './NFLGameCard.vue'
import CollegeBasketballCard from './CollegeBasketballCard.vue'
import NBAGameCard from './NBAGameCard.vue'

export default {
  name: 'BettingPage',
  components: {
    BetHistory,
    BetResolver,
    AdminPanel,
    SportsbookRevenue,
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
    const noGamesToday = ref(false) // Track if there are no games to bet on today

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

    // Helper to format tomorrow's date for API (YYYYMMDD)
    const getTomorrowDateString = () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      return `${tomorrow.getFullYear()}${String(tomorrow.getMonth() + 1).padStart(2, '0')}${String(tomorrow.getDate()).padStart(2, '0')}`
    }

    // Helper to check if a game matches betting criteria
    const matchesBettingCriteria = (game, sportId, isTomorrow = false) => {
      const competition = game.competitions?.[0]
      const isScheduled = competition?.status?.type?.state === 'pre'
      if (!isScheduled) return false

      // For tomorrow's games (fetched via date param), trust API and be lenient with odds
      if (isTomorrow) return true

      // For today's games, check date and require odds (except NBA)
      const dateMatches = isGameToday(game.date)
      if (sportId === 'nba') return dateMatches
      return dateMatches && competition?.odds?.length > 0
    }

    // Check if games list has betting available (today or tomorrow)
    const hasGamesWithBetting = (sportId, gamesList) => {
      if (!gamesList?.length) return false
      return gamesList.some(game => 
        matchesBettingCriteria(game, sportId, false) || 
        matchesBettingCriteria(game, sportId, true)
      )
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

    // Filter games with betting available, sorted by rank for NCAA games
    const gamesWithBetting = computed(() => {
      const filtered = games.value.filter(game => 
        matchesBettingCriteria(game, activeLeague.value, noGamesToday.value)
      )
      return sortGamesByRank(filtered)
    })

    // Filter sports to show those with games available for betting (today or tomorrow)
    const availableSports = computed(() => {
      return sports.value.filter(sport => {
        const sportGames = gamesBySport.value[sport.id] || []
        return hasGamesWithBetting(sport.id, sportGames)
      })
    })

    const fetchData = async (showLoading = true) => {
      if (showLoading) loading.value = true
      error.value = null
      
      try {
        const baseApiUrl = currentSport.value?.apiUrl
        if (!baseApiUrl) throw new Error('No API URL configured for current sport')
        
        // Fetch today's games
        const response = await axios.get(baseApiUrl)
        const fetchedGames = response.data.events || []
        
        // Check if we have games with betting for today (strict date check)
        const hasGamesToday = fetchedGames.some(game => 
          matchesBettingCriteria(game, activeLeague.value, false)
        )
        
        if (hasGamesToday) {
          games.value = fetchedGames
          noGamesToday.value = false
        } else {
          // No games today, fetch tomorrow's games
          try {
            const tomorrowUrl = `${baseApiUrl}?dates=${getTomorrowDateString()}`
            const tomorrowResponse = await axios.get(tomorrowUrl)
            games.value = tomorrowResponse.data.events || []
            noGamesToday.value = true
          } catch (tomorrowErr) {
            console.error('Error fetching tomorrow\'s games:', tomorrowErr)
            games.value = fetchedGames
            noGamesToday.value = true
          }
        }
        
        gamesBySport.value[activeLeague.value] = games.value
      } catch (err) {
        error.value = err.message || 'Failed to fetch data'
        console.error('Error fetching data:', err)
      } finally {
        if (showLoading) loading.value = false
      }
    }

    // Check all sports to see which have games available
    const checkAllSports = async () => {
      const checkPromises = sports.value.map(async (sport) => {
        try {
          const response = await axios.get(sport.apiUrl)
          const fetchedGames = response.data.events || []
          
          // Check if we have games with betting today
          const hasGamesToday = fetchedGames.some(game => 
            matchesBettingCriteria(game, sport.id, false)
          )
          
          if (hasGamesToday) {
            gamesBySport.value[sport.id] = fetchedGames
          } else {
            // Fetch tomorrow's games and combine with today's
            try {
              const tomorrowUrl = `${sport.apiUrl}?dates=${getTomorrowDateString()}`
              const tomorrowResponse = await axios.get(tomorrowUrl)
              const tomorrowGames = tomorrowResponse.data.events || []
              gamesBySport.value[sport.id] = [...fetchedGames, ...tomorrowGames]
            } catch {
              gamesBySport.value[sport.id] = fetchedGames
            }
          }
        } catch (err) {
          console.error(`Error fetching data for ${sport.name}:`, err)
          gamesBySport.value[sport.id] = []
        }
      })
      
      await Promise.all(checkPromises)
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
      
      // Set up interval to refresh every 10 seconds (without loading indicator)
      refreshInterval.value = setInterval(() => fetchData(false), 10000)
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
      // Check all sports every 60 seconds to update availability
      allSportsRefreshInterval.value = setInterval(() => {
        checkAllSports()
      }, 60000)
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
      isAdmin,
      fetchData,
      setActiveLeague,
      userLeaguesForLeaderboard,
      noGamesToday
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
