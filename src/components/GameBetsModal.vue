<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>Your bet{{ bets.length > 1 ? 's' : '' }} on this game</h2>
        <button class="close-btn" @click="closeModal" aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      
      <div class="modal-body">
        <div v-if="bets.length === 0" class="no-bets">
          <p>No bets found for this game.</p>
        </div>
        
        <div v-else class="bets-list">
          <BetCard
            v-for="bet in bets"
            :key="bet._id"
            :bet="bet"
            :show-cancel-button="true"
            :can-cancel-bet="canCancelBet"
            :cancelling-bet-id="cancellingBetId"
            @cancel-bet="handleCancelBet"
          />
        </div>
      </div>
      
      <div class="modal-footer">
        <button @click="closeModal" class="btn btn-primary">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import BetCard from './BetCard.vue'

export default {
  name: 'GameBetsModal',
  components: {
    BetCard
  },
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    bets: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const userStore = useUserStore()
    const cancellingBetId = ref(null)
    
    const closeModal = () => {
      emit('close')
    }
    
    const canCancelBet = (bet) => {
      return bet.status === 'pending'
    }
    
    const handleCancelBet = async (betId) => {
      if (!confirm('Are you sure you want to cancel this bet?')) {
        return
      }
      
      cancellingBetId.value = betId
      
      try {
        const result = await userStore.cancelBet(betId)
        if (result.success) {
          // Bet will be removed from the list automatically via reactivity
          // The parent component should refresh the bets list
        } else {
          alert(result.error || 'Failed to cancel bet')
        }
      } catch (error) {
        console.error('Error cancelling bet:', error)
        alert('Failed to cancel bet')
      } finally {
        cancellingBetId.value = null
      }
    }
    
    return {
      closeModal,
      canCancelBet,
      handleCancelBet,
      cancellingBetId
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
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
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
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
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a1a1a;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #1a1a1a;
}

.modal-body {
  padding: 2rem;
  flex: 1;
  overflow-y: auto;
}

.no-bets {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
}

.bets-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 1.5rem 2rem;
  border-top: 1px solid #e5e7eb;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #4169e1 0%, #1e3a8a 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(65, 105, 225, 0.3);
}

@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    max-height: 85vh;
  }
  
  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 1.25rem;
  }
  
  .modal-header h2 {
    font-size: 1.25rem;
  }
}
</style>

