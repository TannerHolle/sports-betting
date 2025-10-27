<template>
  <div class="bet-resolver" v-if="isAuthenticated && activeBets.length > 0">
    <div class="resolver-header">
      <h3>Resolve Bets</h3>
      <p class="resolver-description">
        Manually resolve your active bets based on game results. This is for demonstration purposes.
      </p>
    </div>

    <div class="bets-to-resolve">
      <div 
        v-for="bet in activeBets" 
        :key="bet.id"
        class="bet-to-resolve"
      >
        <div class="bet-info">
          <h4>{{ bet.gameData.gameName }}</h4>
          <div class="bet-details">
            <span class="bet-type">{{ formatBetType(bet.betType) }}</span>
            <span class="bet-selection">{{ bet.selection }}</span>
            <span class="bet-amount">${{ bet.amount.toLocaleString() }}</span>
          </div>
        </div>
        
        <div class="resolution-controls">
          <button 
            @click="resolveBet(bet.id, 'won')"
            class="resolve-btn won"
          >
            Won
          </button>
          <button 
            @click="resolveBet(bet.id, 'lost')"
            class="resolve-btn lost"
          >
            Lost
          </button>
        </div>
      </div>
    </div>

    <div v-if="resolutionMessage" class="resolution-message" :class="resolutionMessage.type">
      {{ resolutionMessage.text }}
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { useUserStore } from '../stores/userStore.js'

export default {
  name: 'BetResolver',
  setup() {
    const userStore = useUserStore()
    const resolutionMessage = ref('')

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    const currentUser = computed(() => userStore.currentUser.value)

    const activeBets = computed(() => {
      if (!currentUser.value?.bets) return []
      return currentUser.value.bets.filter(bet => bet.status === 'pending')
    })

    const formatBetType = (betType) => {
      switch (betType) {
        case 'spread': return 'Point Spread'
        case 'moneyline': return 'Moneyline'
        case 'total': return 'Total Points'
        default: return betType
      }
    }

    const resolveBet = (betId, result) => {
      const resultData = {
        status: result,
        resolvedAt: new Date().toISOString()
      }
      
      const success = userStore.resolveBet(betId, resultData)
      
      if (success) {
        const bet = currentUser.value.bets.find(b => b.id === betId)
        if (bet) {
          if (result === 'won') {
            const totalWinnings = bet.amount + bet.potentialWin
            resolutionMessage.value = {
              type: 'success',
              text: `🎉 Bet won! You earned $${bet.potentialWin.toLocaleString()} profit (total return: $${totalWinnings.toLocaleString()})!`
            }
          } else {
            resolutionMessage.value = {
              type: 'error',
              text: `😞 Bet lost. You lost $${bet.amount.toLocaleString()}.`
            }
          }
        }
        
        // Clear message after 3 seconds
        setTimeout(() => {
          resolutionMessage.value = ''
        }, 3000)
      } else {
        resolutionMessage.value = {
          type: 'error',
          text: 'Failed to resolve bet. Please try again.'
        }
      }
    }

    return {
      isAuthenticated,
      activeBets,
      resolutionMessage,
      formatBetType,
      resolveBet
    }
  }
}
</script>

<style scoped>
.bet-resolver {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  margin-bottom: 2rem;
}

.resolver-header h3 {
  margin: 0 0 0.5rem 0;
  color: #1a1a1a;
  font-size: 1.5rem;
  font-weight: 700;
}

.resolver-description {
  margin: 0 0 2rem 0;
  color: #6b7280;
  font-size: 0.95rem;
  line-height: 1.5;
}

.bets-to-resolve {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.bet-to-resolve {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.bet-to-resolve:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.bet-info h4 {
  margin: 0 0 0.5rem 0;
  color: #1a1a1a;
  font-size: 1.1rem;
  font-weight: 600;
}

.bet-details {
  display: flex;
  gap: 1rem;
  align-items: center;
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

.bet-amount {
  font-weight: 700;
  color: #059669;
}

.resolution-controls {
  display: flex;
  gap: 0.75rem;
}

.resolve-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.95rem;
}

.resolve-btn.won {
  background: #059669;
  color: white;
}

.resolve-btn.won:hover {
  background: #047857;
  transform: translateY(-1px);
}

.resolve-btn.lost {
  background: #dc2626;
  color: white;
}

.resolve-btn.lost:hover {
  background: #b91c1c;
  transform: translateY(-1px);
}

.resolution-message {
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: 8px;
  font-weight: 600;
  text-align: center;
}

.resolution-message.success {
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.resolution-message.error {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

@media (max-width: 768px) {
  .bet-resolver {
    padding: 1.5rem;
  }
  
  .bet-to-resolve {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .bet-details {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .resolution-controls {
    justify-content: center;
  }
}
</style>
