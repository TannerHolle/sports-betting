<template>
  <div class="betting-interface" v-if="isAuthenticated && betting">
    <h4 class="betting-title">Place Your Bet</h4>
    
    <div class="bet-options">
      <!-- Spread Betting -->
      <div class="bet-type" v-if="betting.pointSpread">
        <h5>Point Spread</h5>
        <div class="bet-options-grid">
          <button 
            v-for="(option, index) in spreadOptions" 
            :key="index"
            @click="selectBet('spread', option)"
            :class="{ 
              'bet-option': true, 
              'selected': selectedBet?.type === 'spread' && selectedBet?.selection === option.selection 
            }"
          >
            <div class="bet-team">{{ option.team }}</div>
            <div class="bet-line">{{ option.line }}</div>
            <div class="bet-odds">{{ option.odds }}</div>
          </button>
        </div>
      </div>

      <!-- Moneyline Betting -->
      <div class="bet-type" v-if="betting.moneyline">
        <h5>Moneyline</h5>
        <div class="bet-options-grid">
          <button 
            v-for="(option, index) in moneylineOptions" 
            :key="index"
            @click="selectBet('moneyline', option)"
            :class="{ 
              'bet-option': true, 
              'selected': selectedBet?.type === 'moneyline' && selectedBet?.selection === option.selection 
            }"
          >
            <div class="bet-team">{{ option.team }}</div>
            <div class="bet-odds">{{ option.odds }}</div>
          </button>
        </div>
      </div>

      <!-- Total (Over/Under) Betting -->
      <div class="bet-type" v-if="betting.total">
        <h5>Total Points</h5>
        <div class="bet-options-grid">
          <button 
            v-for="(option, index) in totalOptions" 
            :key="index"
            @click="selectBet('total', option)"
            :class="{ 
              'bet-option': true, 
              'selected': selectedBet?.type === 'total' && selectedBet?.selection === option.selection 
            }"
          >
            <div class="bet-team">{{ option.selection }}</div>
            <div class="bet-line">{{ option.line }}</div>
            <div class="bet-odds">{{ option.odds }}</div>
          </button>
        </div>
      </div>
    </div>

    <!-- Bet Amount Selection -->
    <div class="bet-amount" v-if="selectedBet">
      <h5>Bet Amount</h5>
      <div class="amount-input-group">
        <span class="currency-symbol">$</span>
        <input 
          v-model.number="betAmount" 
          type="number" 
          min="1" 
          :max="userBalance"
          step="1"
          class="amount-input"
          placeholder="Enter amount"
        />
      </div>
      
      <!-- Quick amount buttons -->
      <div class="quick-amounts">
        <button 
          v-for="amount in quickAmounts" 
          :key="amount"
          @click="betAmount = amount"
          :disabled="amount > userBalance"
          class="quick-amount-btn"
        >
          ${{ amount }}
        </button>
      </div>

      <!-- Bet Summary -->
      <div class="bet-summary" v-if="betAmount > 0">
        <div class="summary-row">
          <span>Bet Amount:</span>
          <span>${{ betAmount.toLocaleString() }}</span>
        </div>
        <div class="summary-row">
          <span>Potential Win:</span>
          <span class="potential-win">${{ potentialWin.toLocaleString() }}</span>
        </div>
        <div class="summary-row">
          <span>Total Return:</span>
          <span class="total-return">${{ (betAmount + potentialWin).toLocaleString() }}</span>
        </div>
      </div>

      <!-- Place Bet Button -->
      <button 
        @click="placeBet"
        :disabled="!canPlaceBet"
        class="place-bet-btn"
      >
        Place Bet
      </button>
      
      <p v-if="error" class="error-message">{{ error }}</p>
      <p v-if="success" class="success-message">{{ success }}</p>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { useUserStore } from '../stores/userStore.js'

