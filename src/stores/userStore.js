import { ref, computed } from 'vue'

// User store for managing authentication and wallet
const currentUser = ref(null)
const isAuthenticated = ref(false)

// Default starting balance
const STARTING_BALANCE = 1000

// Load user from localStorage on initialization
const loadUserFromStorage = () => {
  const storedUser = localStorage.getItem('sportsBettingUser')
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser)
      currentUser.value = user
      isAuthenticated.value = true
    } catch (error) {
      console.error('Error loading user from storage:', error)
      localStorage.removeItem('sportsBettingUser')
    }
  }
}

// Save user to localStorage
const saveUserToStorage = (user) => {
  try {
    localStorage.setItem('sportsBettingUser', JSON.stringify(user))
  } catch (error) {
    console.error('Error saving user to storage:', error)
  }
}

// Create new user account
const createAccount = (username, email) => {
  const newUser = {
    id: Date.now().toString(),
    username,
    email,
    balance: STARTING_BALANCE,
    totalWagered: 0,
    totalWon: 0,
    totalLost: 0,
    bets: [],
    createdAt: new Date().toISOString()
  }
  
  currentUser.value = newUser
  isAuthenticated.value = true
  saveUserToStorage(newUser)
  
  return newUser
}

// Login user
const login = (username) => {
  const storedUser = localStorage.getItem('sportsBettingUser')
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser)
      if (user.username === username) {
        currentUser.value = user
        isAuthenticated.value = true
        return user
      }
    } catch (error) {
      console.error('Error during login:', error)
    }
  }
  return null
}

// Logout user
const logout = () => {
  currentUser.value = null
  isAuthenticated.value = false
  localStorage.removeItem('sportsBettingUser')
}

// Update user balance
const updateBalance = (amount) => {
  if (currentUser.value) {
    currentUser.value.balance += amount
    saveUserToStorage(currentUser.value)
  }
}

// Place a bet
const placeBet = (betData) => {
  if (!currentUser.value) return false
  
  const { gameId, betType, selection, amount, odds, potentialWin } = betData
  
  // Check if user has enough balance
  if (currentUser.value.balance < amount) {
    return { success: false, error: 'Insufficient balance' }
  }
  
  const bet = {
    id: Date.now().toString(),
    gameId,
    betType, // 'spread', 'moneyline', 'total'
    selection, // team name or 'over'/'under'
    amount,
    odds,
    potentialWin,
    status: 'pending', // 'pending', 'won', 'lost'
    placedAt: new Date().toISOString(),
    gameData: betData.gameData
  }
  
  // Deduct bet amount from balance
  currentUser.value.balance -= amount
  currentUser.value.totalWagered += amount
  currentUser.value.bets.push(bet)
  
  saveUserToStorage(currentUser.value)
  
  return { success: true, bet }
}

// Resolve a bet (called when game ends)
const resolveBet = (betId, result) => {
  if (!currentUser.value) return false
  
  const bet = currentUser.value.bets.find(b => b.id === betId)
  if (!bet) return false
  
  bet.status = result.status
  bet.resolvedAt = new Date().toISOString()
  bet.actualResult = result
  
  if (result.status === 'won') {
    // When winning: add back the original wager + the winnings
    const totalWinnings = bet.amount + bet.potentialWin
    currentUser.value.balance += totalWinnings
    currentUser.value.totalWon += bet.potentialWin // Only track the profit, not the returned wager
  } else {
    // When losing: the wager was already deducted when placing the bet
    currentUser.value.totalLost += bet.amount
  }
  
  saveUserToStorage(currentUser.value)
  return true
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
  
  return {
    totalWagered,
    totalWon,
    totalLost,
    winRate,
    activeBets,
    totalBets: bets.length
  }
})

// Initialize store
loadUserFromStorage()

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
    loadUserFromStorage
  }
}
