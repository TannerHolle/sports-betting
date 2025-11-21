<template>
  <div class="advanced-stats">
    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <p>Loading advanced statistics...</p>
    </div>

    <div v-else-if="error" class="error-message">
      <p>{{ error }}</p>
      <button @click="fetchStats" class="retry-btn">Retry</button>
    </div>

    <div v-else-if="stats" class="stats-content">
      <!-- Sport Filter (applies to both sections) -->
      <div class="global-filter" v-if="stats.availableSports && stats.availableSports.length > 0">
        <label for="sport-select">Filter by Sport:</label>
        <select id="sport-select" v-model="selectedSport" @change="onSportChange" class="sport-select">
          <option value="all">All Sports</option>
          <option v-for="sport in stats.availableSports" :key="sport" :value="sport">
            {{ formatSportName(sport) }}
          </option>
        </select>
      </div>

      <!-- Win Percentage by Bet Type -->
      <div class="stats-section">
        <h4>Win Percentage by Bet Type</h4>
        <div class="stats-grid">
          <div 
            v-for="(stat, betType) in currentWinPercentageByType" 
            :key="betType"
            class="stat-card"
          >
            <div class="stat-header">
              <span class="bet-type-label">{{ formatBetType(betType) }}</span>
            </div>
            <div class="stat-value" :class="{ 
              'positive': parseFloat(stat.winRate) > 50, 
              'negative': parseFloat(stat.winRate) < 50 
            }">
              {{ stat.winRate }}%
            </div>
            <div class="stat-details">
              <div class="stat-detail">
                <span class="label">Won:</span>
                <span class="value positive">{{ stat.won }}</span>
              </div>
              <div class="stat-detail">
                <span class="label">Lost:</span>
                <span class="value negative">{{ stat.lost }}</span>
              </div>
              <div v-if="stat.push > 0" class="stat-detail">
                <span class="label">Push:</span>
                <span class="value">{{ stat.push }}</span>
              </div>
              <div class="stat-detail">
                <span class="label">Total:</span>
                <span class="value">{{ stat.total }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Game Outcomes (All Games in System) -->
      <div class="stats-section">
        <h4>All Game Outcomes</h4>
        <p class="section-description">
          Statistics from all completed games in the system, showing how many games covered the spread or went over/under based on the official betting lines (from GameOutcome data)
        </p>

        <div class="outcomes-row">
          <!-- Over/Under Statistics -->
          <div class="outcome-section">
            <h5 class="centered-header">Over/Under</h5>
            <div v-if="currentGameOutcomes?.total?.totalGames > 0" class="outcome-stats">
              <div class="outcome-card over">
                <div class="outcome-label">Over</div>
                <div class="outcome-percentage">{{ currentGameOutcomes.total.overPercentage }}%</div>
                <div class="outcome-count">{{ currentGameOutcomes.total.overCount }} games</div>
              </div>
              <div class="outcome-card under">
                <div class="outcome-label">Under</div>
                <div class="outcome-percentage">{{ currentGameOutcomes.total.underPercentage }}%</div>
                <div class="outcome-count">{{ currentGameOutcomes.total.underCount }} games</div>
              </div>
            </div>
            <div v-else class="no-data">
              <p>No data yet.</p>
            </div>
            <div class="total-games">
              Total: {{ currentGameOutcomes?.total?.totalGames || 0 }}
            </div>
          </div>

          <!-- Spread Statistics -->
          <div class="outcome-section">
            <h5 class="centered-header">Spread</h5>
            <div v-if="currentGameOutcomes?.spread?.totalGames > 0" class="outcome-stats">
              <div class="outcome-card" :class="{
                'covered': parseFloat(currentGameOutcomes.spread.coveredPercentage || '0') > 50,
                'covered-low': parseFloat(currentGameOutcomes.spread.coveredPercentage || '0') <= 50 && parseFloat(currentGameOutcomes.spread.coveredPercentage || '0') > 0,
                'covered-zero': parseFloat(currentGameOutcomes.spread.coveredPercentage || '0') === 0
              }">
                <div class="outcome-label">Covered</div>
                <div class="outcome-percentage">{{ currentGameOutcomes.spread.coveredPercentage || '0.0' }}%</div>
                <div class="outcome-count">{{ currentGameOutcomes.spread.coveredCount }} games</div>
              </div>
            </div>
            <div v-else class="no-data">
              <p>No data yet.</p>
            </div>
            <div class="total-games">
              Total: {{ currentGameOutcomes?.spread?.totalGames || 0 }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'

export default {
  name: 'AdvancedStats',
  props: {
    username: {
      type: String,
      required: false,
      default: null
    }
  },
  setup(props) {
    const loading = ref(true)
    const error = ref(null)
    const stats = ref(null)
    const selectedSport = ref('all')

    const fetchStats = async () => {
      if (!props.username) return
      
      loading.value = true
      error.value = null

      try {
        const response = await axios.get(`${API_BASE_URL}/user/${props.username}/advanced-stats`)
        stats.value = response.data
      } catch (err) {
        console.error('Error fetching advanced stats:', err)
        error.value = err.response?.data?.error || 'Failed to load advanced statistics'
      } finally {
        loading.value = false
      }
    }

    const formatBetType = (betType) => {
      const types = {
        moneyline: 'Moneyline',
        spread: 'Point Spread',
        total: 'Over/Under'
      }
      return types[betType] || betType
    }

    const formatSportName = (sport) => {
      const names = {
        'nfl': 'NFL',
        'nba': 'NBA',
        'ncaa-football': 'NCAA Football',
        'ncaa-basketball': 'NCAA Basketball'
      }
      return names[sport] || sport
    }

    const currentWinPercentageByType = computed(() => {
      if (!stats.value?.winPercentageByTypeBySport) return stats.value?.winPercentageByType || {}
      const sportKey = selectedSport.value === 'all' ? 'all' : selectedSport.value
      return stats.value.winPercentageByTypeBySport[sportKey] || stats.value.winPercentageByType || {}
    })

    const currentGameOutcomes = computed(() => {
      if (!stats.value?.gameOutcomes) return null
      const sportKey = selectedSport.value === 'all' ? 'all' : selectedSport.value
      return stats.value.gameOutcomes[sportKey] || null
    })

    const onSportChange = () => {
      // Sport filter changed, computed property will update automatically
    }

    onMounted(() => {
      fetchStats()
    })

    return {
      loading,
      error,
      stats,
      selectedSport,
      currentWinPercentageByType,
      currentGameOutcomes,
      fetchStats,
      formatBetType,
      formatSportName,
      onSportChange
    }
  }
}
</script>

<style scoped>
.advanced-stats {
  padding: 1rem 0;
}

.loading-container {
  text-align: center;
  padding: 3rem 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top: 4px solid #2563eb;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  text-align: center;
  padding: 2rem;
  background: #fef2f2;
  border: 1px solid #fee2e2;
  border-radius: 8px;
  color: #991b1b;
}

.retry-btn {
  margin-top: 1rem;
  padding: 0.5rem 1.5rem;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.retry-btn:hover {
  background: #1d4ed8;
}

.stats-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.global-filter {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.global-filter label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 600;
}

.sport-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  font-size: 0.875rem;
  color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.sport-select:hover {
  border-color: #9ca3af;
}

.sport-select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.stats-section {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
}

.stats-section h4 {
  margin: 0 0 1rem 0;
  color: #1a1a1a;
  font-size: 1.25rem;
  font-weight: 700;
}

.section-description {
  margin: 0 0 1.5rem 0;
  color: #6b7280;
  font-size: 0.875rem;
}

.subsection-description {
  margin: 0 0 1rem 0;
  color: #9ca3af;
  font-size: 0.8125rem;
  font-style: italic;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
}

.stat-header {
  margin-bottom: 1rem;
}

.bet-type-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 2rem;
  font-weight: 800;
  margin-bottom: 1rem;
  color: #1a1a1a;
}

.stat-value.positive {
  color: #059669;
}

.stat-value.negative {
  color: #dc2626;
}

.stat-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.stat-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-detail .label {
  color: #6b7280;
}

.stat-detail .value {
  font-weight: 600;
  color: #1a1a1a;
}

.stat-detail .value.positive {
  color: #059669;
}

.stat-detail .value.negative {
  color: #dc2626;
}

.outcomes-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-top: 1.5rem;
}

