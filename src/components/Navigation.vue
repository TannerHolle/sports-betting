<template>
  <nav class="navigation">
    <div class="nav-container">
      <div class="nav-brand">
        <span class="brand-text">Tanner's Sportsbook</span>
      </div>
      
      <div class="nav-links">
        <!-- Page Navigation -->
        <button 
          v-if="currentPage === 'scoreboard'"
          @click="$emit('change-page', 'betting')"
          class="nav-link primary"
        >
          <span class="nav-icon">🎯</span>
          Fantasy Betting
        </button>
        
        <button 
          v-if="currentPage === 'betting'"
          @click="$emit('change-page', 'scoreboard')"
          class="nav-link secondary"
        >
          <span class="nav-icon">📊</span>
          Scoreboard
        </button>

        <button 
          v-if="currentPage === 'auth'"
          @click="$emit('change-page', 'scoreboard')"
          class="nav-link secondary"
        >
          <span class="nav-icon">📊</span>
          Scoreboard
        </button>

        <!-- User Authentication -->
        <div v-if="!isAuthenticated" class="auth-section">
          <button 
            @click="$emit('change-page', 'auth')"
            class="nav-link auth-btn"
          >
            <span class="nav-icon">👤</span>
            Sign In
          </button>
        </div>

        <!-- User Info -->
        <div v-else class="user-section">
          <div class="user-info">
            <div class="user-details">
              <span class="username">{{ currentUser.username }}: ${{ totalCash.toLocaleString() }}</span>
            </div>
          </div>
          <button @click="handleLogout" class="logout-btn">
            Logout
          </button>
        </div>
      </div>
    </div>
  </nav>
</template>

<script>
import { computed } from 'vue'
import { useUserStore } from '../stores/userStore.js'

export default {
  name: 'Navigation',
  props: {
    currentPage: {
      type: String,
      required: true
    }
  },
  emits: ['change-page'],
  setup() {
    const userStore = useUserStore()
    
    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    const currentUser = computed(() => userStore.currentUser.value)
    const userBalance = computed(() => userStore.userBalance.value)
    
    // Calculate total cash (available + outstanding bets)
    const totalCash = computed(() => {
      if (!currentUser.value?.bets) return userBalance.value
      
      const outstandingBets = currentUser.value.bets.filter(bet => bet.status === 'pending')
      const outstandingAmount = outstandingBets.reduce((sum, bet) => sum + (bet.amount || 0), 0)
      
      return userBalance.value + outstandingAmount
    })

    const handleLogout = () => {
      userStore.logout()
    }

    return {
      isAuthenticated,
      currentUser,
      userBalance,
      totalCash,
      handleLogout
    }
  }
}
</script>

<style scoped>
.navigation {
  background: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.5rem;
  font-weight: 800;
  color: #1a1a1a;
}

.brand-icon {
  font-size: 2rem;
}

.brand-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.nav-links {
  display: flex;
  gap: 0.5rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: 2px solid transparent;
  background: #f8fafc;
  border-radius: 8px;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1rem;
  height: 48px;
  box-sizing: border-box;
}

.nav-link:hover {
  background: #e2e8f0;
  color: #374151;
  transform: translateY(-1px);
}

.nav-link.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.nav-link.active:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.nav-link.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  font-weight: 700;
}

.nav-link.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.nav-link.secondary {
  background: #f8fafc;
  color: #6b7280;
  border: 2px solid #e2e8f0;
}

.nav-link.secondary:hover {
  background: #e2e8f0;
  color: #374151;
  transform: translateY(-1px);
}

.nav-link.auth-btn {
  background: #059669;
  color: white;
  border: 2px solid #059669;
}

.nav-link.auth-btn:hover {
  background: #047857;
  border-color: #047857;
  transform: translateY(-1px);
}

.user-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-info {
  background: #f8fafc;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  border: 2px solid #e2e8f0;
  height: 48px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
}

.user-details {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.username {
  font-weight: 600;
  color: #1a1a1a;
  font-size: 0.9rem;
}

.balance {
  font-weight: 700;
  color: #059669;
  font-size: 1rem;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
  font-size: 0.9rem;
  height: 48px;
  box-sizing: border-box;
}

.logout-btn:hover {
  background: #b91c1c;
}

.nav-icon {
  font-size: 1.2rem;
}

@media (max-width: 768px) {
  .nav-container {
    padding: 1rem;
    flex-direction: column;
    gap: 1rem;
  }
  
  .nav-brand {
    font-size: 1.25rem;
  }
  
  .brand-icon {
    font-size: 1.5rem;
  }
  
  .nav-links {
    width: 100%;
    justify-content: center;
  }
  
  .nav-link {
    flex: 1;
    justify-content: center;
    padding: 0.875rem 1rem;
  }
}
</style>
