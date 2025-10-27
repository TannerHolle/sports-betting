<template>
  <div class="user-auth">
    <div v-if="!isAuthenticated" class="auth-container">
      <div class="auth-tabs">
        <button 
          @click="activeTab = 'login'" 
          :class="{ active: activeTab === 'login' }"
          class="tab-btn"
        >
          Login
        </button>
        <button 
          @click="activeTab = 'signup'" 
          :class="{ active: activeTab === 'signup' }"
          class="tab-btn"
        >
          Sign Up
        </button>
      </div>

      <!-- Login Form -->
      <form v-if="activeTab === 'login'" @submit.prevent="handleLogin" class="auth-form">
        <h3>Welcome Back!</h3>
        <div class="form-group">
          <label for="login-username">Username:</label>
          <input 
            id="login-username"
            v-model="loginForm.username" 
            type="text" 
            required 
            placeholder="Enter your username"
            class="form-input"
          />
        </div>
        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? 'Logging in...' : 'Login' }}
        </button>
        <p v-if="error" class="error-message">{{ error }}</p>
      </form>

      <!-- Sign Up Form -->
      <form v-if="activeTab === 'signup'" @submit.prevent="handleSignup" class="auth-form">
        <h3>Create Your Account</h3>
        <p class="signup-info">Start with $1,000 in fake money to practice betting!</p>
        <div class="form-group">
          <label for="signup-username">Username:</label>
          <input 
            id="signup-username"
            v-model="signupForm.username" 
            type="text" 
            required 
            placeholder="Choose a username"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="signup-email">Email:</label>
          <input 
            id="signup-email"
            v-model="signupForm.email" 
            type="email" 
            required 
            placeholder="Enter your email"
            class="form-input"
          />
        </div>
        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? 'Creating Account...' : 'Create Account' }}
        </button>
        <p v-if="error" class="error-message">{{ error }}</p>
      </form>
    </div>

    <!-- User Dashboard -->
    <div v-else class="user-dashboard">
      <div class="user-info">
        <div class="user-welcome">
          <h3>Welcome, {{ currentUser.username }}!</h3>
          <div class="balance-display">
            <span class="balance-label">Balance:</span>
            <span class="balance-amount" :class="{ 'low-balance': userBalance < 100 }">
              ${{ userBalance.toLocaleString() }}
            </span>
          </div>
        </div>
        <button @click="handleLogout" class="logout-btn">Logout</button>
      </div>
      
      <div class="user-stats" v-if="userStats">
        <div class="stat-item">
          <span class="stat-label">Total Wagered:</span>
          <span class="stat-value">${{ userStats.totalWagered.toLocaleString() }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Won:</span>
          <span class="stat-value positive">${{ userStats.totalWon.toLocaleString() }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Lost:</span>
          <span class="stat-value negative">${{ userStats.totalLost.toLocaleString() }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Win Rate:</span>
          <span class="stat-value" :class="{ 'positive': userStats.winRate > 0, 'negative': userStats.winRate < 0 }">
            {{ userStats.winRate }}%
          </span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Active Bets:</span>
          <span class="stat-value">{{ userStats.activeBets }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { useUserStore } from '../stores/userStore.js'

export default {
  name: 'UserAuth',
  setup() {
    const userStore = useUserStore()
    const activeTab = ref('login')
    const loading = ref(false)
    const error = ref('')
    
    const loginForm = ref({
      username: ''
    })
    
    const signupForm = ref({
      username: '',
      email: ''
    })

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    const currentUser = computed(() => userStore.currentUser.value)
    const userBalance = computed(() => userStore.userBalance.value)
    const userStats = computed(() => userStore.userStats.value)

    const handleLogin = async () => {
      loading.value = true
      error.value = ''
      
      try {
        const user = userStore.login(loginForm.value.username)
        if (user) {
          // Login successful
          loginForm.value.username = ''
        } else {
          error.value = 'Username not found. Please sign up first.'
        }
      } catch (err) {
        error.value = 'Login failed. Please try again.'
      } finally {
        loading.value = false
      }
    }

    const handleSignup = async () => {
      loading.value = true
      error.value = ''
      
      try {
        // Check if username already exists
        const existingUser = userStore.login(signupForm.value.username)
        if (existingUser) {
          error.value = 'Username already exists. Please choose a different one.'
          return
        }
        
        const user = userStore.createAccount(
          signupForm.value.username,
          signupForm.value.email
        )
        
        if (user) {
          // Signup successful
          signupForm.value.username = ''
          signupForm.value.email = ''
        }
      } catch (err) {
        error.value = 'Signup failed. Please try again.'
      } finally {
        loading.value = false
      }
    }

    const handleLogout = () => {
      userStore.logout()
    }

    return {
      activeTab,
      loading,
      error,
      loginForm,
      signupForm,
      isAuthenticated,
      currentUser,
      userBalance,
      userStats,
      handleLogin,
      handleSignup,
      handleLogout
    }
  }
}
</script>

<style scoped>
.user-auth {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  margin-bottom: 2rem;
}

.auth-container {
  max-width: 400px;
  margin: 0 auto;
}

.auth-tabs {
  display: flex;
  margin-bottom: 2rem;
  border-bottom: 2px solid #f0f0f0;
}

.tab-btn {
  flex: 1;
  padding: 1rem;
  border: none;
  background: none;
  font-size: 1.1rem;
  font-weight: 600;
  color: #666;
  cursor: pointer;
  transition: all 0.3s ease;
  border-bottom: 3px solid transparent;
}

.tab-btn.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.tab-btn:hover {
  color: #2563eb;
}

.auth-form h3 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #1a1a1a;
  font-size: 1.5rem;
}

.signup-info {
  text-align: center;
  color: #059669;
  font-weight: 600;
  margin-bottom: 1.5rem;
  padding: 0.75rem;
  background: #ecfdf5;
  border-radius: 8px;
  border: 1px solid #a7f3d0;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #374151;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.submit-btn {
  width: 100%;
  padding: 0.875rem;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.submit-btn:hover:not(:disabled) {
  background: #1d4ed8;
}

.submit-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.error-message {
  color: #dc2626;
  text-align: center;
  margin-top: 1rem;
  font-weight: 500;
}

.user-dashboard {
  max-width: 600px;
  margin: 0 auto;
}

.user-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
}

.user-welcome h3 {
  margin: 0 0 0.5rem 0;
  color: #1a1a1a;
  font-size: 1.5rem;
}

.balance-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.balance-label {
  font-weight: 600;
  color: #374151;
}

.balance-amount {
  font-size: 1.5rem;
  font-weight: 700;
  color: #059669;
}

.balance-amount.low-balance {
  color: #dc2626;
}

.logout-btn {
  padding: 0.5rem 1rem;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.logout-btn:hover {
  background: #b91c1c;
}

.user-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a1a1a;
}

.stat-value.positive {
  color: #059669;
}

.stat-value.negative {
  color: #dc2626;
}

@media (max-width: 768px) {
  .user-auth {
    padding: 1.5rem;
  }
  
  .user-info {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
  
  .user-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
