<template>
  <div class="friends-bets" v-if="isAuthenticated">
    <div class="league-selector-section" v-if="userLeagues.length > 0 || isAdmin">
      <div class="search-filter-left">
        <label class="search-filter-label">Search Friends Bets:</label>
        <input 
          v-model="searchUsername"
          type="text"
          placeholder="Enter username or name..."
          class="search-input"
        />
      </div>
      <div class="filters-right">
        <div class="league-selector-right">
          <label class="league-selector-label">Select League:</label>
          <select 
            v-model="selectedLeagueId" 
            @change="fetchFriendsBets"
            class="league-selector"
            :disabled="isDropdownDisabled"
          >
            <option v-if="isAdmin" value="all-bets">All Bets from All Users</option>
            <option value="">All My Leagues</option>
            <option 
              v-for="league in userLeagues" 
              :key="league._id"
              :value="league._id"
            >
              {{ league.name }}
            </option>
          </select>
        </div>
        <div class="status-filter-right">
          <label class="status-filter-label">Filter:</label>
          <select 
            v-model="selectedStatusFilter"
            class="status-filter-select"
          >
            <option value="">All</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="pending">Pending</option>
            <option value="huge-bets">Huge Bets</option>
            <option value="big-underdogs">Big Underdogs</option>
            <option value="live-bets">Live Bets</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="userLeagues.length === 0 && !isAdmin" class="no-leagues">
      <p>You're not in any leagues yet. Join or create a league to see your friends' bets!</p>
    </div>

    <div v-else class="bets-section">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading friends' bets...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
        <button @click="fetchFriendsBets" class="retry-btn">Try Again</button>
      </div>

      <div v-else-if="filteredFriendsBets.length === 0" class="no-bets">
        <p>No pending or recent bets from your friends yet.</p>
      </div>

      <div v-else>
        <div class="bets-list">
          <BetCard
            v-for="(betWithUser, index) in paginatedFriendsBets" 
            :key="`${betWithUser.user.username}-${betWithUser.bet._id}-${index}`"
            :bet="betWithUser.bet"
            :user="betWithUser.user"
            :live-scores="liveScores"
            :show-cancel-button="false"
          />
        </div>
        <!-- Pagination Controls -->
        <div v-if="totalPages > 1 || filteredFriendsBets.length > 0" class="pagination">
          <div class="pagination-left">
            <label class="page-size-label">Items per page:</label>
            <select v-model="itemsPerPage" @change="handlePageSizeChange" class="page-size-select">
              <option :value="5">5</option>
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </div>
          <div v-if="totalPages > 1" class="pagination-right">
            <button 
              @click="goToPage(currentPage - 1)" 
              :disabled="currentPage === 1"
              class="pagination-btn"
            >
              Previous
            </button>
            <div class="pagination-info">
              Page {{ currentPage }} of {{ totalPages }}
            </div>
            <button 
              @click="goToPage(currentPage + 1)" 
              :disabled="currentPage === totalPages"
              class="pagination-btn"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'
import liveScoreService from '../services/liveScoreService.js'
import BetCard from './BetCard.vue'

