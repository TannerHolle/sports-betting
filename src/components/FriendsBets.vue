<template>
  <div class="friends-bets" v-if="isAuthenticated">
    <div class="league-selector-section" v-if="userLeagues.length > 0 || isAdmin">
      <label class="league-selector-label">Select League:</label>
      <select 
        v-model="selectedLeagueId" 
        @change="fetchFriendsBets"
        class="league-selector"
        :disabled="isDropdownDisabled"
      >
        <option value="">All Leagues</option>
        <option v-if="isAdmin" value="all-bets">All Bets from All Users (admin only)</option>
        <option 
          v-for="league in userLeagues" 
          :key="league._id"
          :value="league._id"
        >
          {{ league.name }}
        </option>
      </select>
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

      <div v-else-if="friendsBets.length === 0" class="no-bets">
        <p>No pending or recent bets from your friends yet.</p>
      </div>

      <div v-else class="bets-list">
        <div 
          v-for="betWithUser in friendsBets" 
          :key="`${betWithUser.user.username}-${betWithUser.bet._id}`"
          class="bet-card"
          :class="betWithUser.bet.status"
        >
          <div class="bet-header">
            <div class="bet-user-info">
              <div class="user-avatar">{{ getInitials(betWithUser.user.username) }}</div>
              <div class="user-details">
                <div class="username">{{ betWithUser.user.username }}</div>
                <div class="bet-date">
                  <span v-if="betWithUser.bet.status === 'pending'">{{ formatDate(betWithUser.bet.createdAt) }}</span>
                  <span v-else-if="betWithUser.bet.resolvedAt">{{ formatDate(betWithUser.bet.resolvedAt) }}</span>
                  <span v-else>{{ formatDate(betWithUser.bet.createdAt) }}</span>
                </div>
              </div>
            </div>
            <div class="bet-header-right">
              <div class="bet-header-right-content">
                <div v-if="getFinalScoreData(betWithUser.bet)" class="final-score-inline">
                  <span class="final-score-text">
                    {{ getFinalScoreData(betWithUser.bet).homeTeam }} {{ getFinalScoreData(betWithUser.bet).homeScore }} - {{ getFinalScoreData(betWithUser.bet).awayScore }} {{ getFinalScoreData(betWithUser.bet).awayTeam }}
                    <span v-if="betWithUser.bet.betType === 'total'" class="total-badge">
                      ({{ getTotalPoints(getFinalScoreData(betWithUser.bet)) }})
                    </span>
                  </span>
                </div>
                <div class="bet-status" :class="getStatusClass(betWithUser.bet.status)">
                  {{ formatStatus(betWithUser.bet.status) }}
                </div>
              </div>
            </div>
          </div>

          <div class="bet-game">
            <h4>{{ betWithUser.bet.gameData.gameName }}</h4>
          </div>
          
          <div class="bet-details">
            <div class="bet-type-info">
              <span class="bet-type">{{ formatBetType(betWithUser.bet.betType) }}</span>
              <span class="bet-selection">{{ formatBetSelection(betWithUser.bet) }}</span>
            </div>
            <div class="bet-amounts">
              <div class="bet-amount">
                <span class="label">Wagered:</span>
                <span class="value">${{ betWithUser.bet.amount.toLocaleString() }}</span>
              </div>
              <div class="bet-amount">
                <span class="label">Potential Win:</span>
                <span class="value potential">${{ betWithUser.bet.potentialWin.toLocaleString() }}</span>
              </div>
            </div>
            <div class="bet-odds">
              <span class="label">Odds:</span>
              <span class="value">{{ betWithUser.bet.odds }}</span>
            </div>
          </div>

          <!-- Live Game Data for active bets -->
          <div v-if="isGameLive(betWithUser.bet)" class="live-game-data">
            <div class="live-score">
              <span class="team-score">{{ getLiveData(betWithUser.bet).homeTeam }} {{ getLiveData(betWithUser.bet).homeScore }}</span>
              <span class="score-separator">-</span>
              <span class="team-score">{{ getLiveData(betWithUser.bet).awayScore }} {{ getLiveData(betWithUser.bet).awayTeam }}</span>
            </div>
            <div class="live-status">
              <span class="live-indicator">● LIVE</span>
              <span class="game-time">{{ getLiveData(betWithUser.bet).status }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'
import liveScoreService from '../services/liveScoreService.js'

export default {
  name: 'FriendsBets',
  setup() {
    const userStore = useUserStore()
    const userLeagues = ref([])
    const selectedLeagueId = ref('')
    const friendsBets = ref([])
    const loading = ref(false)
    const error = ref('')
    const liveScores = ref(new Map())
    const refreshInterval = ref(null)

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

    const formatDate = (dateString) => {
      if (!dateString) return 'Unknown date'
      
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'Invalid date'
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const formatBetType = (betType) => {
      switch (betType) {
        case 'spread': return 'Point Spread'
        case 'moneyline': return 'Moneyline'
        case 'total': return 'Total Points'
        default: return betType
      }
    }

    const formatBetSelection = (bet) => {
      if (bet.betType === 'total' && bet.line) {
        let lineNumber
        if (typeof bet.line === 'string') {
          lineNumber = bet.line.replace(/[ou]/i, '')
        } else if (typeof bet.line === 'number') {
          lineNumber = bet.line.toString()
        } else {
          return bet.selection
        }
        return `${bet.selection} (${lineNumber})`
      }
      
      if (bet.betType === 'spread' && bet.line) {
        const lineNumber = Math.abs(parseFloat(bet.line))
        const sign = parseFloat(bet.line) > 0 ? '+' : ''
        return `${bet.selection} (${sign}${lineNumber})`
      }
      
      return bet.selection
    }

    const formatStatus = (status) => {
      if (!status) return 'Pending'
      return status.charAt(0).toUpperCase() + status.slice(1)
    }

    const getStatusClass = (status) => {
      if (!status) return 'pending'
      return status.toLowerCase()
    }

    const getInitials = (username) => {
      if (!username) return '?'
      return username.charAt(0).toUpperCase()
    }

    // Check if a game is live
    const isGameLive = (bet) => {
      const liveData = liveScores.value.get(bet.gameId)
      return liveData && liveData.isLive && !liveData.isCompleted
    }

    // Get live data for a bet
    const getLiveData = (bet) => {
      return liveScores.value.get(bet.gameId)
    }

    // Get final score data for completed bets
    const getFinalScoreData = (bet) => {
      // Only show final score for completed bets (won/lost)
      if (bet.status !== 'won' && bet.status !== 'lost') return null
      
      const liveData = liveScores.value.get(bet.gameId)
      if (!liveData) return null
      
      // Don't show final score if game is still live (shouldn't happen for completed bets, but safety check)
      if (liveData.isLive && !liveData.isCompleted) return null
      
      // Return score data for completed bets
      return liveData
    }

    // Calculate total points from score data
    const getTotalPoints = (scoreData) => {
      if (!scoreData) return null
      const homeScore = parseInt(scoreData.homeScore) || 0
      const awayScore = parseInt(scoreData.awayScore) || 0
      return homeScore + awayScore
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
      friendsBets,
      loading,
      error,
      fetchFriendsBets,
      formatDate,
      formatBetType,
      formatBetSelection,
      formatStatus,
      getStatusClass,
      getInitials,
      isGameLive,
      getLiveData,
      getFinalScoreData,
      getTotalPoints
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
  max-width: 400px;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.league-selector:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
  margin: 0 0 1rem 0;
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
}
</style>
