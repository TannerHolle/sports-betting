<template>
  <div class="leaderboard" v-if="isAuthenticated">
    <div class="leaderboard-header">
      <h3>🏆 Leaderboard</h3>
      <p class="leaderboard-description">
        Top performers by total winnings
      </p>
    </div>

    <div class="leaderboard-content" v-if="!loading && leaderboard.length > 0">
      <div 
        v-for="(user, index) in leaderboard" 
        :key="user.username"
        class="leaderboard-item"
        :class="{ 'current-user': user.username === currentUser?.username }"
      >
        <div class="rank">
          <span class="rank-number">{{ index + 1 }}</span>
          <span class="rank-medal" v-if="index < 3">{{ getMedal(index) }}</span>
        </div>
        
        <div class="user-info">
          <div class="username">{{ user.username }}</div>
          <div class="user-stats">
            <span class="stat">${{ user.totalCash.toLocaleString() }} total cash</span>
            <span class="stat">${{ user.totalWon.toLocaleString() }} won</span>
            <span class="stat">${{ user.totalLost.toLocaleString() }} lost</span>
            <span class="stat">{{ user.winRate }}% win rate</span>
            <span class="stat">{{ user.totalBets }} bets</span>
          </div>
        </div>
        
        <div class="user-amount">
          <span class="amount" :class="{ 'positive': user.netProfit > 0, 'negative': user.netProfit < 0 }">
            {{ user.netProfit >= 0 ? '+' : '' }}${{ user.netProfit.toLocaleString() }}
          </span>
        </div>
      </div>
    </div>

    <div v-else-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading leaderboard...</p>
    </div>

    <div v-else class="empty-state">
      <p>No data available yet</p>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'

export default {
  name: 'Leaderboard',
  setup() {
    const userStore = useUserStore()
    const leaderboard = ref([])
    const loading = ref(false)

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    const currentUser = computed(() => userStore.currentUser.value)

    const getMedal = (index) => {
      const medals = ['🥇', '🥈', '🥉']
      return medals[index] || ''
    }

    const fetchLeaderboard = async () => {
      loading.value = true
      try {
        const response = await axios.get(`${API_BASE_URL}/users`)
        const users = response.data

        // Calculate leaderboard data
        const leaderboardData = Object.values(users)
          .map(user => {
            const totalWon = user.totalWon || 0
            const totalLost = user.totalLost || 0
            const netProfit = totalWon - totalLost  // Net profit/loss
            const balance = user.balance || 0
            const totalBets = user.bets?.length || 0
            const completedBets = user.bets?.filter(bet => bet.status === 'won' || bet.status === 'lost') || []
            const wonBets = completedBets.filter(bet => bet.status === 'won').length
            const winRate = completedBets.length > 0 ? Math.round((wonBets / completedBets.length) * 100) : 0
            
            // Calculate outstanding bets (pending bets)
            const outstandingBets = user.bets?.filter(bet => bet.status === 'pending') || []
            const outstandingAmount = outstandingBets.reduce((sum, bet) => sum + (bet.amount || 0), 0)
            const totalCash = balance + outstandingAmount  // Available cash + outstanding bets

            return {
              username: user.username,
              balance,
              outstandingAmount,
              totalCash,
              netProfit,
              totalWon,
              totalLost,
              winRate,
              totalBets,
              completedBets: completedBets.length
            }
          })
          .filter(user => user.completedBets > 0) // Only show users with completed bets
          .sort((a, b) => b.netProfit - a.netProfit) // Sort by net profit
          .slice(0, 5) // Top 5

        leaderboard.value = leaderboardData
      } catch (error) {
        console.error('Error fetching leaderboard:', error)
      } finally {
        loading.value = false
      }
    }

    onMounted(() => {
      fetchLeaderboard()
    })

    return {
      isAuthenticated,
      currentUser,
      leaderboard,
      loading,
      getMedal
    }
  }
}
</script>

<style scoped>
.leaderboard {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  margin-bottom: 2rem;
}

.leaderboard-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
}

.leaderboard-header h3 {
  margin: 0 0 0.5rem 0;
  color: #1a1a1a;
  font-size: 1.5rem;
  font-weight: 700;
}

.leaderboard-description {
  margin: 0;
  color: #6b7280;
  font-size: 1rem;
}

.leaderboard-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.leaderboard-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.leaderboard-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.leaderboard-item.current-user {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.rank {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-right: 1rem;
  min-width: 60px;
}

.rank-number {
  font-size: 1.5rem;
  font-weight: 700;
  color: #374151;
  width: 30px;
  text-align: center;
}

.rank-medal {
  font-size: 1.2rem;
}

.user-info {
  flex: 1;
  margin-right: 1rem;
}

.username {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 0.25rem;
}

.user-stats {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.stat {
  font-size: 0.875rem;
  color: #6b7280;
  background: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
}

.user-amount {
  text-align: right;
}

.amount {
  font-size: 1.25rem;
  font-weight: 700;
  color: #059669;
}

.amount.positive {
  color: #27ae60;
}

.amount.negative {
  color: #e74c3c;
}

.loading-state {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

@media (max-width: 768px) {
  .leaderboard {
    padding: 1.5rem;
  }
  
  .leaderboard-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  
  .rank {
    margin-right: 0;
    margin-bottom: 0.5rem;
  }
  
  .user-info {
    margin-right: 0;
    margin-bottom: 0.5rem;
  }
  
  .user-amount {
    text-align: left;
  }
  
  .user-stats {
    gap: 0.5rem;
  }
}
</style>