export default {
  name: 'FriendsBets',
  components: {
    BetCard
  },
  setup() {
    const userStore = useUserStore()
    const userLeagues = ref([])
    const selectedLeagueId = ref('')
    const friendsBets = ref([])
    const selectedStatusFilter = ref('')
    const searchUsername = ref('')
    const loading = ref(false)
    const error = ref('')
    const liveScores = ref(new Map())
    const refreshInterval = ref(null)
    const currentPage = ref(1)
    const itemsPerPage = ref(18)

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    const currentUser = computed(() => userStore.currentUser.value)
    
    // Check if current user is admin
    const isAdmin = computed(() => {
      return currentUser.value?.username === 'tannerholle' || currentUser.value?.username === 'tanner'
    })

    // Check if dropdown should be disabled (non-admin with only 1 league)
    const isDropdownDisabled = computed(() => {
      return !isAdmin.value && userLeagues.value.length === 1
    })

    // Helper function to parse odds and check if it's a big underdog
    const isBigUnderdog = (odds) => {
      if (!odds) return false
      
      // Handle "EVEN" odds
      if (odds === 'EVEN' || odds === 'even') {
        return false // Even odds are not underdogs
      }
      
      let oddsValue
      
      // Handle number format (e.g., 150 means +150)
      if (typeof odds === 'number') {
        oddsValue = odds
        // Big underdog = positive odds of +200 or higher
        return oddsValue >= 200
      }
      
      // Handle string format - can be "+150", "-200", "150", or "-200"
      if (typeof odds === 'string') {
        // Check if it starts with "-" (favorite, not underdog)
        if (odds.startsWith('-')) {
          return false
        }
        
        // Parse the number (remove "+" if present, or just parse the number)
        oddsValue = parseInt(odds.replace(/[+-]/, ''))
        if (isNaN(oddsValue)) return false
        
        // Big underdog = positive odds of +200 or higher
        return oddsValue >= 200
      }
      
      return false
    }

    // Helper function to check if bet is a huge bet
    const isHugeBet = (amount) => {
      // Huge bet = $100 or more
      return amount > 100
    }

    // Filter bets by status or special filters
    const filteredFriendsBets = computed(() => {
      let filtered = friendsBets.value
      
      // Filter by username or name search
      if (searchUsername.value.trim()) {
        const searchTerm = searchUsername.value.trim().toLowerCase()
        filtered = filtered.filter(betWithUser => {
          const usernameMatch = betWithUser.user.username?.toLowerCase().includes(searchTerm)
          const nameMatch = betWithUser.user.name?.toLowerCase().includes(searchTerm)
          return usernameMatch || nameMatch
        })
      }
      
      // Filter by status or special filters
      if (!selectedStatusFilter.value) {
        return filtered
      }
      
      // Handle status filters (won, lost, pending)
      if (['won', 'lost', 'pending'].includes(selectedStatusFilter.value)) {
        return filtered.filter(betWithUser => 
          betWithUser.bet.status === selectedStatusFilter.value
        )
      }
      
      // Handle "huge bets" filter
      if (selectedStatusFilter.value === 'huge-bets') {
        return filtered.filter(betWithUser => 
          isHugeBet(betWithUser.bet.amount)
        )
      }
      
      // Handle "big underdogs" filter
      if (selectedStatusFilter.value === 'big-underdogs') {
        return filtered.filter(betWithUser => 
          isBigUnderdog(betWithUser.bet.odds)
        )
      }
      
      // Handle "live bets" filter - bets on games currently in progress
      if (selectedStatusFilter.value === 'live-bets') {
        return filtered.filter(betWithUser => 
          isGameLive(betWithUser.bet)
        )
      }
      
      return filtered
    })

    const totalPages = computed(() => {
      return Math.ceil(filteredFriendsBets.value.length / itemsPerPage.value)
    })

    const paginatedFriendsBets = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value
      const end = start + itemsPerPage.value
      return filteredFriendsBets.value.slice(start, end)
    })

    // Set default selected league based on user type and league count
    const setDefaultLeague = () => {
      if (isAdmin.value) {
        // Admin defaults to "all-bets"
        selectedLeagueId.value = 'all-bets'
      } else if (userLeagues.value.length === 1) {
        // Non-admin with 1 league defaults to that league
        selectedLeagueId.value = userLeagues.value[0]._id
      } else {
        // Non-admin with multiple leagues defaults to "All Leagues" (empty)
        selectedLeagueId.value = ''
      }
    }

    // Fetch user's leagues
    const fetchUserLeagues = async () => {
      if (!currentUser.value?.username) return
      
      try {
        const response = await axios.get(`${API_BASE_URL}/user/${currentUser.value.username}/leagues`)
        userLeagues.value = response.data || []
        // Set default after fetching leagues
        setDefaultLeague()
      } catch (error) {
        console.error('Error fetching user leagues:', error)
        userLeagues.value = []
        setDefaultLeague()
      }
    }

    // Fetch bets from friends
    const fetchFriendsBets = async () => {
      if (!currentUser.value?.username) return
      
      loading.value = true
      error.value = ''
      currentPage.value = 1 // Reset to first page when fetching new bets
      
      try {
        let users = {}
        
        // If admin selected "all-bets", fetch all users (no league filter)
        if (selectedLeagueId.value === 'all-bets') {
          const response = await axios.get(`${API_BASE_URL}/users`)
          users = response.data
        }
        // If "All Leagues" is selected (empty), fetch users from all leagues user is in
        else if (!selectedLeagueId.value) {
          // Fetch users from each league the user is in and combine them
          const allUsersMap = new Map()
          for (const league of userLeagues.value) {
            try {
              const response = await axios.get(`${API_BASE_URL}/users?leagueId=${league._id}`)
              const leagueUsers = response.data
              // Merge users (avoid duplicates by username)
              Object.values(leagueUsers).forEach(user => {
                if (!allUsersMap.has(user.username)) {
                  allUsersMap.set(user.username, user)
                }
              })
            } catch (error) {
              console.error(`Error fetching users for league ${league._id}:`, error)
            }
          }
          users = Object.fromEntries(allUsersMap)
        }
        // Otherwise, fetch users from the specific selected league
        else {
          const response = await axios.get(`${API_BASE_URL}/users?leagueId=${selectedLeagueId.value}`)
          users = response.data
        }
        
        // Get pending bets and bets that won/lost within last 7 days from friends (excluding current user)
        const betsWithUsers = []
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        
        Object.values(users).forEach(user => {
          if (user.username !== currentUser.value.username && user.bets) {
            const relevantBets = user.bets.filter(bet => {
              // Include pending bets
              if (bet.status === 'pending') {
                return true
              }
              
              // Include won/lost bets from last 7 days
              if (bet.status === 'won' || bet.status === 'lost') {
                // Check if bet has a resolvedAt date
                if (bet.resolvedAt) {
                  const resolvedDate = new Date(bet.resolvedAt)
                  return resolvedDate >= sevenDaysAgo
                }
                // If no resolvedAt, check createdAt (fallback)
                if (bet.createdAt) {
                  const createdDate = new Date(bet.createdAt)
                  return createdDate >= sevenDaysAgo
                }
                return false
              }
              
              return false
            })
            
            relevantBets.forEach(bet => {
              betsWithUsers.push({
                bet: bet,
                user: user
              })
            })
          }
        })
        
        // Sort by most recent first (use resolvedAt for won/lost, createdAt for pending)
        betsWithUsers.sort((a, b) => {
          const dateA = (a.bet.resolvedAt && (a.bet.status === 'won' || a.bet.status === 'lost')) 
            ? new Date(a.bet.resolvedAt) 
            : new Date(a.bet.createdAt)
          const dateB = (b.bet.resolvedAt && (b.bet.status === 'won' || b.bet.status === 'lost')) 
            ? new Date(b.bet.resolvedAt) 
            : new Date(b.bet.createdAt)
          return dateB - dateA
        })
        
        friendsBets.value = betsWithUsers
        
        // Fetch live scores for these bets
        if (betsWithUsers.length > 0) {
          fetchLiveScores()
        }
      } catch (err) {
        console.error('Error fetching friends bets:', err)
        error.value = 'Failed to load friends bets. Please try again.'
        friendsBets.value = []
      } finally {
        loading.value = false
      }
    }

    // Check if a game is live
    const isGameLive = (bet) => {
      const liveData = liveScores.value.get(bet.gameId)
      return liveData && liveData.isLive && !liveData.isCompleted
    }


    // Get sport from bet data
    const getSportFromBet = (bet) => {
      if (bet.sport) {
        return bet.sport
      }
      
      const homeTeam = bet.gameData?.homeTeam?.toLowerCase() || ''
      const awayTeam = bet.gameData?.awayTeam?.toLowerCase() || ''
      
      const nflTeams = ['commanders', 'chiefs', 'cowboys', 'giants', 'eagles', 'washington', 'kansas city', 'dallas', 'new york', 'philadelphia', 'patriots', 'bills', 'dolphins', 'jets', 'ravens', 'bengals', 'browns', 'steelers', 'texans', 'colts', 'jaguars', 'titans', 'broncos', 'raiders', 'chargers', 'cardinals', 'rams', '49ers', 'seahawks', 'packers', 'bears', 'lions', 'vikings', 'falcons', 'panthers', 'saints', 'buccaneers']
      if (nflTeams.some(team => homeTeam.includes(team) || awayTeam.includes(team))) {
        return 'nfl'
      }
      
      const nbaTeams = ['lakers', 'kings', 'clippers', 'trail blazers', 'cavaliers', 'pistons', '76ers', 'magic', 'bulls', 'hawks', 'timberwolves', 'nuggets', 'warriors', 'celtics', 'heat', 'knicks', 'nets', 'raptors', 'bucks', 'pacers', 'hornets', 'wizards', 'thunder', 'mavericks', 'rockets', 'grizzlies', 'pelicans', 'spurs', 'suns', 'jazz', 'blazers']
      if (nbaTeams.some(team => homeTeam.includes(team) || awayTeam.includes(team))) {
        return 'nba'
      }
      
      const ncaaBasketballTeams = ['duke', 'kentucky', 'north carolina', 'kansas', 'villanova', 'gonzaga', 'michigan state', 'michigan', 'ohio state', 'indiana', 'purdue', 'wisconsin', 'maryland', 'illinois', 'iowa', 'minnesota', 'nebraska', 'northwestern', 'rutgers', 'penn state']
      if (ncaaBasketballTeams.some(team => homeTeam.includes(team) || awayTeam.includes(team))) {
        return 'ncaa-basketball'
      }
      
      const ncaaFootballTeams = ['alabama', 'auburn', 'georgia', 'florida', 'tennessee', 'lsu', 'texas a&m', 'ole miss', 'mississippi state', 'arkansas', 'missouri', 'kentucky', 'vanderbilt', 'south carolina', 'ohio state', 'michigan', 'penn state', 'michigan state', 'wisconsin', 'iowa']
      if (ncaaFootballTeams.some(team => homeTeam.includes(team) || awayTeam.includes(team))) {
        return 'ncaa-football'
      }
      
      return 'nba'
    }

    // Fetch live scores for all bets
    const fetchLiveScores = async () => {
      if (!friendsBets.value.length) return

      try {
        const betsBySport = {}
        friendsBets.value.forEach(({ bet }) => {
          const sport = getSportFromBet(bet)
          if (!betsBySport[sport]) {
            betsBySport[sport] = []
          }
          betsBySport[sport].push(bet)
        })

        const allScores = new Map()
        for (const [sport, bets] of Object.entries(betsBySport)) {
          const gameIds = [...new Set(bets.map(bet => bet.gameId))]
          if (gameIds.length > 0) {
            try {
              const scores = await liveScoreService.getLiveScores(gameIds, sport)
              scores.forEach((data, gameId) => {
                allScores.set(gameId, data)
              })
            } catch (error) {
              console.error(`Error fetching live scores for ${sport}:`, error)
            }
          }
        }
        
        liveScores.value = allScores
      } catch (error) {
        console.error('Error fetching live scores:', error)
      }
    }

    // Start periodic refresh for live scores
    const startLiveScoreRefresh = () => {
      fetchLiveScores()
      refreshInterval.value = setInterval(fetchLiveScores, 10000)
    }

    // Stop live score refresh
    const stopLiveScoreRefresh = () => {
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value)
        refreshInterval.value = null
      }
    }

    // Pagination functions
    const goToPage = (page) => {
      if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page
        // Scroll to top of friends bets section
        const friendsBetsElement = document.querySelector('.friends-bets')
        if (friendsBetsElement) {
          friendsBetsElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }

    // Watch for filter changes and reset to page 1
    const watchFilters = () => {
      currentPage.value = 1
    }

    const handlePageSizeChange = () => {
      // Reset to page 1 when page size changes
      currentPage.value = 1
      // Scroll to the component container so "Search Friends Bets" title is visible
      const friendsBetsElement = document.querySelector('.friends-bets')
      if (friendsBetsElement) {
        friendsBetsElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }

    // Watch for filter changes and reset pagination
    watch([selectedStatusFilter, searchUsername, selectedLeagueId], () => {
      watchFilters()
    })

    onMounted(async () => {
      await fetchUserLeagues()
      // Fetch bets if user has leagues OR is an admin (admins can see all bets)
      if (userLeagues.value.length > 0 || isAdmin.value) {
        await fetchFriendsBets()
        startLiveScoreRefresh()
      }
    })

    onUnmounted(() => {
      stopLiveScoreRefresh()
    })

    return {
      isAuthenticated,
      isAdmin,
      isDropdownDisabled,
      userLeagues,
      selectedLeagueId,
      selectedStatusFilter,
      searchUsername,
      friendsBets,
      filteredFriendsBets,
      paginatedFriendsBets,
      totalPages,
      currentPage,
      loading,
      error,
      fetchFriendsBets,
      liveScores,
      isGameLive,
      goToPage,
      handlePageSizeChange,
      itemsPerPage
    }
  }
}
</script>