.outcome-section {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.outcome-section h5 {
  margin: 0 0 1rem 0;
  color: #374151;
  font-size: 1.1rem;
  font-weight: 600;
}

.outcome-section h5.centered-header {
  text-align: center;
}

.outcome-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.outcome-card {
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
  transition: transform 0.2s ease;
}

.outcome-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.outcome-card.over {
  border-color: #059669;
  background: #ecfdf5;
}

.outcome-card.under {
  border-color: #dc2626;
  background: #fef2f2;
}

.outcome-card.covered {
  border-color: #059669;
  background: #ecfdf5;
}

.outcome-card.covered-low {
  border-color: #f59e0b;
  background: #fffbeb;
}

.outcome-card.covered-zero {
  border-color: #e5e7eb;
  background: #f9fafb;
}

.outcome-card.push {
  border-color: #6366f1;
  background: #eef2ff;
}

.outcome-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.5rem;
}

.outcome-percentage {
  font-size: 2rem;
  font-weight: 800;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
}

.outcome-card.over .outcome-percentage {
  color: #059669;
}

.outcome-card.under .outcome-percentage {
  color: #dc2626;
}

.outcome-card.covered .outcome-percentage {
  color: #059669;
}

.outcome-card.covered-low .outcome-percentage {
  color: #f59e0b;
}

.outcome-card.covered-zero .outcome-percentage {
  color: #6b7280;
}

.outcome-count {
  font-size: 0.875rem;
  color: #6b7280;
}

.no-data {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.total-games {
  text-align: center;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 600;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .outcome-stats {
    grid-template-columns: 1fr;
  }

  .stats-section {
    padding: 1rem;
  }
}
</style>
