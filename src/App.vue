<template>
  <div id="app">
    <!-- Navigation -->
    <Navigation :current-page="currentPage" @change-page="setCurrentPage" />
    
    <!-- Scoreboard Page (Public - No Auth Required) -->
    <div v-if="currentPage === 'scoreboard'">
      <header class="header">
      <div class="container">
        <h1 class="title">
          <span class="title-icon">📊</span>
          Live Scoreboard
        </h1>
        <div class="header-info">
          <span class="season-info">{{ seasonInfo }}</span>
          <div class="auto-refresh-indicator" v-if="refreshInterval">
            <span class="auto-refresh-dot"></span>
            Auto-refresh active
          </div>
          <div class="header-buttons">
            <button @click="refreshData" class="refresh-btn" :disabled="manualLoading">
              <span v-if="manualLoading" class="spinner"></span>
              {{ manualLoading ? 'Loading...' : 'Refresh' }}
            </button>
            <button @click="toggleAutoRefresh" class="auto-refresh-btn">
              {{ refreshInterval ? 'Stop Auto' : 'Start Auto' }}
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- League Tabs -->
    <div class="league-tabs">
      <div class="container">
        <div class="tab-buttons">
          <button 
            v-for="sport in sports" 
            :key="sport.id"
            @click="setActiveLeague(sport.id)" 
            :class="{ active: activeLeague === sport.id }"
            class="tab-btn"
          >
            <span class="tab-icon">{{ sport.icon }}</span>
            {{ sport.name }}
          </button>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <div class="container">
        <div class="filter-row">
          <div class="filter-group">
            <label class="filter-label">Filter by:</label>
            <select v-model="selectedFilter" class="filter-select">
              <option 
                v-for="filter in currentSportFilters" 
                :key="filter.value" 
                :value="filter.value"
              >
                {{ filter.label }}
              </option>
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Date:</label>
            <input 
              v-model="selectedDate" 
              type="date" 
              class="date-input"
            />
          </div>
        </div>
      </div>
    </div>

    <main class="main">
      <div class="container">
        <div v-if="error" class="error-message">
          <h3>⚠️ Error Loading Data</h3>
          <p>{{ error }}</p>
          <button @click="fetchData" class="retry-btn">Try Again</button>
        </div>

        <div v-else-if="manualLoading && !games.length" class="loading-container">
          <div class="spinner-large"></div>
          <p>Loading games...</p>
        </div>

        <div v-else-if="games.length === 0" class="no-games">
          <h3>No games found</h3>
          <p>There are no games scheduled for this week.</p>
        </div>

        <div v-else class="games-grid">
          <component 
            :is="currentGameCardComponent"
            v-for="game in filteredGames" 
            :key="game.id" 
            :game="game" 
            :sport="activeLeague"
          />
        </div>
      </div>
    </main>
    </div>
    
    <!-- Betting Page (Protected - Auth Required) -->
    <div v-if="currentPage === 'betting'">
      <AuthPage v-if="!isAuthenticated" @change-page="setCurrentPage" />
      <BettingPage v-else />
    </div>
    
    <!-- Auth Page -->
    <AuthPage v-if="currentPage === 'auth'" @change-page="setCurrentPage" />
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import axios from 'axios'
import { useUserStore } from './stores/userStore.js'
import NCAAFootballCard from './components/NCAAFootballCard.vue'
import NFLGameCard from './components/NFLGameCard.vue'
import CollegeBasketballCard from './components/CollegeBasketballCard.vue'
import NBAGameCard from './components/NBAGameCard.vue'
import Navigation from './components/Navigation.vue'
import BettingPage from './components/BettingPage.vue'
import AuthPage from './components/AuthPage.vue'