<style scoped>
.friends-bets {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  margin-bottom: 2rem;
}

.league-selector-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 2rem;
  flex-wrap: wrap;
}

.search-filter-left {
  flex: 1;
  min-width: 200px;
}

.filters-right {
  display: flex;
  gap: 2rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.league-selector-right {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 200px;
}

.league-selector-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.league-selector {
  width: 100%;
  max-width: 300px;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.status-filter-right {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.status-filter-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.status-filter-select {
  width: 100%;
  max-width: 200px;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s ease;
}


.search-filter-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.search-input {
  width: 100%;
  max-width: 300px;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  transition: border-color 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-input::placeholder {
  color: #9ca3af;
}

.status-filter-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.league-selector:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.league-selector:disabled {
  background: #f3f4f6;
  cursor: default;
  opacity: 0.6;
}

.no-leagues {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
}

.no-leagues p {
  font-size: 1.1rem;
  margin: 0;
}

.loading-state,
.error-state,
.no-bets {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
}

.loading-state p,
.error-state p,
.no-bets p {
  font-size: 1.1rem;
  margin: 0.5rem 0 0 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.retry-btn {
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.retry-btn:hover {
  background: #2563eb;
}

.bets-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 1084px) {
  .bets-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1600px) {
  .bets-list {
    grid-template-columns: repeat(3, 1fr);
  }
}

.bet-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.3s ease;
  border-left: 4px solid #3b82f6;
}

.bet-card.won {
  border-left: 4px solid #059669;
  background: #ecfdf5;
}

.bet-card.lost {
  border-left: 4px solid #dc2626;
  background: #fef2f2;
}

.bet-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.bet-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.bet-header-right {
  display: flex;
  align-items: center;
}

.bet-header-right-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bet-user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.username {
  font-weight: 600;
  color: #1a1a1a;
  font-size: 1rem;
}

.bet-date {
  font-size: 0.875rem;
  color: #6b7280;
  display: block;
  margin-bottom: 0.25rem;
}

.game-start-time {
  font-size: 0.875rem;
  color: #6b7280;
  display: block;
  margin: 0 0 1rem 0;
}

.bet-status {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
}

.bet-status.pending {
  background: #fef3c7;
  color: #92400e;
}

.bet-status.won {
  background: #d1fae5;
  color: #065f46;
}

.bet-status.lost {
  background: #fee2e2;
  color: #991b1b;
}

.bet-game h4 {
  margin: 0;
  color: #1a1a1a;
  font-size: 1.1rem;
  font-weight: 600;
}

.bet-details {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;
  align-items: center;
}

.bet-type-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.bet-type {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.bet-selection {
  font-weight: 600;
  color: #1a1a1a;
}

.bet-amounts {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bet-amount {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 0.75rem;
}

.bet-amount .label {
  font-size: 0.875rem;
  color: #6b7280;
}

.bet-amount .value {
  font-weight: 600;
  color: #1a1a1a;
}

.bet-amount .value.potential {
  color: #059669;
}

.bet-odds {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 0.75rem;
}

.bet-odds .label {
  font-size: 0.875rem;
  color: #6b7280;
}

.bet-odds .value {
  font-weight: 600;
  color: #1a1a1a;
}

/* Final Score Inline Styles */
.final-score-inline {
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 400;
}

.final-score-text {
  display: inline-block;
}

.total-badge {
  color: #475569;
  font-weight: 500;
  margin-left: 0.25rem;
}

.spread-badge {
  color: #475569;
  font-weight: 500;
  margin-left: 0.25rem;
}

/* Live Game Data Styles */
.live-game-data {
  margin-top: 1rem;
  padding: 1rem;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 0.5rem;
  border: 1px solid #f59e0b;
}

.live-score {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: #92400e;
}

.team-score {
  color: #92400e;
}

.score-separator {
  color: #a16207;
  font-weight: 500;
}

.live-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.live-indicator {
  color: #dc2626;
  font-weight: 700;
  font-size: 0.9rem;
  animation: pulse 2s infinite;
}

.game-time {
  font-size: 0.9rem;
  color: #92400e;
  font-weight: 600;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@media (max-width: 768px) {
  .friends-bets {
    padding: 1.5rem;
  }
  
  .bet-details {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  
  .bet-header {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .league-selector {
    max-width: 100%;
  }
  
  .league-selector-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-filter-left {
    width: 100%;
  }
  
  .search-input {
    max-width: 100%;
  }
  
  .filters-right {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  
  .league-selector-right {
    width: 100%;
  }
  
  .league-selector {
    max-width: 100%;
  }
  
  .status-filter-right {
    align-items: stretch;
  }
  
  .status-filter-select {
    max-width: 100%;
  }
}

/* Pagination Styles */
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e5e7eb;
  flex-wrap: wrap;
}

.pagination-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.page-size-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
  white-space: nowrap;
}

.page-size-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s ease;
  min-width: 60px;
}

.page-size-select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.pagination-right {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
}

.pagination-btn {
  padding: 0.75rem 1.5rem;
  border: 2px solid #e5e7eb;
  background: white;
  border-radius: 8px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 100px;
}

.pagination-btn:hover:not(:disabled) {
  border-color: #2563eb;
  background: #eff6ff;
  color: #2563eb;
  transform: translateY(-1px);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f9fafb;
}

.pagination-info {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
  min-width: 100px;
  text-align: center;
}

@media (max-width: 768px) {
  .pagination {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .pagination-left {
    justify-content: center;
  }
  
  .pagination-right {
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }
  
  .pagination-btn {
    width: 100%;
  }
}
</style>
