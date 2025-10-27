<template>
  <div class="game-card" :class="{ collapsed: isCollapsed }">
    <div class="game-header">
      <div class="game-info">
        <h3 class="game-title">{{ game.name }}</h3>
        <div class="game-meta">
          <span class="venue">{{ venue }}</span>
          <span class="broadcast" v-if="broadcast && !isCollapsed">{{ broadcast }}</span>
        </div>
      </div>
      <div class="game-header-right">
        <div class="game-status" :class="statusClass">
          {{ statusText }}
        </div>
        <button @click="toggleCollapsed" class="collapse-btn">
          {{ isCollapsed ? '▼' : '▲' }}
        </button>
      </div>
    </div>

    <!-- Collapsed view - just scores -->
    <div v-if="isCollapsed" class="collapsed-scores">
      <div class="collapsed-team" v-for="competitor in competitors" :key="competitor.id" :class="{ 'winning': isWinning(competitor) }">
        <img :src="competitor.team.logo" :alt="competitor.team.displayName" class="team-logo-tiny" />
        <span class="team-name-tiny">
          {{ competitor.team.shortDisplayName }}
        </span>
        <span class="score-medium" :class="{ 'winning-score': isWinning(competitor) }">{{ competitor.score || '0' }}</span>
      </div>
    </div>

    <!-- Expanded view -->
    <div v-else>
      <div class="teams">
        <div 
          v-for="competitor in competitors" 
          :key="competitor.id"
          class="team"
          :class="{ 
            'home': competitor.homeAway === 'home', 
            'away': competitor.homeAway === 'away',
            'winning': isWinning(competitor)
          }"
          :style="getTeamStyle(competitor)"
        >
          <div class="team-info">
            <img :src="competitor.team.logo" :alt="competitor.team.displayName" class="team-logo" />
            <div class="team-details">
              <div class="team-name">{{ competitor.team.shortDisplayName }}</div>
              <div class="team-record">{{ getRecord(competitor.records) }}</div>
            </div>
          </div>
          <div class="team-score">
            <div class="score" :class="{ 'winning-score': isWinning(competitor) }">{{ competitor.score || '0' }}</div>
            <div class="quarters" v-if="competitor.linescores && competitor.linescores.length > 0">
              <span 
                v-for="(quarter, index) in competitor.linescores" 
                :key="index"
                class="quarter-score"
              >
                {{ quarter.displayValue }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Live Game State -->
      <div class="live-game-state" v-if="gameInProgress">
        <div class="game-clock">
          <div class="clock-display">
            <span class="time">{{ status.displayClock || '0:00' }}</span>
            <span class="quarter">{{ status.period }}{{ getOrdinalSuffix(status.period) }} Quarter</span>
          </div>
        </div>
      </div>

      <!-- Betting Information -->
      <div class="betting-info" v-if="betting && !isCollapsed">
        <h4 class="betting-title">Betting Lines</h4>
        <div class="betting-lines">
          <div class="betting-line" v-if="betting.pointSpread">
            <span class="betting-label">Spread:</span>
            <span class="betting-value">
              <span class="favorite-team">{{ getFavoriteTeam() }}</span> {{ getSpreadLine() }} ({{ getSpreadOdds() }})
            </span>
          </div>
          <div class="betting-line" v-if="betting.total">
            <span class="betting-label">Total:</span>
            <span class="betting-value">
              {{ betting.total.over.close.line }} ({{ betting.total.over.close.odds }})
            </span>
          </div>
          <div class="betting-line" v-if="betting.moneyline">
            <span class="betting-label">Moneyline:</span>
            <span class="betting-value">
              <span class="moneyline-team">{{ getHomeTeamName() }} {{ betting.moneyline.home.close.odds }}</span> / 
              <span class="moneyline-team">{{ getAwayTeamName() }} {{ betting.moneyline.away.close.odds }}</span>
            </span>
          </div>
        </div>
        
        <!-- Betting Interface -->
        <BettingInterface :game="game" :betting="betting" />
      </div>

      <div class="game-actions">
        <a 
          v-for="link in game.links" 
          :key="link.rel.join('-')"
          :href="link.href" 
          target="_blank" 
          rel="noopener noreferrer"
          class="action-link"
        >
          {{ link.text }}
        </a>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref } from 'vue'
import BettingInterface from './BettingInterface.vue'

