<template>
  <div class="scoreboard-page">
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

        <div v-else-if="loading && !games.length" class="loading-container">
          <div class="spinner-large"></div>
          <p>Loading games...</p>
        </div>

        <div v-else-if="filteredGames.length === 0" class="no-games">
          <div class="no-games-icon">{{ currentSport?.icon || '🏈' }}</div>
          <h3>{{ emptyStateTitle }}</h3>
          <p>{{ emptyStateMessage }}</p>
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
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import axios from 'axios'
import NCAAFootballCard from './NCAAFootballCard.vue'
import NFLGameCard from './NFLGameCard.vue'
import CollegeBasketballCard from './CollegeBasketballCard.vue'
import NBAGameCard from './NBAGameCard.vue'

export default {
  name: 'ScoreboardPage',
  components: {
    NCAAFootballCard,
    NFLGameCard,
    CollegeBasketballCard,
    NBAGameCard
  },
  setup() {
    const games = ref([])
    const loading = ref(false)
    const error = ref(null)
    const refreshInterval = ref(null)
    const selectedFilter = ref(localStorage.getItem('selectedFilter') || 'top25')
    const selectedDate = ref('')
    const activeLeague = ref(localStorage.getItem('activeLeague') || 'ncaa-football')

    // Sports configuration
    const sports = ref([
      {
        id: 'ncaa-football',
        name: 'NCAA Football',
        icon: '🎓',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
        component: 'NCAAFootballCard',
        filters: [
          { value: 'all', label: 'All Games' },
          { value: 'top25', label: 'Top 25 Only' },
          { value: 'sec', label: 'SEC' },
          { value: 'big10', label: 'Big Ten' },
          { value: 'acc', label: 'ACC' },
          { value: 'big12', label: 'Big 12' },
          { value: 'mountainwest', label: 'Mountain West' },
          { value: 'american', label: 'American Athletic' }
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
          { value: 'all', label: 'All Games' },
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

    const currentSport = computed(() => {
      return sports.value.find(sport => sport.id === activeLeague.value)
    })

    const currentSportFilters = computed(() => {
      return currentSport.value?.filters || []
    })

    const currentGameCardComponent = computed(() => {
      return currentSport.value?.component || 'NCAAFootballCard'
    })

    const emptyStateTitle = computed(() => {
      if (games.value.length === 0) {
        return 'No games scheduled'
      }
      return 'No games match your filters'
    })

    const emptyStateMessage = computed(() => {
      if (games.value.length === 0) {
        if (selectedDate.value) {
          const date = new Date(selectedDate.value)
          const formattedDate = date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
          return `There are no games scheduled for ${formattedDate}.`
        }
        return 'There are no games scheduled for the selected date.'
      }
      
      // Games exist but don't match filter
      const filterLabel = currentSportFilters.value.find(f => f.value === selectedFilter.value)?.label || 'your filter'
      
      if (selectedDate.value) {
        const date = new Date(selectedDate.value)
        const formattedDate = date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
        return `No games match the "${filterLabel}" filter for ${formattedDate}. Try selecting a different filter or date.`
      }
      
      return `No games match the "${filterLabel}" filter. Try selecting a different filter or date.`
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

      // Only apply live game sorting for NCAA sports (college football and basketball)
      if (activeLeague.value === 'ncaa-football' || activeLeague.value === 'ncaa-basketball') {
        // Helper function to get best rank for a game (lower number = higher rank)
        const getBestRank = (game) => {
          const competitors = game.competitions?.[0]?.competitors || []
          const ranks = competitors
            .map(c => c.curatedRank?.current)
            .filter(r => typeof r === 'number' && r >= 1 && r <= 25)
          return ranks.length ? Math.min(...ranks) : Number.POSITIVE_INFINITY
        }

        // Helper function to check if game is live
        const isLiveGame = (game) => {
          const status = game.competitions?.[0]?.status
          return status?.type?.state === 'in'
        }

        // Separate live and non-live games
        const liveGames = filtered.filter(isLiveGame)
        const nonLiveGames = filtered.filter(game => !isLiveGame(game))

        // Sort live games by highest rank first (lowest rank number)
        const sortedLiveGames = [...liveGames].sort((a, b) => {
          const rankA = getBestRank(a)
          const rankB = getBestRank(b)
          return rankA - rankB
        })

        // Sort non-live games by rank
        const sortedNonLiveGames = [...nonLiveGames].sort((a, b) => {
          const rankA = getBestRank(a)
          const rankB = getBestRank(b)
          return rankA - rankB
        })

        // Return live games first, then non-live games
        return [...sortedLiveGames, ...sortedNonLiveGames]
      }

      // For NFL and NBA, return filtered games without live game prioritization
      return filtered
    })

    // Format date for ESPN API (YYYYMMDD)
    const formatDateForAPI = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}${month}${day}`
    }

    const fetchData = async () => {
      loading.value = true
      error.value = null
      
      try {
        const baseApiUrl = currentSport.value?.apiUrl
        
        if (!baseApiUrl) {
          throw new Error('No API URL configured for current sport')
        }
        
        // Add date parameter
        let apiUrl = baseApiUrl
        if (selectedDate.value) {
          // If a date is explicitly selected, use it
          const formattedDate = selectedDate.value.replace(/-/g, '')
          apiUrl = `${baseApiUrl}?dates=${formattedDate}`
        } else if (activeLeague.value === 'nba' || activeLeague.value === 'ncaa-basketball') {
          // For NBA and college basketball, always include current date to avoid getting yesterday's games in early morning
          const currentDate = new Date()
          const formattedDate = formatDateForAPI(currentDate)
          apiUrl = `${baseApiUrl}?dates=${formattedDate}`
        }
        
        const response = await axios.get(apiUrl)
        games.value = response.data.events || []
        
      } catch (err) {
        error.value = err.message || 'Failed to fetch data'
        console.error('Error fetching data:', err)
        console.error('Error details:', err.response?.data || err.message)
      } finally {
        loading.value = false
      }
    }

    // Watch for filter changes and save to localStorage
    watch(selectedFilter, (newFilter) => {
      localStorage.setItem('selectedFilter', newFilter)
    })

    // Watch for date changes and fetch new data
    watch(selectedDate, () => {
      // Fetch new data when date changes
      fetchData()
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
      
      // Reset loading state
      loading.value = false
      
      fetchData() // Fetch data for the new league
    }

    // Filtering functions
    const filterNCAAFootballGames = (competitors, groups, filter) => {
      switch (filter) {
        case 'all':
          return true
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
        case 'mountainwest':
          return groups?.id === '17' || groups?.shortName === 'Mountain West'
        case 'american':
          return groups?.id === '151' || groups?.shortName === 'American'
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
        case 'all':
          return true
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
      
      // Set up auto-refresh every 10 seconds
      refreshInterval.value = setInterval(() => {
        fetchData()
      }, 10000) // 10 seconds
    }

    const stopAutoRefresh = () => {
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value)
        refreshInterval.value = null
      }
    }

    onMounted(() => {
      // Ensure college sports default to 'top25' filter on initial load if no preference is saved
      if (activeLeague.value === 'ncaa-football' || activeLeague.value === 'ncaa-basketball') {
        if (!localStorage.getItem('selectedFilter')) {
          selectedFilter.value = 'top25'
        }
      }
      fetchData()
      startAutoRefresh()
    })

    onUnmounted(() => {
      stopAutoRefresh()
    })

    return {
      games,
      loading,
      error,
      selectedFilter,
      selectedDate,
      filteredGames,
      activeLeague,
      sports,
      currentSport,
      currentSportFilters,
      currentGameCardComponent,
      emptyStateTitle,
      emptyStateMessage,
      fetchData,
      setActiveLeague
    }
  }
}
</script>

<style scoped>
</style>


