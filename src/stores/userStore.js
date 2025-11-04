import { ref, computed } from 'vue'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'

// User store for managing authentication and wallet
const currentUser = ref(null)
const isAuthenticated = ref(false)

// Check for existing session on initialization
const initializeSession = async () => {
  const savedUser = sessionStorage.getItem('currentUser')
  if (savedUser) {
    try {
      const parsedUser = JSON.parse(savedUser)
      currentUser.value = parsedUser
      isAuthenticated.value = true
      
      // Refresh user data from API to get latest bets
      if (parsedUser.username) {
        try {
          const freshData = await loadUserFromAPI(parsedUser.username)
          if (freshData) {
          }
        } catch (error) {
          console.error('Error refreshing user data on initialization:', error)
        }
      }
    } catch (error) {
      console.error('Error restoring user session:', error)
      sessionStorage.removeItem('currentUser')
    }
  }
}

// Default starting balance
const STARTING_BALANCE = 1000

// Load user from backend API
const loadUserFromAPI = async (username) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/user/${username}`)
    if (response.data) {
      currentUser.value = response.data
      isAuthenticated.value = true
      // Persist latest user state
      sessionStorage.setItem('currentUser', JSON.stringify(response.data))
      return response.data
    }
  } catch (error) {
    if (error.response?.status === 404) {
    } else {
      console.error('Error loading user from API:', error)
    }
  }
  return null
}


// Create new user account
const createAccount = async (username, password) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/user`, {
      username: username.toLowerCase(),
      password
    })
    
    if (response.data) {
      currentUser.value = response.data
      isAuthenticated.value = true
      // Save to sessionStorage for persistence
      sessionStorage.setItem('currentUser', JSON.stringify(response.data))
      return response.data
    }
  } catch (error) {
    console.error('Error creating account:', error)
    console.error('Error response:', error.response?.data)
    
    // Return the actual error message from the backend if available
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error)
    }
    
    if (error.response?.status === 409) {
      throw new Error('Username already exists')
    }
    
    if (error.response?.status === 400) {
      throw new Error(error.response.data?.error || 'Invalid request. Please check your username and password.')
    }
    
    throw new Error(error.message || 'Failed to create account')
  }
}

// Login user
const login = async (username, password) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      username: username.toLowerCase(),
      password
    })
    
    if (response.data) {
      currentUser.value = response.data
      isAuthenticated.value = true
      // Save to sessionStorage for persistence
      sessionStorage.setItem('currentUser', JSON.stringify(response.data))
      return response.data
    }
  } catch (error) {
    console.error('Error during login:', error)
    if (error.response?.status === 401) {
      throw new Error('Invalid username or password')
    }
    throw new Error('Login failed')
  }
  return null
}

// Logout user
const logout = () => {
  currentUser.value = null
  isAuthenticated.value = false
  // Clear sessionStorage
  sessionStorage.removeItem('currentUser')
}

// Update user balance (now handled by backend)
const updateBalance = async (amount) => {
  if (currentUser.value) {
    try {
      const response = await axios.put(`${API_BASE_URL}/user/${currentUser.value.username}`, {
        balance: currentUser.value.balance + amount
      })
      if (response.data) {
        currentUser.value = response.data
      }
    } catch (error) {
      console.error('Error updating balance:', error)
    }
  }
}

// Place a bet
const placeBet = async (betData) => {
  if (!currentUser.value) return { success: false, error: 'User not authenticated' }
  
  try {
    const response = await axios.post(`${API_BASE_URL}/user/${currentUser.value.username}/bet`, betData)
    
    if (response.data.success) {
      // Re-fetch full user to ensure bets/history are up to date
      await loadUserFromAPI(currentUser.value.username)
      return { success: true, bet: response.data.bet }
    }
  } catch (error) {
    console.error('Error placing bet:', error)
    if (error.response?.data?.error) {
      return { success: false, error: error.response.data.error }
    }
    return { success: false, error: 'Failed to place bet' }
  }
}

// Resolve a bet (called when game ends)
const resolveBet = async (betId, result) => {
  if (!currentUser.value) return false
  
  try {
    const response = await axios.put(`${API_BASE_URL}/user/${currentUser.value.username}/bet/${betId}`, {
      status: result.status,
      actualResult: result
    })
    
    if (response.data.success) {
      // Refresh full user after resolve to keep stats and history accurate
      await loadUserFromAPI(currentUser.value.username)
      return true
    }
  } catch (error) {
    console.error('Error resolving bet:', error)
  }
  return false
}

// Cancel a pending bet
const cancelBet = async (betId) => {
  if (!currentUser.value) return { success: false, error: 'User not authenticated' }
  
  try {
    const response = await axios.delete(`${API_BASE_URL}/user/${currentUser.value.username}/bet/${betId}`)
    
    if (response.data.success) {
      // Re-fetch full user to ensure bets/history are up to date
      await loadUserFromAPI(currentUser.value.username)
      return { success: true }
    }
  } catch (error) {
    console.error('Error cancelling bet:', error)
    if (error.response?.data?.error) {
      return { success: false, error: error.response.data.error }
    }
    return { success: false, error: 'Failed to cancel bet' }
  }
}

// Computed properties
const userBalance = computed(() => currentUser.value?.balance || 0)
const userStats = computed(() => {
  if (!currentUser.value) return null
  
  const { totalWagered, totalWon, totalLost, bets } = currentUser.value
  const completedBets = bets.filter(bet => bet.status === 'won' || bet.status === 'lost')
  const wonBets = bets.filter(bet => bet.status === 'won').length
  const winRate = completedBets.length > 0 ? ((wonBets / completedBets.length) * 100).toFixed(1) : 0
  const activeBets = bets.filter(bet => bet.status === 'pending').length
  
  // Calculate current streak
  const currentStreak = (() => {
    if (completedBets.length === 0) return 0
    
    // Sort by resolved date (most recent first)
    const sortedBets = [...completedBets].sort((a, b) => 
      new Date(b.resolvedAt || b.createdAt) - new Date(a.resolvedAt || a.createdAt)
    )
    
    let streak = 0
    let isWinning = null
    
    for (const bet of sortedBets) {
      if (isWinning === null) {
        // First bet determines initial streak direction
        isWinning = bet.status === 'won'
        streak = isWinning ? 1 : -1
      } else if ((bet.status === 'won') === isWinning) {
        // Continue streak
        streak += isWinning ? 1 : -1
      } else {
        // Streak broken
        break
      }
    }
    
    return streak
  })()
  
  return {
    totalWagered,
    totalWon,
    totalLost,
    winRate,
    activeBets,
    totalBets: bets.length,
    currentStreak
  }
})

// Initialize store
const initializeStore = async () => {
  // Check for existing session
  await initializeSession()
}

// Initialize store
initializeStore()

export const useUserStore = () => {
  return {
    // State
    currentUser: computed(() => currentUser.value),
    isAuthenticated: computed(() => isAuthenticated.value),
    userBalance,
    userStats,
    
    // Actions
    createAccount,
    login,
    logout,
    updateBalance,
    placeBet,
    resolveBet,
    cancelBet,
    loadUserFromAPI,
    initializeStore
  }
}
