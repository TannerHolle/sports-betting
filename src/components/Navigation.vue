<template>
  <nav class="navigation">
    <div class="nav-container">
      <div class="nav-brand">
        <span class="brand-text">Tanner's Sportsbook</span>
      </div>
      
      <!-- Desktop Navigation -->
      <div class="nav-links desktop-nav">
        <!-- Page Navigation -->
        <div class="nav-buttons">
          <!-- Scoreboard - always visible -->
          <button 
            @click="$emit('change-page', 'scoreboard')"
            :class="['nav-link', { active: currentPage === 'scoreboard' }]"
          >
            <span class="nav-text">Live Scores</span>
          </button>

          <!-- Fantasy Betting - only when authenticated -->
          <button 
            v-if="isAuthenticated"
            @click="$emit('change-page', 'betting')"
            :class="['nav-link', { active: currentPage === 'betting' }]"
          >
            <span class="nav-text">Betting Dashboard</span>
          </button>

          <!-- Leagues - only when authenticated -->
          <button 
            v-if="isAuthenticated"
            @click="$emit('change-page', 'leagues')"
            :class="['nav-link', { active: currentPage === 'leagues' }]"
          >
            <span class="nav-text">Leagues</span>
          </button>
        </div>

        <!-- User Authentication -->
        <div v-if="!isAuthenticated" class="auth-section">
          <button 
            @click="$emit('change-page', 'auth')"
            class="nav-link auth-btn"
          >
            <span class="nav-text">Sign In</span>
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

      <!-- Mobile: Hamburger Button and User Info -->
      <div class="mobile-nav-header">
        <!-- User Info (Mobile) -->
        <div v-if="isAuthenticated" class="user-section-mobile">
          <div class="user-info-mobile">
            <span class="username-mobile">{{ currentUser.username }}: ${{ totalCash.toLocaleString() }}</span>
          </div>
        </div>
        
        <!-- Hamburger Button -->
        <button 
          @click="toggleMobileMenu" 
          class="hamburger-btn"
          :class="{ active: isMobileMenuOpen }"
          aria-label="Toggle menu"
        >
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
        </button>
      </div>
    </div>

    <!-- Mobile Menu Overlay -->
    <div 
      v-if="isMobileMenuOpen" 
      class="mobile-menu-overlay"
      @click="closeMobileMenu"
    >
      <div 
        class="mobile-menu"
        @click.stop
      >
        <!-- Scoreboard -->
        <button 
          @click="handleNavClick('scoreboard')"
          :class="['mobile-nav-link', { active: currentPage === 'scoreboard' }]"
        >
          <span class="nav-text">Live Scores</span>
        </button>

        <!-- Fantasy Betting - only when authenticated -->
        <button 
          v-if="isAuthenticated"
          @click="handleNavClick('betting')"
          :class="['mobile-nav-link', { active: currentPage === 'betting' }]"
        >
          <span class="nav-text">Betting Dashboard</span>
        </button>

        <!-- Leagues - only when authenticated -->
        <button 
          v-if="isAuthenticated"
          @click="handleNavClick('leagues')"
          :class="['mobile-nav-link', { active: currentPage === 'leagues' }]"
        >
          <span class="nav-text">Leagues</span>
        </button>

        <!-- Sign In - only when not authenticated -->
        <button 
          v-if="!isAuthenticated"
          @click="handleNavClick('auth')"
          class="mobile-nav-link auth-btn"
        >
          <span class="nav-text">Sign In</span>
        </button>

        <!-- Logout - only when authenticated -->
        <button 
          v-if="isAuthenticated"
          @click="handleLogout"
          class="mobile-nav-link logout-btn-mobile"
        >
          <span class="nav-text">Logout</span>
        </button>
      </div>
    </div>
  </nav>
</template>