export default {
  name: 'App',
  components: {
    NCAAFootballCard,
    NFLGameCard,
    CollegeBasketballCard,
    NBAGameCard,
    Navigation,
    BettingPage,
    AuthPage
  },
  setup() {
    const userStore = useUserStore()
    // Initialize user session on app start
    userStore.initializeStore()
    const currentPage = ref(localStorage.getItem('currentPage') || 'scoreboard') // Default to scoreboard (public)
    const games = ref([])
    const loading = ref(false)
    const manualLoading = ref(false)
    const error = ref(null)
    const seasonData = ref(null)
    const refreshInterval = ref(null)
    const selectedFilter = ref(localStorage.getItem('selectedFilter') || 'top25')
    const selectedDate = ref('')
    const activeLeague = ref(localStorage.getItem('activeLeague') || 'ncaa-football')

    // Authentication status
    const isAuthenticated = computed(() => userStore.isAuthenticated.value)

    // Sports configuration
    const sports = ref([
      {
        id: 'ncaa-football',
        name: 'NCAA Football',
        icon: '🎓',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
        component: 'NCAAFootballCard',
        filters: [
          { value: 'top25', label: 'Top 25 Only' },
          { value: 'sec', label: 'SEC' },
          { value: 'big10', label: 'Big Ten' },
          { value: 'acc', label: 'ACC' },
          { value: 'big12', label: 'Big 12' }
        ]
      },
      {
        id: 'nfl',
        name: 'NFL',
        icon: '🏈',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
        component: 'NFLGameCard',
        filters: [
          { value: 'all', label: 'All Games' },
          { value: 'afc', label: 'AFC' },
          { value: 'nfc', label: 'NFC' },
          { value: 'afc-east', label: 'AFC East' },
          { value: 'afc-west', label: 'AFC West' },
          { value: 'afc-north', label: 'AFC North' },
          { value: 'afc-south', label: 'AFC South' },
          { value: 'nfc-east', label: 'NFC East' },
          { value: 'nfc-west', label: 'NFC West' },
          { value: 'nfc-north', label: 'NFC North' },
          { value: 'nfc-south', label: 'NFC South' }
        ]
      },
      {
        id: 'ncaa-basketball',
        name: 'NCAA Basketball',
        icon: '🏀',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
        component: 'CollegeBasketballCard',
        filters: [
          { value: 'top25', label: 'Top 25 Only' },
          { value: 'acc', label: 'ACC' },
          { value: 'big10', label: 'Big Ten' },
          { value: 'big12', label: 'Big 12' },
          { value: 'sec', label: 'SEC' },
          { value: 'big-east', label: 'Big East' }
        ]
      },
      {
        id: 'nba',
        name: 'NBA',
        icon: '🏀',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
        component: 'NBAGameCard',
        filters: [
          { value: 'all', label: 'All Games' },
          { value: 'east', label: 'Eastern Conference' },
          { value: 'west', label: 'Western Conference' },
          { value: 'atlantic', label: 'Atlantic Division' },
          { value: 'central', label: 'Central Division' },
          { value: 'southeast', label: 'Southeast Division' },
          { value: 'northwest', label: 'Northwest Division' },
          { value: 'pacific', label: 'Pacific Division' },
          { value: 'southwest', label: 'Southwest Division' }
        ]
      }
    ])

    const seasonInfo = computed(() => {
      if (!seasonData.value) return ''
      const { season, week } = seasonData.value
      
      if (activeLeague.value === 'ncaa-basketball') {
        // Basketball shows season without week
        return `${season.year} Season`
      } else if (week) {
        // Football shows season with week
        return `${season.year} Season - Week ${week.number}`
      } else {
        return `${season.year} Season`
      }
    })

    const currentSport = computed(() => {
      return sports.value.find(sport => sport.id === activeLeague.value)
    })

    const currentSportFilters = computed(() => {
      return currentSport.value?.filters || []
    })

    const currentGameCardComponent = computed(() => {
      return currentSport.value?.component || 'NCAAFootballCard'
    })

    const filteredGames = computed(() => {
      if (!games.value.length) return []
      
      const filtered = games.value.filter(game => {
        const competition = game.competitions?.[0]
        if (!competition) return false
        
        const competitors = competition.competitors || []
        const groups = competition.groups
        
        // Handle filtering based on current sport
        switch (activeLeague.value) {
          case 'ncaa-football':
            return filterNCAAFootballGames(competitors, groups, selectedFilter.value)
          case 'nfl':
            return filterNFLGames(competitors, selectedFilter.value)
          case 'ncaa-basketball':
            return filterNCAABasketballGames(competitors, groups, selectedFilter.value)
          default:
            return true
        }
      })

      // Sort NCAA games by best Top 25 rank (ascending); others unchanged
      if (activeLeague.value === 'ncaa-football' || activeLeague.value === 'ncaa-basketball') {
        const getBestTop25Rank = (game) => {
          const competitors = game.competitions?.[0]?.competitors || []
          const ranks = competitors
            .map(c => c.curatedRank?.current)
            .filter(r => typeof r === 'number' && r >= 1 && r <= 25)
          return ranks.length ? Math.min(...ranks) : Number.POSITIVE_INFINITY
        }

        return [...filtered].sort((a, b) => getBestTop25Rank(a) - getBestTop25Rank(b))
      }

      return filtered
    })

    const fetchData = async (isManual = false) => {
      if (isManual) {
        manualLoading.value = true
      }
      loading.value = true
      error.value = null
      
      try {
        const baseApiUrl = currentSport.value?.apiUrl
        
        if (!baseApiUrl) {
          throw new Error('No API URL configured for current sport')
        }
        
        // Add date parameter only if a date is selected
        let apiUrl = baseApiUrl
        if (selectedDate.value) {
          const formattedDate = selectedDate.value.replace(/-/g, '')
          apiUrl = `${baseApiUrl}?dates=${formattedDate}`
        }
        
        const response = await axios.get(apiUrl)
        
        
        // Handle different data structures for different sports
        try {
          if (activeLeague.value === 'ncaa-basketball') {
            // Basketball doesn't have week data
            seasonData.value = {
              season: response.data.season || { year: new Date().getFullYear() },
              week: null
            }
          } else {
            // Football has week data
            seasonData.value = {
              season: response.data.season || { year: new Date().getFullYear() },
              week: response.data.week || null
            }
          }
        } catch (seasonError) {
          console.error('Error setting season data:', seasonError)
          seasonData.value = {
            season: { year: new Date().getFullYear() },
            week: null
          }
        }
        
        games.value = response.data.events || []
        
      } catch (err) {
        error.value = err.message || 'Failed to fetch data'
        console.error('Error fetching data:', err)
        console.error('Error details:', err.response?.data || err.message)
      } finally {
        loading.value = false
        if (isManual) {
          manualLoading.value = false
        }
        
        // Force clear loading states after a short delay to ensure they're reset
        setTimeout(() => {
          loading.value = false
          manualLoading.value = false
        }, 100)
      }
    }

    const refreshData = () => {
      fetchData(true)
    }

    // Watch for filter changes and save to localStorage
    watch(selectedFilter, (newFilter) => {
      localStorage.setItem('selectedFilter', newFilter)
    })

    // Watch for date changes and fetch new data
    watch(selectedDate, (newDate) => {
      // Fetch new data when date changes
      fetchData(true)
    })

    const setActiveLeague = (league) => {
      activeLeague.value = league
      localStorage.setItem('activeLeague', league) // Save to localStorage
      
      // Set appropriate default filter for each sport
      if (league === 'ncaa-football' || league === 'ncaa-basketball') {
        selectedFilter.value = 'top25' // NCAA Football and Basketball default to Top 25
      } else {
        selectedFilter.value = 'all' // NFL defaults to All Games
      }
      
      // Force reset loading states
      loading.value = false
      manualLoading.value = false
      
      fetchData(true) // Fetch data for the new league
    }

    // Filtering functions
    const filterNCAAFootballGames = (competitors, groups, filter) => {
      switch (filter) {
        case 'top25':
          return competitors.some(comp => 
            comp.curatedRank && comp.curatedRank.current <= 25
          )
        case 'sec':
          return groups?.id === '8' || groups?.shortName === 'SEC'
        case 'big10':
          return groups?.id === '5' || groups?.shortName === 'Big Ten'
        case 'acc':
          return groups?.id === '1' || groups?.shortName === 'ACC'
        case 'big12':
          return groups?.id === '4' || groups?.shortName === 'Big 12'
        default:
          return true
      }
    }

    const filterNFLGames = (competitors, filter) => {
      switch (filter) {
        case 'afc':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isAFCTeam(teamName)
          })
        case 'nfc':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isNFCTeam(teamName)
          })
        case 'afc-east':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isAFCEastTeam(teamName)
          })
        case 'afc-west':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isAFCWestTeam(teamName)
          })
        case 'afc-north':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isAFCNorthTeam(teamName)
          })
        case 'afc-south':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isAFCSouthTeam(teamName)
          })
        case 'nfc-east':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isNFCEastTeam(teamName)
          })
        case 'nfc-west':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isNFCWestTeam(teamName)
          })
        case 'nfc-north':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isNFCNorthTeam(teamName)
          })
        case 'nfc-south':
          return competitors.some(comp => {
            const teamName = comp.team?.abbreviation || comp.team?.displayName || ''
            return isNFCSouthTeam(teamName)
          })
        default:
          return true
      }
    }

    const filterNCAABasketballGames = (competitors, groups, filter) => {
      switch (filter) {
        case 'top25':
          return competitors.some(comp => 
            comp.curatedRank && comp.curatedRank.current <= 25
          )
        case 'acc':
          return competitors.some(comp => comp.team?.conferenceId === '16')
        case 'big10':
          return competitors.some(comp => comp.team?.conferenceId === '7')
        case 'big12':
          return competitors.some(comp => comp.team?.conferenceId === '8')
        case 'sec':
          return competitors.some(comp => comp.team?.conferenceId === '23')
        case 'big-east':
          return competitors.some(comp => comp.team?.conferenceId === '4')
        default:
          return true
      }
    }

    // NFL Team Classification Functions
    const isAFCTeam = (teamName) => {
      const afcTeams = ['BUF', 'MIA', 'NE', 'NYJ', 'BAL', 'CIN', 'CLE', 'PIT', 'HOU', 'IND', 'JAX', 'TEN', 'DEN', 'KC', 'LV', 'LAC']
      return afcTeams.includes(teamName.toUpperCase())
    }

    const isNFCTeam = (teamName) => {
      const nfcTeams = ['DAL', 'NYG', 'PHI', 'WAS', 'CHI', 'DET', 'GB', 'MIN', 'ATL', 'CAR', 'NO', 'TB', 'ARI', 'LAR', 'SF', 'SEA']
      return nfcTeams.includes(teamName.toUpperCase())
    }

    const isAFCEastTeam = (teamName) => {
      const afcEastTeams = ['BUF', 'MIA', 'NE', 'NYJ']
      return afcEastTeams.includes(teamName.toUpperCase())
    }

    const isAFCWestTeam = (teamName) => {
      const afcWestTeams = ['DEN', 'KC', 'LV', 'LAC']
      return afcWestTeams.includes(teamName.toUpperCase())
    }

    const isAFCNorthTeam = (teamName) => {
      const afcNorthTeams = ['BAL', 'CIN', 'CLE', 'PIT']
      return afcNorthTeams.includes(teamName.toUpperCase())
    }

    const isAFCSouthTeam = (teamName) => {
      const afcSouthTeams = ['HOU', 'IND', 'JAX', 'TEN']
      return afcSouthTeams.includes(teamName.toUpperCase())
    }

    const isNFCEastTeam = (teamName) => {
      const nfcEastTeams = ['DAL', 'NYG', 'PHI', 'WAS']
      return nfcEastTeams.includes(teamName.toUpperCase())
    }

    const isNFCWestTeam = (teamName) => {
      const nfcWestTeams = ['ARI', 'LAR', 'SF', 'SEA']
      return nfcWestTeams.includes(teamName.toUpperCase())
    }

    const isNFCNorthTeam = (teamName) => {
      const nfcNorthTeams = ['CHI', 'DET', 'GB', 'MIN']
      return nfcNorthTeams.includes(teamName.toUpperCase())
    }

    const isNFCSouthTeam = (teamName) => {
      const nfcSouthTeams = ['ATL', 'CAR', 'NO', 'TB']
      return nfcSouthTeams.includes(teamName.toUpperCase())
    }

    const startAutoRefresh = () => {
      // Clear any existing interval
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value)
      }
      
      // Set up auto-refresh every 30 seconds
      refreshInterval.value = setInterval(() => {
        fetchData()
      }, 30000) // 30 seconds
    }

    const stopAutoRefresh = () => {
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value)
        refreshInterval.value = null
      }
    }

    const toggleAutoRefresh = () => {
      if (refreshInterval.value) {
        stopAutoRefresh()
      } else {
        startAutoRefresh()
      }
    }

    const setCurrentPage = (page) => {
      currentPage.value = page
      localStorage.setItem('currentPage', page)
    }

    // Handle page change events from child components
    const handlePageChangeEvent = (event) => {
      setCurrentPage(event.detail)
    }

    onMounted(() => {
      fetchData()
      startAutoRefresh()
      window.addEventListener('change-page', handlePageChangeEvent)
    })

    onUnmounted(() => {
      stopAutoRefresh()
      window.removeEventListener('change-page', handlePageChangeEvent)
    })

    return {
      currentPage,
      games,
      loading,
      manualLoading,
      error,
      seasonInfo,
      refreshInterval,
      selectedFilter,
      selectedDate,
      filteredGames,
      activeLeague,
      sports,
      currentSport,
      currentSportFilters,
      currentGameCardComponent,
      isAuthenticated,
      fetchData,
      refreshData,
      setActiveLeague,
      startAutoRefresh,
      stopAutoRefresh,
      toggleAutoRefresh,
      setCurrentPage
    }
  }
}
</script>

<style scoped>
</style>
