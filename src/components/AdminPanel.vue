<template>
  <div class="admin-panel" v-if="isAuthenticated">
    <div class="admin-header">
      <h3>Admin Panel</h3>
      <p class="admin-description">
        Administrative controls for the betting system
      </p>
    </div>

    <div class="admin-actions">
      <div class="action-group">
        <h4>Bet Resolution</h4>
        <p class="action-description">
          Manually trigger bet resolution to check for completed games
        </p>
        <button 
          @click="forceResolveBets"
          :disabled="isLoading"
          class="admin-btn resolve-btn"
        >
          {{ isLoading ? 'Resolving...' : 'Force Resolve Bets' }}
        </button>
        <p v-if="resolveMessage" class="message" :class="resolveMessage.type">
          {{ resolveMessage.text }}
        </p>
      </div>

      <div class="action-group">
        <h4>Odds Update</h4>
        <p class="action-description">
          Force update odds data from external API
        </p>
        <button 
          @click="forceUpdateOdds"
          :disabled="isLoadingOdds"
          class="admin-btn odds-btn"
        >
          {{ isLoadingOdds ? 'Updating...' : 'Force Update Odds' }}
        </button>
        <p v-if="oddsMessage" class="message" :class="oddsMessage.type">
          {{ oddsMessage.text }}
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import axios from 'axios'

export default {
  name: 'AdminPanel',
  setup() {
    const userStore = useUserStore()
    const isLoading = ref(false)
    const isLoadingOdds = ref(false)
    const resolveMessage = ref('')
    const oddsMessage = ref('')

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)

    const forceResolveBets = async () => {
      isLoading.value = true
      resolveMessage.value = ''
      
      try {
        const response = await axios.post('http://localhost:3001/api/bets/force-resolve')
        
        if (response.data.success) {
          resolveMessage.value = {
            type: 'success',
            text: '✅ Bets resolved successfully! Check your bet history for updates.'
          }
        } else {
          resolveMessage.value = {
            type: 'error',
            text: '❌ Failed to resolve bets'
          }
        }
      } catch (error) {
        console.error('Error resolving bets:', error)
        resolveMessage.value = {
          type: 'error',
          text: '❌ Error resolving bets: ' + (error.response?.data?.error || error.message)
        }
      } finally {
        isLoading.value = false
        
        // Clear message after 5 seconds
        setTimeout(() => {
          resolveMessage.value = ''
        }, 5000)
      }
    }

    const forceUpdateOdds = async () => {
      isLoadingOdds.value = true
      oddsMessage.value = ''
      
      try {
        const response = await axios.post('http://localhost:3001/api/odds/force-update')
        
        if (response.data.success) {
          oddsMessage.value = {
            type: 'success',
            text: '✅ Odds updated successfully!'
          }
        } else {
          oddsMessage.value = {
            type: 'error',
            text: '❌ Failed to update odds'
          }
        }
      } catch (error) {
        console.error('Error updating odds:', error)
        oddsMessage.value = {
          type: 'error',
          text: '❌ Error updating odds: ' + (error.response?.data?.error || error.message)
        }
      } finally {
        isLoadingOdds.value = false
        
        // Clear message after 5 seconds
        setTimeout(() => {
          oddsMessage.value = ''
        }, 5000)
      }
    }

    return {
      isAuthenticated,
      isLoading,
      isLoadingOdds,
      resolveMessage,
      oddsMessage,
      forceResolveBets,
      forceUpdateOdds
    }
  }
}
</script>

<style scoped>
.admin-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  margin-bottom: 2rem;
}

.admin-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
}

.admin-header h3 {
  margin: 0 0 0.5rem 0;
  color: #1a1a1a;
  font-size: 1.5rem;
  font-weight: 700;
}

.admin-description {
  margin: 0;
  color: #6b7280;
  font-size: 1rem;
}

.admin-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.action-group {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
}

.action-group h4 {
  margin: 0 0 0.5rem 0;
  color: #374151;
  font-size: 1.1rem;
  font-weight: 600;
}

.action-description {
  margin: 0 0 1rem 0;
  color: #6b7280;
  font-size: 0.9rem;
  line-height: 1.4;
}

.admin-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9rem;
}

.resolve-btn {
  background: #dc2626;
  color: white;
}

.resolve-btn:hover:not(:disabled) {
  background: #b91c1c;
}

.odds-btn {
  background: #2563eb;
  color: white;
}

.odds-btn:hover:not(:disabled) {
  background: #1d4ed8;
}

.admin-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message {
  margin: 1rem 0 0 0;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
}

.message.success {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.message.error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

@media (max-width: 768px) {
  .admin-actions {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .admin-panel {
    padding: 1.5rem;
  }
}
</style>
