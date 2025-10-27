<template>
  <div class="bet-history" v-if="isAuthenticated">
    <div class="bet-history-header">
      <h3>Your Bets</h3>
      <div class="bet-tabs">
        <button 
          @click="activeTab = 'active'" 
          :class="{ active: activeTab === 'active' }"
          class="tab-btn"
        >
          Active ({{ activeBets.length }})
        </button>
        <button 
          @click="activeTab = 'history'" 
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
        <p>No active bets. Place your first bet on a game above!</p>
      </div>
      <div v-else class="bets-list">
        <div 
          v-for="bet in activeBets" 
          :key="bet.id"
          class="bet-card active"
        >
          <div class="bet-header">
            <div class="bet-game">
              <h4>{{ bet.gameData.gameName }}</h4>
              <span class="bet-date">{{ formatDate(bet.placedAt) }}</span>
            </div>
            <div class="bet-status pending">Pending</div>
          </div>
          
          <div class="bet-details">
            <div class="bet-type-info">
              <span class="bet-type">{{ formatBetType(bet.betType) }}</span>
              <span class="bet-selection">{{ bet.selection }}</span>
            </div>
            <div class="bet-amounts">
              <div class="bet-amount">
                <span class="label">Wagered:</span>
                <span class="value">${{ bet.amount.toLocaleString() }}</span>
              </div>
              <div class="bet-amount">
                <span class="label">Potential Win:</span>
                <span class="value potential">${{ bet.potentialWin.toLocaleString() }}</span>
              </div>
            </div>
            <div class="bet-odds">
              <span class="label">Odds:</span>
              <span class="value">{{ bet.odds }}</span>
            </div>
          </div>
          
          <!-- Live Game Data -->
          <div v-if="isGameLive(bet)" class="live-game-data">
            <div class="live-score">
              <span class="team-score">{{ getLiveData(bet).homeTeam }} {{ getLiveData(bet).homeScore }}</span>
              <span class="score-separator">-</span>
              <span class="team-score">{{ getLiveData(bet).awayScore }} {{ getLiveData(bet).awayTeam }}</span>
            </div>
            <div class="live-status">
              <span class="live-indicator">● LIVE</span>
              <span class="game-time">{{ getLiveData(bet).status }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bet History -->
    <div v-if="activeTab === 'history'" class="bets-section">
      <div v-if="completedBets.length === 0" class="no-bets">
        <p>No completed bets yet.</p>
      </div>
      <div v-else class="bets-list">
        <div 
          v-for="bet in completedBets" 
          :key="bet.id"
          class="bet-card"
          :class="bet.status"
        >
          <div class="bet-header">
            <div class="bet-game">
              <h4>{{ bet.gameData.gameName }}</h4>
              <span class="bet-date">{{ formatDate(bet.placedAt) }}</span>
            </div>
            <div class="bet-status" :class="bet.status">
              {{ bet.status === 'won' ? 'Won' : 'Lost' }}
            </div>
          </div>
          
          <div class="bet-details">
            <div class="bet-type-info">
              <span class="bet-type">{{ formatBetType(bet.betType) }}</span>
              <span class="bet-selection">{{ bet.selection }}</span>
            </div>
            <div class="bet-amounts">
              <div class="bet-amount">
                <span class="label">Wagered:</span>
                <span class="value">${{ bet.amount.toLocaleString() }}</span>
              </div>
              <div class="bet-amount">
                <span class="label">{{ bet.status === 'won' ? 'Won:' : 'Lost:' }}</span>
                <span class="value" :class="{ 'won': bet.status === 'won', 'lost': bet.status === 'lost' }">
                  {{ bet.status === 'won' ? '+' : '-' }}${{ bet.status === 'won' ? bet.potentialWin.toLocaleString() : bet.amount.toLocaleString() }}
                </span>
              </div>
            </div>
            <div class="bet-odds">
              <span class="label">Odds:</span>
              <span class="value">{{ bet.odds }}</span>
            </div>
          </div>
          
          <!-- Live Game Data for completed bets -->
          <div v-if="isGameLive(bet)" class="live-game-data">
            <div class="live-score">
              <span class="team-score">{{ getLiveData(bet).homeTeam }} {{ getLiveData(bet).homeScore }}</span>
              <span class="score-separator">-</span>
              <span class="team-score">{{ getLiveData(bet).awayScore }} {{ getLiveData(bet).awayTeam }}</span>
            </div>
            <div class="live-status">
              <span class="live-indicator">● LIVE</span>
              <span class="game-time">{{ getLiveData(bet).status }}</span>
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
import liveScoreService from '../services/liveScoreService.js'

export default {
  name: 'BetHistory',
  setup() {
    const userStore = useUserStore()
    const activeTab = ref('active')
    const liveScores = ref(new Map())
    const refreshInterval = ref(null)

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
        .sort((a, b) => new Date(b.resolvedAt || b.placedAt) - new Date(a.resolvedAt || a.placedAt))
    })

    // Get all bets (active + completed) for live score checking
    const allBets = computed(() => {
      if (!currentUser.value?.bets) return []
      return currentUser.value.bets
    })

    const formatDate = (dateString) => {
      const date = new Date(dateString)
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

    // Check if a game is live
    const isGameLive = (bet) => {
      const liveData = liveScores.value.get(bet.gameId)
      return liveData && liveData.isLive && !liveData.isCompleted
    }

    // Get live data for a bet
    const getLiveData = (bet) => {
      return liveScores.value.get(bet.gameId)
    }

    // Fetch live scores for all bets
    const fetchLiveScores = async () => {
      if (!allBets.value.length) return

      try {
        // Get unique game IDs
        const gameIds = [...new Set(allBets.value.map(bet => bet.gameId))]
        
        // Determine sport (default to NBA for now, could be enhanced)
        const sport = 'nba'
        
        const scores = await liveScoreService.getLiveScores(gameIds, sport)
        liveScores.value = scores
      } catch (error) {
        console.error('Error fetching live scores:', error)
      }
    }

    // Start periodic refresh for live scores
    const startLiveScoreRefresh = () => {
      // Initial fetch
      fetchLiveScores()
      
      // Set up interval to refresh every 30 seconds
      refreshInterval.value = setInterval(fetchLiveScores, 30000)
    }

    // Stop live score refresh
    const stopLiveScoreRefresh = () => {
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value)
        refreshInterval.value = null
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
      formatDate,
      formatBetType,
      isGameLive,
      getLiveData
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
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

.bet-game h4 {
  margin: 0 0 0.25rem 0;
  color: #1a1a1a;
  font-size: 1.1rem;
  font-weight: 600;
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
  justify-content: space-between;
  align-items: center;
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
  justify-content: space-between;
  align-items: center;
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
</style>