export default {
  name: 'NBAGameCard',
  components: {
    BettingInterface
  },
  props: {
    game: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const isCollapsed = ref(true)
    const competition = computed(() => props.game.competitions?.[0])
    const competitors = computed(() => competition.value?.competitors || [])
    const venue = computed(() => competition.value?.venue?.fullName || 'TBD')
    const broadcast = computed(() => competition.value?.broadcast || competition.value?.broadcasts?.[0]?.names?.[0])
    const status = computed(() => competition.value?.status)
    
    // Generate mock betting data for NBA games
    const betting = computed(() => {
      const homeTeam = competitors.value.find(c => c.homeAway === 'home')
      const awayTeam = competitors.value.find(c => c.homeAway === 'away')
      if (!homeTeam || !awayTeam) return null
      
      // Generate realistic NBA betting lines
      const homeScore = parseInt(homeTeam.score || 0)
      const awayScore = parseInt(awayTeam.score || 0)
      
      // Mock spread (home team typically favored by 1-7 points)
      const spread = Math.random() * 6 + 1
      const homeSpread = Math.random() > 0.5 ? -spread : spread
      const awaySpread = -homeSpread
      
      // Mock total (NBA games typically 200-250 points)
      const total = Math.floor(Math.random() * 50) + 200
      
      // Mock moneyline odds
      const homeOdds = Math.random() > 0.5 ? -110 : -120
      const awayOdds = Math.random() > 0.5 ? 110 : 120
      
      return {
        pointSpread: {
          home: {
            close: {
              line: homeSpread.toFixed(1),
              odds: homeOdds
            }
          },
          away: {
            close: {
              line: awaySpread.toFixed(1),
              odds: awayOdds
            }
          }
        },
        total: {
          over: {
            close: {
              line: total,
              odds: -110
            }
          },
          under: {
            close: {
              line: total,
              odds: -110
            }
          }
        },
        moneyline: {
          home: {
            close: {
              odds: homeOdds
            }
          },
          away: {
            close: {
              odds: awayOdds
            }
          }
        }
      }
    })
    
    const gameInProgress = computed(() => status.value?.type?.state === 'in')
    const gameCompleted = computed(() => status.value?.type?.completed)
    const gameScheduled = computed(() => status.value?.type?.state === 'pre')
    
    const statusClass = computed(() => {
      if (gameCompleted.value) return 'completed'
      if (gameInProgress.value) return 'in-progress'
      return 'scheduled'
    })
    
    const statusText = computed(() => {
      if (gameCompleted.value) return 'Final'
      if (gameInProgress.value) {
        return `${status.value.displayClock} - ${status.value.period}${getOrdinalSuffix(status.value.period)}`
      }
      return status.value?.type?.shortDetail || 'Scheduled'
    })

    const getRecord = (records) => {
      if (!records || !records.length) return ''
      const overall = records.find(r => r.type === 'total')
      return overall ? overall.summary : ''
    }

    const getOrdinalSuffix = (num) => {
      if (num >= 11 && num <= 13) return 'th'
      switch (num % 10) {
        case 1: return 'st'
        case 2: return 'nd'
        case 3: return 'rd'
        default: return 'th'
      }
    }

    const toggleCollapsed = () => {
      isCollapsed.value = !isCollapsed.value
    }

    const getFavoriteTeam = () => {
      if (!betting.value?.pointSpread) return ''
      const homeLine = parseFloat(betting.value.pointSpread.home.close.line)
      const awayLine = parseFloat(betting.value.pointSpread.away.close.line)
      
      if (homeLine < 0) {
        return getHomeTeamName() // Home team is favorite
      } else {
        return getAwayTeamName() // Away team is favorite
      }
    }

    const getSpreadLine = () => {
      if (!betting.value?.pointSpread) return ''
      const homeLine = betting.value.pointSpread.home.close.line
      const awayLine = betting.value.pointSpread.away.close.line
      
      // Return the line for the favorite (negative number)
      if (parseFloat(homeLine) < 0) {
        return homeLine
      } else {
        return awayLine
      }
    }

    const getSpreadOdds = () => {
      if (!betting.value?.pointSpread) return ''
      const homeLine = parseFloat(betting.value.pointSpread.home.close.line)
      
      if (homeLine < 0) {
        return betting.value.pointSpread.home.close.odds
      } else {
        return betting.value.pointSpread.away.close.odds
      }
    }

    const getHomeTeamName = () => {
      const homeTeam = competitors.value.find(c => c.homeAway === 'home')
      return homeTeam ? homeTeam.team.shortDisplayName : 'Home'
    }

    const getAwayTeamName = () => {
      const awayTeam = competitors.value.find(c => c.homeAway === 'away')
      return awayTeam ? awayTeam.team.shortDisplayName : 'Away'
    }

    const isWinning = (competitor) => {
      if (!competitors.value || competitors.value.length !== 2) return false
      
      const homeScore = parseInt(competitors.value.find(c => c.homeAway === 'home')?.score || '0')
      const awayScore = parseInt(competitors.value.find(c => c.homeAway === 'away')?.score || '0')
      const currentScore = parseInt(competitor.score || '0')
      
      // If scores are tied, no one is winning
      if (homeScore === awayScore) return false
      
      // Check if this competitor has the higher score
      return currentScore === Math.max(homeScore, awayScore)
    }

    const getTeamStyle = (competitor) => {
      if (!competitor.team?.color) return {}
      
      const primaryColor = `#${competitor.team.color}`
      const alternateColor = competitor.team.alternateColor ? `#${competitor.team.alternateColor}` : '#ffffff'
      
      return {
        '--team-primary-color': primaryColor,
        '--team-alternate-color': alternateColor,
        'border-left': `4px solid ${primaryColor}`,
        'background': `linear-gradient(90deg, ${primaryColor}15 0%, transparent 100%)`
      }
    }

    return {
      isCollapsed,
      competitors,
      venue,
      broadcast,
      betting,
      gameInProgress,
      status,
      statusClass,
      statusText,
      getRecord,
      getOrdinalSuffix,
      toggleCollapsed,
      getFavoriteTeam,
      getSpreadLine,
      getSpreadOdds,
      getHomeTeamName,
      getAwayTeamName,
      isWinning,
      getTeamStyle
    }
  }
}
</script>

<style scoped>
/* Live Game State Styles */
.live-game-state {
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  color: white;
  border: 1px solid #374151;
}

.game-clock {
  text-align: center;
  margin-bottom: 12px;
}

.clock-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.time {
  font-size: 2rem;
  font-weight: 700;
  color: #10b981;
  text-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
}

.quarter {
  font-size: 0.9rem;
  color: #9ca3af;
  font-weight: 500;
}

/* Team Color Integration */
.team {
  transition: all 0.3s ease;
}

.team:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.team.winning {
  box-shadow: 0 0 0 2px var(--team-primary-color, #10b981);
}

.team-name {
  color: var(--team-primary-color, #1a1a1a);
  font-weight: 700;
}

.score {
  color: var(--team-primary-color, #1a1a1a);
}
</style>
