<template>
  <div id="app">
    <!-- Navigation -->
    <Navigation :current-page="currentPage" @change-page="setCurrentPage" />
    
    <!-- Scoreboard Page (Public - No Auth Required) -->
    <ScoreboardPage v-if="currentPage === 'scoreboard'" />
    
    <!-- Betting Page (Protected - Auth Required) -->
    <div v-if="currentPage === 'betting'">
      <AuthPage v-if="!isAuthenticated" @change-page="setCurrentPage" />
      <BettingPage v-else />
    </div>
    
    <!-- Leagues Page (Protected - Auth Required) -->
    <div v-if="currentPage === 'leagues'">
      <AuthPage v-if="!isAuthenticated" @change-page="setCurrentPage" />
      <LeaguesPage v-else />
    </div>
    
    <!-- Auth Page -->
    <AuthPage v-if="currentPage === 'auth'" @change-page="setCurrentPage" />
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from './stores/userStore.js'
import Navigation from './components/Navigation.vue'
import ScoreboardPage from './components/ScoreboardPage.vue'
import BettingPage from './components/BettingPage.vue'
import LeaguesPage from './components/LeaguesPage.vue'
import AuthPage from './components/AuthPage.vue'

export default {
  name: 'App',
  components: {
    Navigation,
    ScoreboardPage,
    BettingPage,
    LeaguesPage,
    AuthPage
  },
  setup() {
    const userStore = useUserStore()
    // Initialize user session on app start
    userStore.initializeStore()
    
    // Check for invite code in URL - if present and user not authenticated, go to auth page
    const urlParams = new URLSearchParams(window.location.search)
    const inviteCode = urlParams.get('invite')
    const initialPage = inviteCode && !userStore.isAuthenticated.value ? 'auth' : (localStorage.getItem('currentPage') || 'scoreboard')
    
    const currentPage = ref(initialPage) // Default to scoreboard (public)

    // Authentication status
    const isAuthenticated = computed(() => userStore.isAuthenticated.value)

    const setCurrentPage = (page) => {
      currentPage.value = page
      localStorage.setItem('currentPage', page)
    }

    // Handle page change events from child components
    const handlePageChangeEvent = (event) => {
      setCurrentPage(event.detail)
    }

    onMounted(() => {
      window.addEventListener('change-page', handlePageChangeEvent)
    })

    onUnmounted(() => {
      window.removeEventListener('change-page', handlePageChangeEvent)
    })

    return {
      currentPage,
      isAuthenticated,
      setCurrentPage
    }
  }
}
</script>

<style scoped>
</style>
