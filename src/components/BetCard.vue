<template>
  <div 
    class="bet-card"
    :class="bet.status === 'pending' ? 'active' : bet.status"
  >
    <!-- Username for friends' bets (simple label at top) -->
    <div v-if="user" class="bet-username">
      {{ user.username }}
    </div>
    
    <div class="bet-header">
      <div class="bet-game">
        <h4>{{ bet.gameData.gameName.replace(' at ', ' @ ') }}</h4>
        <span class="bet-date">Bet placed at {{ formatDate(bet.createdAt) }}</span>
        <span v-if="getGameStartTime(bet)" class="game-start-time">Game starts at {{ getGameStartTime(bet) }}</span>
      </div>
      <div class="bet-header-right">
        <div class="bet-header-right-content">
          <!-- Final score for completed bets -->
          <div v-if="getFinalScoreData(bet)" class="final-score-inline">
            <span class="final-score-text">
              {{ getFinalScoreData(bet).homeTeam }} {{ getFinalScoreData(bet).homeScore }} - {{ getFinalScoreData(bet).awayScore }} {{ getFinalScoreData(bet).awayTeam }}
              <span v-if="bet.betType === 'total'" class="total-badge">
                ({{ getTotalPoints(getFinalScoreData(bet)) }})
              </span>
              <span v-if="bet.betType === 'spread' && getSpreadDifference(bet) !== null" class="spread-badge">
                ({{ getSpreadDifference(bet) }})
              </span>
            </span>
          </div>
          <!-- Status badge -->
          <div class="bet-status" :class="getStatusClass(bet.status)">
            {{ formatStatus(bet.status) }}
          </div>
          <!-- Cancel button (only for personal active bets) -->
          <button 
            v-if="showCancelButton && canCancelBet(bet)"
            @click="$emit('cancel-bet', bet._id)" 
            :disabled="cancellingBetId === bet._id"
            class="cancel-bet-btn-header"
          >
            {{ cancellingBetId === bet._id ? 'Cancelling...' : 'Cancel' }}
          </button>
        </div>
      </div>
    </div>
    
    <div class="bet-details">
      <div class="bet-type-info">
        <span class="bet-type">{{ formatBetType(bet.betType) }}</span>
        <span class="bet-selection">{{ formatBetSelection(bet) }}</span>
      </div>
      <div class="bet-amounts">
        <div class="bet-amount">
          <span class="label">Wagered:</span>
          <span class="value">${{ bet.amount.toLocaleString() }}</span>
        </div>
        <div class="bet-amount">
          <span class="label">{{ getAmountLabel(bet.status) }}</span>
          <span class="value" :class="getAmountValueClass(bet.status)">
            {{ getAmountValue(bet.status) }}
          </span>
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
        <span class="team-score">{{ getLiveData(bet)?.homeTeam }} {{ getLiveData(bet)?.homeScore }}</span>
        <span class="score-separator">-</span>
        <span class="team-score">{{ getLiveData(bet)?.awayScore }} {{ getLiveData(bet)?.awayTeam }}</span>
      </div>
      <div class="live-status">
        <span class="live-indicator">● LIVE</span>
        <span class="game-time">{{ getLiveData(bet)?.status }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { formatRelativeTime } from '../utils/timezoneUtils.js'

export default {
  name: 'BetCard',
  props: {
    bet: {
      type: Object,
      required: true
    },
    user: {
      type: Object,
      default: null
    },
    liveScores: {
      type: Map,
      default: () => new Map()
    },
    showCancelButton: {
      type: Boolean,
      default: false
    },
    cancellingBetId: {
      type: String,
      default: null
    },
    canCancelBet: {
      type: Function,
      default: () => false
    }
  },
  emits: ['cancel-bet'],
  computed: {
    // Track Map size to force reactivity when Map changes
    liveScoresSize() {
      return this.liveScores ? this.liveScores.size : 0
    },
    // Convert Map to reactive object for Vue's reactivity system
    liveScoresReactive() {
      // Access size to track Map changes - this makes the computed reactive
      const size = this.liveScoresSize
      if (!this.liveScores) return {}
      const scores = {}
      this.liveScores.forEach((value, key) => {
        scores[key] = value
      })
      return scores
    }
  },
  methods: {
    formatDate(dateString) {
      if (!dateString) return 'Unknown date'
      
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'Invalid date'
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    formatBetType(betType) {
      switch (betType) {
        case 'spread': return 'Point Spread'
        case 'moneyline': return 'Moneyline'
        case 'total': return 'Total Points'
        default: return betType
      }
    },
    formatBetSelection(bet) {
      // For over/under bets, include the line amount
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
      
      // For spread bets, include the line amount
      if (bet.betType === 'spread' && bet.line) {
        const lineNumber = Math.abs(parseFloat(bet.line))
        const sign = parseFloat(bet.line) > 0 ? '+' : ''
        return `${bet.selection} (${sign}${lineNumber})`
      }
      
      // For moneyline and other bets, just return the selection
      return bet.selection
    },
    formatGameStartTime(timeString) {
      if (!timeString) return null
      
      // Use the existing timezone utility to format relative time
      if (timeString.includes('PM') || timeString.includes('AM')) {
        return formatRelativeTime(timeString)
      }
      
      return timeString
    },
    getGameStartTime(bet) {
      // Only show for pending bets
      if (bet.status !== 'pending') return null
      
      // Check if game has started using live scores
      const liveData = this.liveScores.get(bet.gameId) || this.liveScoresReactive[bet.gameId]
      if (liveData) {
        // If game has started or completed, don't show start time
        if (liveData.isLive || liveData.isCompleted) return null
        
        // If we have formatted start time, use it
        if (liveData.gameStartTimeFormatted) {
          return this.formatGameStartTime(liveData.gameStartTimeFormatted)
        }
        
        // Otherwise, format from ISO date
        if (liveData.gameStartTime) {
          const date = new Date(liveData.gameStartTime)
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          }
        }
      }
      
      // Fallback: Check stored gameData for start time (from when bet was placed)
      if (bet.gameData) {
        // Try formatted time first
        if (bet.gameData.gameStartTimeFormatted) {
          return this.formatGameStartTime(bet.gameData.gameStartTimeFormatted)
        }
        
        // Otherwise, format from ISO date
        if (bet.gameData.gameStartTime) {
          const date = new Date(bet.gameData.gameStartTime)
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZoneName: 'short'
            })
          }
        }
      }
      
      // If no data available, return null
      return null
    },
    getFinalScoreData(bet) {
      // Only show final score for completed bets (won/lost)
      if (bet.status !== 'won' && bet.status !== 'lost') return null
      
      // First, check if bet has actualResult (from backend)
      if (bet.actualResult) {
        // Normalize actualResult to match expected format
        const homeScore = typeof bet.actualResult.homeScore === 'object' 
          ? parseInt(bet.actualResult.homeScore.$numberInt || bet.actualResult.homeScore) 
          : parseInt(bet.actualResult.homeScore) || 0
        
        const awayScore = typeof bet.actualResult.awayScore === 'object'
          ? parseInt(bet.actualResult.awayScore.$numberInt || bet.actualResult.awayScore)
          : parseInt(bet.actualResult.awayScore) || 0
        
        return {
          homeTeam: bet.actualResult.homeTeam,
          awayTeam: bet.actualResult.awayTeam,
          homeScore: homeScore,
          awayScore: awayScore,
          isCompleted: true,
          isLive: false,
          status: bet.actualResult.gameStatus || 'Final'
        }
      }
      
      // Fallback to live scores if available
      const liveData = this.liveScores.get(bet.gameId)
      if (!liveData) return null
      
      // Don't show final score if game is still live (shouldn't happen for completed bets, but safety check)
      if (liveData.isLive && !liveData.isCompleted) return null
      
      // Return score data for completed bets
      return liveData
    },
    getTotalPoints(scoreData) {
      if (!scoreData) return null
      const homeScore = parseInt(scoreData.homeScore) || 0
      const awayScore = parseInt(scoreData.awayScore) || 0
      return homeScore + awayScore
    },
    getSpreadDifference(bet) {
      // Only show for completed bets (won/lost)
      if (bet.status !== 'won' && bet.status !== 'lost') return null
      
      const scoreData = this.getFinalScoreData(bet)
      if (!scoreData) return null
      
      const homeScore = parseInt(scoreData.homeScore) || 0
      const awayScore = parseInt(scoreData.awayScore) || 0
      
      // Return the simple difference (absolute value of home score - away score)
      return Math.abs(homeScore - awayScore)
    },
    formatStatus(status) {
      if (!status) return 'Pending'
      if (status === 'pending') return 'Pending'
      return status.charAt(0).toUpperCase() + status.slice(1)
    },
    getStatusClass(status) {
      if (!status) return 'pending'
      return status.toLowerCase()
    },
    // Check if game is live - using method with computed dependency
    isGameLive(bet) {
      if (!bet || !bet.gameId) return false
      // Access computed to ensure reactivity
      const scores = this.liveScoresReactive
      const liveData = scores[bet.gameId] || this.liveScores.get(bet.gameId)
      if (!liveData) return false
      const isLive = liveData.isLive && !liveData.isCompleted
      return isLive
    },
    // Get live data - using method with computed dependency
    getLiveData(bet) {
      if (!bet || !bet.gameId) return null
      // Access computed to ensure reactivity
      const scores = this.liveScoresReactive
      return scores[bet.gameId] || this.liveScores.get(bet.gameId)
    },
    getAmountLabel(status) {
      if (status === 'won') return 'Won:'
      if (status === 'lost') return 'Lost:'
      return 'Potential Win:'
    },
    getAmountValue(status) {
      if (status === 'won') {
        return `+$${this.bet.potentialWin.toLocaleString()}`
      }
      if (status === 'lost') {
        return `-$${this.bet.amount.toLocaleString()}`
      }
      return `$${this.bet.potentialWin.toLocaleString()}`
    },
    getAmountValueClass(status) {
      if (status === 'won') return 'won'
      if (status === 'lost') return 'lost'
      return 'potential'
    }
  }
}
</script>

<style scoped>
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

.bet-username {
  font-weight: 600;
  color: #3b82f6;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  text-transform: capitalize;
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

@media (max-width: 768px) {
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
</style>
