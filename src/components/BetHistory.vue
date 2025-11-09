<template>
  <div class="bet-history" v-if="isAuthenticated">
    <div class="bet-history-header">
      <h3>Your Bets</h3>
      <div class="bet-tabs">
        <button 
          @click="switchTab('active')" 
          :class="{ active: activeTab === 'active' }"
          class="tab-btn"
        >
          Active ({{ activeBets.length }})
        </button>
        <button 
          @click="switchTab('history')" 
          :class="{ active: activeTab === 'history' }"
          class="tab-btn"
        >
          History ({{ completedBets.length }})
        </button>
      </div>
    </div>

    <!-- Active Bets -->
    <div v-if="activeTab === 'active'" class="bets-section">
      <div v-if="activeBets.length === 0" class="no-bets">
        <p>No active bets. <br></br>Place a bet and track it here!</p>
      </div>
      <div v-else class="bets-list">
        <BetCard
          v-for="(bet, index) in activeBets" 
          :key="`active-bet-${bet._id}-${index}`"
          :bet="bet"
          :live-scores="liveScores"
          :show-cancel-button="true"
          :cancelling-bet-id="cancellingBetId"
          :can-cancel-bet="canCancelBet"
          @cancel-bet="handleCancelBet"
        />
      </div>
    </div>

    <!-- Bet History -->
    <div v-if="activeTab === 'history'" class="bets-section">
      <div v-if="completedBets.length === 0" class="no-bets">
        <p>No completed bets yet.</p>
      </div>
      <div v-else>
        <div class="bets-list">
          <BetCard
            v-for="(bet, index) in paginatedCompletedBets" 
            :key="`bet-${bet._id}-${index}`"
            :bet="bet"
            :live-scores="liveScores"
            :show-cancel-button="false"
          />
        </div>
        <!-- Pagination Controls -->
        <div v-if="totalPages > 1 || completedBets.length > 0" class="pagination">
          <div class="pagination-left">
            <label class="page-size-label">Items per page:</label>
            <select v-model="itemsPerPage" @change="handlePageSizeChange" class="page-size-select">
              <option :value="5">5</option>
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
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

    <!-- Cancel Bet Confirmation Modal -->
    <div v-if="showCancelModal" class="modal-overlay" @click.self="closeCancelModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Cancel Bet?</h3>
          <button @click="closeCancelModal" class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to cancel this bet?</p>
          <p class="modal-info"><strong>${{ cancelBetAmount?.toLocaleString() }}</strong> will be refunded to your balance.</p>
        </div>
        <div class="modal-footer">
          <button @click="closeCancelModal" class="modal-btn modal-btn-cancel">Keep Bet</button>
          <button @click="confirmCancelBet" :disabled="cancellingBetId" class="modal-btn modal-btn-confirm">
            {{ cancellingBetId ? 'Cancelling...' : 'Cancel Bet' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import liveScoreService from '../services/liveScoreService.js'
import BetCard from './BetCard.vue'

export default {
  name: 'BetHistory',
  components: {
    BetCard
  },
  setup() {
    const userStore = useUserStore()
    const activeTab = ref('active')
    const liveScores = ref(new Map())
    const refreshInterval = ref(null)
    const cancellingBetId = ref(null)
    const gameStartStatus = ref(new Map()) // Cache game start status
    const showCancelModal = ref(false)
    const pendingCancelBetId = ref(null)
    const cancelBetAmount = ref(null)
    const currentPage = ref(1)
    const itemsPerPage = ref(10)

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    const currentUser = computed(() => userStore.currentUser.value)

    const activeBets = computed(() => {
      if (!currentUser.value?.bets) return []
      return currentUser.value.bets.filter(bet => bet.status === 'pending')
    })

    const completedBets = computed(() => {
      if (!currentUser.value?.bets) return []
      return currentUser.value.bets
        .filter(bet => bet.status === 'won' || bet.status === 'lost')
        .sort((a, b) => new Date(b.resolvedAt || b.createdAt) - new Date(a.resolvedAt || a.createdAt))
    })

    const totalPages = computed(() => {
      return Math.ceil(completedBets.value.length / itemsPerPage.value)
    })

    const paginatedCompletedBets = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value
      const end = start + itemsPerPage.value
      return completedBets.value.slice(start, end)
    })

    // Get all bets (active + completed) for live score checking
    const allBets = computed(() => {
      if (!currentUser.value?.bets) return []
      return currentUser.value.bets
    })


    // Check if bet can be cancelled (pending and game hasn't started)
    const canCancelBet = (bet) => {
      if (bet.status !== 'pending') return false
      
      // Check if game has started using live scores
      const liveData = liveScores.value.get(bet.gameId)
      if (liveData) {
        // If we have live data, check if game has started
        return !liveData.isLive && !liveData.isCompleted
      }
      
      // If we don't have live data yet, we'll check async
      // For now, return true and we'll validate on the backend
      return true
    }

    // Handle cancel bet - show modal
    const handleCancelBet = (betId) => {
      if (cancellingBetId.value) return // Prevent double clicks
      
      const bet = activeBets.value.find(b => b._id === betId)
      if (!bet) return
      
      pendingCancelBetId.value = betId
      cancelBetAmount.value = bet.amount
      showCancelModal.value = true
    }

    // Close cancel modal
    const closeCancelModal = () => {
      if (cancellingBetId.value) return // Don't close if cancelling
      showCancelModal.value = false
      pendingCancelBetId.value = null
      cancelBetAmount.value = null
    }

    // Confirm cancel bet
    const confirmCancelBet = async () => {
      if (!pendingCancelBetId.value) return
      
      const betId = pendingCancelBetId.value
      cancellingBetId.value = betId
      
      try {
        const result = await userStore.cancelBet(betId)
        
        if (result.success) {
          // Success - user data will be refreshed automatically
          // Clear game start status cache for this game
          const bet = activeBets.value.find(b => b._id === betId)
          if (bet) {
            gameStartStatus.value.delete(bet.gameId)
          }
          // Close modal
          showCancelModal.value = false
          pendingCancelBetId.value = null
          cancelBetAmount.value = null
        } else {
          alert(result.error || 'Failed to cancel bet')
        }
      } catch (error) {
        console.error('Error cancelling bet:', error)
        alert('Failed to cancel bet. Please try again.')
      } finally {
        cancellingBetId.value = null
      }
    }

    // Get sport from bet data (now stored with each bet)
    const getSportFromBet = (bet) => {
      // Use stored sport if available, fallback to team name detection for old bets
      if (bet.sport) {
        return bet.sport
      }
      
      // Fallback for old bets without sport data
      const homeTeam = bet.gameData?.homeTeam?.toLowerCase() || ''
      const awayTeam = bet.gameData?.awayTeam?.toLowerCase() || ''
      
      // NFL teams
      const nflTeams = ['commanders', 'chiefs', 'cowboys', 'giants', 'eagles', 'washington', 'kansas city', 'dallas', 'new york', 'philadelphia', 'patriots', 'bills', 'dolphins', 'jets', 'ravens', 'bengals', 'browns', 'steelers', 'texans', 'colts', 'jaguars', 'titans', 'broncos', 'raiders', 'chargers', 'cardinals', 'rams', '49ers', 'seahawks', 'packers', 'bears', 'lions', 'vikings', 'falcons', 'panthers', 'saints', 'buccaneers']
      if (nflTeams.some(team => homeTeam.includes(team) || awayTeam.includes(team))) {
        return 'nfl'
      }
      
      // NBA teams
      const nbaTeams = ['lakers', 'kings', 'clippers', 'trail blazers', 'cavaliers', 'pistons', '76ers', 'magic', 'bulls', 'hawks', 'timberwolves', 'nuggets', 'warriors', 'celtics', 'heat', 'knicks', 'nets', 'raptors', 'bucks', 'pacers', 'hornets', 'wizards', 'thunder', 'mavericks', 'rockets', 'grizzlies', 'pelicans', 'spurs', 'suns', 'jazz', 'blazers']
      if (nbaTeams.some(team => homeTeam.includes(team) || awayTeam.includes(team))) {
        return 'nba'
      }
      
      // NCAA Basketball teams
      const ncaaBasketballTeams = ['duke', 'kentucky', 'north carolina', 'kansas', 'villanova', 'gonzaga', 'michigan state', 'michigan', 'ohio state', 'indiana', 'purdue', 'wisconsin', 'maryland', 'illinois', 'iowa', 'minnesota', 'nebraska', 'northwestern', 'rutgers', 'penn state', 'ucla', 'usc', 'stanford', 'california', 'arizona', 'arizona state', 'oregon', 'oregon state', 'washington', 'washington state', 'colorado', 'utah', 'texas', 'texas tech', 'baylor', 'tcu', 'oklahoma', 'oklahoma state', 'kansas state', 'iowa state', 'west virginia', 'syracuse', 'louisville', 'notre dame', 'pittsburgh', 'boston college', 'clemson', 'florida state', 'miami', 'north carolina state', 'wake forest', 'georgia tech', 'virginia', 'virginia tech', 'florida', 'georgia', 'south carolina', 'tennessee', 'vanderbilt', 'auburn', 'alabama', 'mississippi state', 'ole miss', 'lsu', 'arkansas', 'missouri', 'texas a&m']
      if (ncaaBasketballTeams.some(team => homeTeam.includes(team) || awayTeam.includes(team))) {
        return 'ncaa-basketball'
      }
      
      // NCAA Football teams
      const ncaaFootballTeams = ['alabama', 'auburn', 'georgia', 'florida', 'tennessee', 'lsu', 'texas a&m', 'ole miss', 'mississippi state', 'arkansas', 'missouri', 'kentucky', 'vanderbilt', 'south carolina', 'ohio state', 'michigan', 'penn state', 'michigan state', 'wisconsin', 'iowa', 'minnesota', 'nebraska', 'northwestern', 'illinois', 'purdue', 'indiana', 'maryland', 'rutgers', 'oklahoma', 'texas', 'oklahoma state', 'texas tech', 'baylor', 'tcu', 'kansas state', 'iowa state', 'west virginia', 'kansas', 'clemson', 'florida state', 'miami', 'north carolina', 'north carolina state', 'duke', 'wake forest', 'georgia tech', 'virginia', 'virginia tech', 'boston college', 'pittsburgh', 'syracuse', 'louisville', 'notre dame', 'usc', 'ucla', 'stanford', 'california', 'washington', 'washington state', 'oregon', 'oregon state', 'arizona', 'arizona state', 'colorado', 'utah', 'byu', 'boise state', 'fresno state', 'san diego state', 'utah state', 'hawaii', 'nevada', 'unlv', 'new mexico', 'new mexico state', 'wyoming', 'air force', 'colorado state', 'troy', 'appalachian state', 'coastal carolina', 'georgia southern', 'georgia state', 'marshall', 'old dominion', 'james madison', 'liberty', 'florida atlantic', 'florida international', 'charlotte', 'middle tennessee', 'western kentucky', 'louisiana', 'louisiana monroe', 'south alabama', 'texas state', 'arkansas state', 'ulm', 'tulane', 'southern miss', 'rice', 'north texas', 'utep', 'utsa', 'houston', 'smu', 'tulsa', 'memphis', 'east carolina', 'temple', 'south florida', 'ucf', 'cincinnati', 'navy', 'army', 'air force']
      if (ncaaFootballTeams.some(team => homeTeam.includes(team) || awayTeam.includes(team))) {
        return 'ncaa-football'
      }
      
      // Default to NBA if we can't determine
      return 'nba'
    }

    // Fetch live scores for all bets
    const fetchLiveScores = async () => {
      if (!allBets.value.length) return

      try {
        // Group bets by sport
        const betsBySport = {}
        allBets.value.forEach(bet => {
          const sport = getSportFromBet(bet)
          if (!betsBySport[sport]) {
            betsBySport[sport] = []
          }
          betsBySport[sport].push(bet)
        })

        // Fetch live scores for each sport
        const allScores = new Map()
        for (const [sport, bets] of Object.entries(betsBySport)) {
          const gameIds = [...new Set(bets.map(bet => bet.gameId))]
          if (gameIds.length > 0) {
            try {
              const scores = await liveScoreService.getLiveScores(gameIds, sport)
              // Merge scores into the main map
              scores.forEach((data, gameId) => {
                allScores.set(gameId, data)
                // Update game start status cache
                if (data) {
                  gameStartStatus.value.set(gameId, data.isLive || data.isCompleted)
                }
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
      // Initial fetch
      fetchLiveScores()
      
      // Set up interval to refresh every 10 seconds
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
        // Scroll to top of bet history section
        const betHistoryElement = document.querySelector('.bet-history')
        if (betHistoryElement) {
          betHistoryElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }

    const switchTab = (tab) => {
      activeTab.value = tab
      // Reset to page 1 when switching tabs
      currentPage.value = 1
    }

    const handlePageSizeChange = () => {
      // Reset to page 1 when page size changes
      currentPage.value = 1
      // Scroll to the component container so "Your Bets" title and tabs are visible
      const betHistoryElement = document.querySelector('.bet-history')
      if (betHistoryElement) {
        betHistoryElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }

    // Load user data when component mounts
    onMounted(async () => {
      if (isAuthenticated.value && currentUser.value?.username) {
        try {
          // Refresh user data from API to get latest bets
          const freshUserData = await userStore.loadUserFromAPI(currentUser.value.username)
          if (freshUserData) {
            // Start live score refresh after user data is loaded
            startLiveScoreRefresh()
          }
        } catch (error) {
          console.error('Error loading user data in BetHistory:', error)
        }
      }
    })

    // Clean up on unmount
    onUnmounted(() => {
      stopLiveScoreRefresh()
    })

    return {
      activeTab,
      isAuthenticated,
      activeBets,
      completedBets,
      paginatedCompletedBets,
      totalPages,
      currentPage,
      liveScores,
      canCancelBet,
      handleCancelBet,
      cancellingBetId,
      showCancelModal,
      closeCancelModal,
      confirmCancelBet,
      cancelBetAmount,
      goToPage,
      switchTab,
      handlePageSizeChange,
      itemsPerPage
    }
  }
}
</script>

<style scoped>
.bet-history {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  margin-bottom: 2rem;
}

.bet-history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
}

.bet-history-header h3 {
  margin: 0;
  color: #1a1a1a;
  font-size: 1.5rem;
  font-weight: 700;
}

.bet-tabs {
  display: flex;
  gap: 0.5rem;
}

.tab-btn {
  padding: 0.75rem 1.5rem;
  border: 2px solid #e5e7eb;
  background: white;
  border-radius: 8px;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tab-btn.active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #2563eb;
}

.tab-btn:hover:not(.active) {
  border-color: #9ca3af;
  color: #374151;
}

.bets-section {
  min-height: 200px;
}

.no-bets {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
}

.no-bets p {
  font-size: 1.1rem;
  margin: 0;
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

.bet-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.3s ease;
}

.bet-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.bet-card.active {
  border-left: 4px solid #f59e0b;
  background: #fffbeb;
}

.bet-card.won {
  border-left: 4px solid #059669;
  background: #ecfdf5;
}

.bet-card.lost {
  border-left: 4px solid #dc2626;
  background: #fef2f2;
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

.bet-game h4 {
  margin: 0 0 0.25rem 0;
  color: #1a1a1a;
  font-size: 1.1rem;
  font-weight: 600;
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

.bet-amount .value.won {
  color: #059669;
}

.bet-amount .value.lost {
  color: #dc2626;
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

@media (max-width: 768px) {
  .bet-history {
    padding: 1.5rem;
  }
  
  .bet-history-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .bet-tabs {
    justify-content: center;
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

/* Cancel Button in Header */
.cancel-bet-btn-header {
  padding: 0.25rem 0.75rem;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.cancel-bet-btn-header:hover:not(:disabled) {
  background: #b91c1c;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
}

.cancel-bet-btn-header:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  opacity: 0.7;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 450px;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  color: #1a1a1a;
  font-size: 1.25rem;
  font-weight: 700;
}

.modal-close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.modal-close-btn:hover {
  background: #f3f4f6;
  color: #1a1a1a;
}

.modal-body {
  padding: 1.5rem;
}

.modal-body p {
  margin: 0 0 0.75rem 0;
  color: #374151;
  font-size: 1rem;
  line-height: 1.5;
}

.modal-body p:last-of-type {
  margin-bottom: 0;
}

.modal-info {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 8px;
  border-left: 3px solid #f59e0b;
  margin-top: 1rem;
}

.modal-info strong {
  color: #1a1a1a;
  font-weight: 700;
}

.modal-footer {
  display: flex;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  justify-content: flex-end;
}

.modal-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 100px;
}

.modal-btn-cancel {
  background: #f3f4f6;
  color: #374151;
}

.modal-btn-cancel:hover {
  background: #e5e7eb;
}

.modal-btn-confirm {
  background: #dc2626;
  color: white;
}

.modal-btn-confirm:hover:not(:disabled) {
  background: #b91c1c;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

.modal-btn-confirm:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  opacity: 0.7;
}

@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    margin: 1rem;
  }
  
  .modal-footer {
    flex-direction: column-reverse;
  }
  
  .modal-btn {
    width: 100%;
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