export default {
  name: 'BettingInterface',
  props: {
    game: {
      type: Object,
      required: true
    },
    betting: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const userStore = useUserStore()
    const selectedBet = ref(null)
    const betAmount = ref(0)
    const error = ref('')
    const success = ref('')
    
    const quickAmounts = [10, 25, 50, 100, 250, 500]

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    const userBalance = computed(() => userStore.userBalance.value)

    // Get team names
    const homeTeam = computed(() => {
      const competitor = props.game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home')
      return competitor?.team?.shortDisplayName || 'Home'
    })

    const awayTeam = computed(() => {
      const competitor = props.game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away')
      return competitor?.team?.shortDisplayName || 'Away'
    })

    // Spread options
    const spreadOptions = computed(() => {
      if (!props.betting.pointSpread) return []
      
      const homeLine = parseFloat(props.betting.pointSpread.home.close.line)
      const awayLine = parseFloat(props.betting.pointSpread.away.close.line)
      
      return [
        {
          team: homeLine < 0 ? homeTeam.value : awayTeam.value,
          line: homeLine < 0 ? homeLine : awayLine,
          odds: homeLine < 0 ? props.betting.pointSpread.home.close.odds : props.betting.pointSpread.away.close.odds,
          selection: homeLine < 0 ? homeTeam.value : awayTeam.value
        },
        {
          team: homeLine < 0 ? awayTeam.value : homeTeam.value,
          line: homeLine < 0 ? Math.abs(homeLine) : Math.abs(awayLine),
          odds: homeLine < 0 ? props.betting.pointSpread.away.close.odds : props.betting.pointSpread.home.close.odds,
          selection: homeLine < 0 ? awayTeam.value : homeTeam.value
        }
      ]
    })

    // Moneyline options
    const moneylineOptions = computed(() => {
      if (!props.betting.moneyline) return []
      
      return [
        {
          team: homeTeam.value,
          odds: props.betting.moneyline.home.close.odds,
          selection: homeTeam.value
        },
        {
          team: awayTeam.value,
          odds: props.betting.moneyline.away.close.odds,
          selection: awayTeam.value
        }
      ]
    })

    // Total options
    const totalOptions = computed(() => {
      if (!props.betting.total) return []
      
      return [
        {
          selection: 'Over',
          line: props.betting.total.over.close.line,
          odds: props.betting.total.over.close.odds
        },
        {
          selection: 'Under',
          line: props.betting.total.under.close.line,
          odds: props.betting.total.under.close.odds
        }
      ]
    })

    // Calculate potential winnings
    const potentialWin = computed(() => {
      if (!selectedBet.value || !betAmount.value) return 0
      
      let odds = selectedBet.value.odds
      const amount = betAmount.value
      
      // Convert number odds to string format if needed
      if (typeof odds === 'number') {
        odds = odds > 0 ? `+${odds}` : `${odds}`
      }
      
      // Handle "EVEN" odds (which means +100)
      if (odds === 'EVEN' || odds === 'even') {
        return amount // Even odds means you win the same amount you bet
      }
      
      // Parse odds (e.g., "+150" or "-200")
      const isPositive = odds.startsWith('+')
      const oddsValue = parseInt(odds.replace(/[+-]/, ''))
      
      // Check if oddsValue is valid
      if (isNaN(oddsValue)) {
        return 0
      }
      
      if (isPositive) {
        // Positive odds: win = (amount * odds) / 100
        return Math.round((amount * oddsValue) / 100)
      } else {
        // Negative odds: win = (amount * 100) / odds
        return Math.round((amount * 100) / oddsValue)
      }
    })

    const canPlaceBet = computed(() => {
      return selectedBet.value && 
             betAmount.value > 0 && 
             betAmount.value <= userBalance.value &&
             !error.value
    })

    const selectBet = (type, option) => {
      selectedBet.value = {
        type,
        selection: option.selection,
        odds: option.odds,
        line: option.line,
        team: option.team
      }
      error.value = ''
      success.value = ''
    }

    const placeBet = async () => {
      if (!canPlaceBet.value) return
      
      const betData = {
        gameId: props.game.id,
        betType: selectedBet.value.type,
        selection: selectedBet.value.selection,
        amount: betAmount.value,
        odds: selectedBet.value.odds,
        potentialWin: potentialWin.value,
        gameData: {
          homeTeam: homeTeam.value,
          awayTeam: awayTeam.value,
          gameName: props.game.name
        }
      }
      
      try {
        const result = await userStore.placeBet(betData)
        
        if (result.success) {
          success.value = `Bet placed successfully! Potential win: $${potentialWin.value.toLocaleString()}`
          // Reset form
          selectedBet.value = null
          betAmount.value = 0
          error.value = ''
          
          // Clear success message after 3 seconds
          setTimeout(() => {
            success.value = ''
          }, 3000)
        } else {
          error.value = result.error || 'Failed to place bet'
        }
      } catch (err) {
        error.value = 'Failed to place bet'
        console.error('Error placing bet:', err)
      }
    }

    return {
      selectedBet,
      betAmount,
      error,
      success,
      quickAmounts,
      isAuthenticated,
      userBalance,
      spreadOptions,
      moneylineOptions,
      totalOptions,
      potentialWin,
      canPlaceBet,
      selectBet,
      placeBet
    }
  }
}
</script>

<style scoped>
.betting-interface {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 1rem;
}

.betting-title {
  margin: 0 0 1.5rem 0;
  color: #1a1a1a;
  font-size: 1.25rem;
  font-weight: 700;
}


.bet-type {
  margin-bottom: 2rem;
}

.bet-type h5 {
  margin: 0 0 1rem 0;
  color: #374151;
  font-size: 1rem;
  font-weight: 600;
}

.bet-options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.bet-option {
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
}

.bet-option:hover {
  border-color: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
}

.bet-option.selected {
  border-color: #2563eb;
  background: #eff6ff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.bet-team {
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 0.25rem;
}

.bet-line {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.bet-odds {
  font-weight: 700;
  color: #059669;
  font-size: 1.1rem;
}

.bet-amount {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
}

.bet-amount h5 {
  margin: 0 0 1rem 0;
  color: #374151;
  font-size: 1rem;
  font-weight: 600;
}

.amount-input-group {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.currency-symbol {
  font-size: 1.25rem;
  font-weight: 600;
  color: #374151;
  margin-right: 0.5rem;
}

.amount-input {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  font-size: 1.1rem;
  font-weight: 600;
}

.amount-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.quick-amounts {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.quick-amount-btn {
  padding: 0.5rem 1rem;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.quick-amount-btn:hover:not(:disabled) {
  background: #e5e7eb;
  border-color: #9ca3af;
}

.quick-amount-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bet-summary {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.summary-row:last-child {
  margin-bottom: 0;
  font-weight: 600;
  padding-top: 0.5rem;
  border-top: 1px solid #e5e7eb;
}

.potential-win {
  color: #059669;
  font-weight: 600;
}

.total-return {
  color: #2563eb;
  font-weight: 700;
}

.place-bet-btn {
  width: 100%;
  padding: 1rem;
  background: #059669;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.place-bet-btn:hover:not(:disabled) {
  background: #047857;
}

.place-bet-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.error-message {
  color: #dc2626;
  text-align: center;
  margin-top: 1rem;
  font-weight: 500;
}

.success-message {
  color: #059669;
  text-align: center;
  margin-top: 1rem;
  font-weight: 500;
}

@media (max-width: 768px) {
  .bet-options-grid {
    grid-template-columns: 1fr;
  }
  
  .quick-amounts {
    justify-content: center;
  }
}
</style>