<script>
import { computed, ref } from 'vue'
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
  setup(props, { emit }) {
    const userStore = useUserStore()
    const isMobileMenuOpen = ref(false)
    
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

    const toggleMobileMenu = () => {
      isMobileMenuOpen.value = !isMobileMenuOpen.value
    }

    const closeMobileMenu = () => {
      isMobileMenuOpen.value = false
    }

    const handleNavClick = (page) => {
      emit('change-page', page)
      closeMobileMenu()
    }

    const handleLogout = () => {
      userStore.logout()
      closeMobileMenu()
    }

    return {
      isAuthenticated,
      currentUser,
      userBalance,
      totalCash,
      isMobileMenuOpen,
      toggleMobileMenu,
      closeMobileMenu,
      handleNavClick,
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
  background: linear-gradient(135deg, #4169e1 0%, #1e3a8a 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.nav-links {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.nav-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
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
  background: linear-gradient(135deg, #4169e1 0%, #1e3a8a 100%);
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.nav-link.active:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.nav-link.primary {
  background: linear-gradient(135deg, #4169e1 0%, #1e3a8a 100%);
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
  flex-shrink: 0;
}

.nav-text {
  white-space: nowrap;
}

/* Mobile Menu Styles */
.mobile-nav-header {
  display: none;
}

.hamburger-btn {
  display: none;
  flex-direction: column;
  justify-content: space-around;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  z-index: 101;
}

.hamburger-line {
  width: 100%;
  height: 3px;
  background: #1a1a1a;
  border-radius: 3px;
  transition: all 0.3s ease;
}

.hamburger-btn.active .hamburger-line:nth-child(1) {
  transform: rotate(45deg) translate(8px, 8px);
}

.hamburger-btn.active .hamburger-line:nth-child(2) {
  opacity: 0;
}

.hamburger-btn.active .hamburger-line:nth-child(3) {
  transform: rotate(-45deg) translate(7px, -7px);
}

.mobile-menu-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 99;
  animation: fadeIn 0.3s ease;
}

.mobile-menu {
  position: fixed;
  top: 0;
  right: 0;
  width: 280px;
  height: 100%;
  background: white;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
  padding: 4rem 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  animation: slideIn 0.3s ease;
}

.mobile-nav-link {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 2px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 8px;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1rem;
  text-align: left;
  width: 100%;
}

.mobile-nav-link:hover {
  background: #e2e8f0;
  color: #374151;
}

.mobile-nav-link.active {
  background: linear-gradient(135deg, #4169e1 0%, #1e3a8a 100%);
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.mobile-nav-link.auth-btn {
  background: #059669;
  color: white;
  border-color: #059669;
}

.mobile-nav-link.auth-btn:hover {
  background: #047857;
}

.logout-btn-mobile {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
}

.logout-btn-mobile:hover {
  background: #b91c1c;
}

.user-section-mobile {
  display: none;
}

.user-info-mobile {
  background: #f8fafc;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  border: 2px solid #e2e8f0;
  font-size: 0.85rem;
}

.username-mobile {
  font-weight: 600;
  color: #1a1a1a;
  white-space: nowrap;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

@media (max-width: 768px) {
  .desktop-nav {
    display: none;
  }

  .mobile-nav-header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .hamburger-btn {
    display: flex;
  }

  .mobile-menu-overlay {
    display: block;
  }

  .user-section-mobile {
    display: block;
  }

  .nav-container {
    padding: 0.75rem 1rem;
  }
  
  .nav-brand {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .user-info-mobile {
    padding: 0.4rem 0.75rem;
  }

  .username-mobile {
    font-size: 0.8rem;
  }
}

@media (max-width: 480px) {
  .nav-container {
    padding: 0.5rem 0.75rem;
  }

  .nav-brand {
    font-size: 1rem;
  }

  .mobile-menu {
    width: 260px;
    padding: 3.5rem 1.25rem 1.5rem;
  }

  .mobile-nav-link {
    padding: 0.875rem 1rem;
    font-size: 0.9rem;
  }

  .user-info-mobile {
    padding: 0.35rem 0.6rem;
  }

  .username-mobile {
    font-size: 0.75rem;
  }
}
</style>
