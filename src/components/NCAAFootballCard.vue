<template>
  <div class="game-card" :class="{ collapsed: isCollapsed }">
    <div class="game-header">
      <div class="game-info">
        <h3 class="game-title">{{ game.name.replace(' at ', ' @ ') }}</h3>
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
          <span v-if="competitor.curatedRank && competitor.curatedRank.current <= 25" class="team-rank-small">
            #{{ competitor.curatedRank.current }}
          </span>
        </span>
        <span class="score-medium" :class="{ 'winning-score': isWinning(competitor) }">{{ competitor.score || '0' }}</span>
      </div>
      <!-- Show if betting options are available -->
      <div v-if="betting && gameScheduled" class="odds-indicator" @click="toggleCollapsed">
        ✓ Odds Available - Click to expand
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
              <div class="team-rank" v-if="competitor.curatedRank && competitor.curatedRank.current <= 25">
                #{{ competitor.curatedRank.current }}
              </div>
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

      <div class="game-details" v-if="gameInProgress">
        <div class="situation" v-if="situation">
          <div class="down-distance">
            {{ situation.downDistanceText || `${situation.down}${getOrdinalSuffix(situation.down)} & ${situation.distance}` }}
          </div>
          <div class="possession">
            {{ situation.possessionText }}
          </div>
        </div>
        <div class="last-play" v-if="situation?.lastPlay">
          <strong>Last Play:</strong> {{ situation.lastPlay.text }}
        </div>
      </div>

      <!-- Betting Information - Only show for scheduled games -->
      <div class="betting-info" v-if="betting && !isCollapsed && gameScheduled">
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
        <BettingInterface :game="game" :betting="betting" :sport="sport" />
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
import { computed, ref, onMounted } from 'vue'
import BettingInterface from './BettingInterface.vue'
import oddsService from '../services/oddsService.js'
import { convertToLocalTime, formatRelativeTime } from '../utils/timezoneUtils.js'

export default {
  name: 'NCAAFootballCard',
  components: {
    BettingInterface
  },
  props: {
    game: {
      type: Object,
      required: true
    },
    sport: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const isCollapsed = ref(true)
    const gameOdds = ref(null)
    const competition = computed(() => props.game.competitions?.[0])
    const competitors = computed(() => competition.value?.competitors || [])
    const venue = computed(() => competition.value?.venue?.fullName || 'TBD')
    const broadcast = computed(() => competition.value?.broadcast || competition.value?.broadcasts?.[0]?.names?.[0])
    const situation = computed(() => competition.value?.situation)
    const status = computed(() => competition.value?.status)
    
    // Get team names for odds matching
    const homeTeamName = computed(() => {
      const homeTeam = competitors.value.find(c => c.homeAway === 'home')
      return homeTeam ? homeTeam.team.shortDisplayName : ''
    })
    
    const awayTeamName = computed(() => {
      const awayTeam = competitors.value.find(c => c.homeAway === 'away')
      return awayTeam ? awayTeam.team.shortDisplayName : ''
    })
    
    // Fetch odds from odds service
    const fetchGameOdds = async () => {
      try {
        const allOdds = await oddsService.getAllOdds()
        const gameOddsData = oddsService.findGameOdds(allOdds, 'ncaa-football', homeTeamName.value, awayTeamName.value)
        
        if (gameOddsData) {
          gameOdds.value = gameOddsData
        }
      } catch (error) {
        console.error('Error fetching game odds:', error)
      }
    }
    
    // Convert odds data to betting format
    const betting = computed(() => {
      if (!gameOdds.value) {
        return null
      }
      
      return oddsService.convertOddsToBettingFormat(
        gameOdds.value,
        homeTeamName.value,
        awayTeamName.value
      )
    })
    
    onMounted(() => {
      fetchGameOdds()
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
        const time = status.value.displayClock || '0:00'
        const period = status.value.period || 1
        
        // Check for halftime (0:00 or 0.0 in 2nd quarter)
        if ((time === '0:00' || time === '0.0') && period === 2) {
          return 'Halftime'
        }
        
        return `${time} - ${period}${getOrdinalSuffix(period)}`
      }
      // Convert scheduled game time to user's local timezone
      const shortDetail = status.value?.type?.shortDetail
      if (shortDetail && shortDetail.includes('PM') || shortDetail?.includes('AM')) {
        return formatRelativeTime(shortDetail)
      }
      return shortDetail || 'Scheduled'
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
      const isWinningTeam = isWinning(competitor)
      
      return {
        '--team-primary-color': primaryColor,
        '--team-alternate-color': alternateColor,
        'border-left': `4px solid ${primaryColor}`,
        'background': `linear-gradient(90deg, ${primaryColor}15 0%, transparent 100%)`,
        'box-shadow': isWinningTeam ? `0 0 0 2px ${primaryColor}` : 'none'
      }
    }

    return {
      isCollapsed,
      competitors,
      venue,
      broadcast,
      situation,
      betting,
      gameInProgress,
      gameCompleted,
      gameScheduled,
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
/* Team Color Integration */
.team {
  transition: all 0.3s ease;
}

.team:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.team-name {
  color: var(--team-primary-color, #1a1a1a);
  font-weight: 700;
}
.score {
  color: var(--team-primary-color, #1a1a1a);
}

.odds-indicator {
  text-align: center;
  margin-top: 8px;
  font-size: 12px;
  color: #059669;
  font-weight: 500;
  cursor: pointer;
}

</style>
