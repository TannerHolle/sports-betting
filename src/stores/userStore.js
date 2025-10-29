import { ref, computed } from 'vue'
import axios from 'axios'

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

// API base URL
const API_BASE_URL = 'https://sports-betting-np5a.onrender.com/api'

// Default starting balance
const STARTING_BALANCE = 1000

// Load user from backend API
const loadUserFromAPI = async (username) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/user/${username}`)
    if (response.data) {
      currentUser.value = response.data
      isAuthenticated.value = true
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
      username,
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
    if (error.response?.status === 409) {
      throw new Error('Username already exists')
    }
    throw new Error('Failed to create account')
  }
}

// Login user
const login = async (username, password) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      username,
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
      currentUser.value = response.data.user
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
      currentUser.value = response.data.user
      return true
    }
  } catch (error) {
    console.error('Error resolving bet:', error)
  }
  return false
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
      new Date(b.resolvedAt || b.placedAt) - new Date(a.resolvedAt || a.placedAt)
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
    loadUserFromAPI,
    initializeStore
  }
}
