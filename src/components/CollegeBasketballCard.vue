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
        <div v-if="hasBets" class="bet-indicator" @click="openBetsModal">
          <span class="bet-badge">{{ betCount }} bet{{ betCount > 1 ? 's' : '' }}</span>
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

      <!-- Live Game State -->
      <div class="live-game-state" v-if="gameInProgress">
        <div class="game-clock">
          <div class="clock-display">
            <span class="time">{{ displayTime }}</span>
            <span class="quarter" v-if="displayPeriod">{{ displayPeriod }}</span>
          </div>
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
                
        <!-- Ask AI Button -->
        <button 
          v-if="betting && gameScheduled && FEATURES.SHOW_AI_CHAT" 
          @click="handleAskAI" 
          class="ask-ai-button"
        >
          Get help understanding these betting lines from AI
        </button>
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
    
    <!-- Game Bets Modal -->
    <GameBetsModal 
      :is-open="showBetsModal" 
      :bets="gameBets" 
      @close="closeBetsModal" 
    />
  </div>
</template>

<script>
import { computed, ref, onMounted, watch } from 'vue'
import BettingInterface from './BettingInterface.vue'
import GameBetsModal from './GameBetsModal.vue'
import oddsService from '../services/oddsService.js'
import { convertToLocalTime, formatRelativeTime } from '../utils/timezoneUtils.js'
import { useChatWidget } from '../composables/useChatWidget.js'
import { FEATURES } from '../config/features.js'
import { useUserStore } from '../stores/userStore.js'

export default {
  name: 'CollegeBasketballCard',
  components: {
    BettingInterface,
    GameBetsModal
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
    const userStore = useUserStore()
    const isCollapsed = ref(true)
    const gameOdds = ref(null)
    const showBetsModal = ref(false)
    const competition = computed(() => props.game.competitions?.[0])
    const competitors = computed(() => competition.value?.competitors || [])
    const venue = computed(() => competition.value?.venue?.fullName || 'TBD')
    const broadcast = computed(() => competition.value?.broadcast || competition.value?.broadcasts?.[0]?.names?.[0])
    const status = computed(() => competition.value?.status)
    
    // Check if user has bets on this game
    const gameBets = computed(() => {
      if (!userStore.currentUser.value?.bets) return []
      return userStore.currentUser.value.bets.filter(bet => bet.gameId === props.game.id)
    })
    
    const hasBets = computed(() => gameBets.value.length > 0)
    const betCount = computed(() => gameBets.value.length)
    
    const openBetsModal = () => {
      showBetsModal.value = true
    }
    
    const closeBetsModal = () => {
      showBetsModal.value = false
    }
    
    // Get team names for odds matching
    const homeTeamName = computed(() => {
      const homeTeam = competitors.value.find(c => c.homeAway === 'home')
      return homeTeam ? homeTeam.team.shortDisplayName : ''
    })
    
    const awayTeamName = computed(() => {
      const awayTeam = competitors.value.find(c => c.homeAway === 'away')
      return awayTeam ? awayTeam.team.shortDisplayName : ''
    })
    
    // Convert ESPN odds format to betting format
    const convertESPNOddsToBettingFormat = (espnOdds) => {
      if (!espnOdds) return null
      
      const betting = {}
      
      // Point Spread
      if (espnOdds.pointSpread) {
        betting.pointSpread = {
          home: {
            close: {
              line: espnOdds.pointSpread.home.close.line,
              odds: espnOdds.pointSpread.home.close.odds
            }
          },
          away: {
            close: {
              line: espnOdds.pointSpread.away.close.line,
              odds: espnOdds.pointSpread.away.close.odds
            }
          }
        }
      }
      
      // Moneyline
      if (espnOdds.moneyline) {
        betting.moneyline = {
          home: {
            close: {
              odds: espnOdds.moneyline.home.close.odds
            }
          },
          away: {
            close: {
              odds: espnOdds.moneyline.away.close.odds
            }
          }
        }
      }
      
      // Total (Over/Under)
      if (espnOdds.total) {
        betting.total = {
          over: {
            close: {
              line: espnOdds.total.over.close.line,
              odds: espnOdds.total.over.close.odds
            }
          },
          under: {
            close: {
              line: espnOdds.total.under.close.line,
              odds: espnOdds.total.under.close.odds
            }
          }
        }
      }
      
      return Object.keys(betting).length > 0 ? betting : null
    }
    
    // Fetch odds from odds service first, fall back to ESPN embedded odds
    const fetchGameOdds = async () => {
      // First, try external odds service
      try {
        const allOdds = await oddsService.getAllOdds()
        
        // Try matching with shortDisplayName first
        let gameOddsData = oddsService.findGameOdds(allOdds, 'ncaa-basketball', homeTeamName.value, awayTeamName.value)
        
        // If no match, try with displayName as fallback
        if (!gameOddsData) {
          const homeTeam = competitors.value.find(c => c.homeAway === 'home')
          const awayTeam = competitors.value.find(c => c.homeAway === 'away')
          const homeDisplayName = homeTeam?.team?.displayName || ''
          const awayDisplayName = awayTeam?.team?.displayName || ''
          
          if (homeDisplayName && awayDisplayName && 
              (homeDisplayName !== homeTeamName.value || awayDisplayName !== awayTeamName.value)) {
            gameOddsData = oddsService.findGameOdds(allOdds, 'ncaa-basketball', homeDisplayName, awayDisplayName)
          }
        }
        if (gameOddsData) {
          gameOdds.value = gameOddsData
          return
        }
      } catch (error) {
        console.error('Error fetching game odds from service:', error)
      }
      
      // Fall back to embedded odds in game data (ESPN format)
      const embeddedOdds = competition.value?.odds?.[0]
      if (embeddedOdds) {
        const convertedOdds = convertESPNOddsToBettingFormat(embeddedOdds)
        if (convertedOdds) {
          gameOdds.value = { type: 'espn', betting: convertedOdds }
        }
      }
    }
    
    // Convert odds data to betting format
    const betting = computed(() => {
      if (!gameOdds.value) return null
      
      // If odds are from ESPN (embedded), use the already converted format
      if (gameOdds.value.type === 'espn') {
        return gameOdds.value.betting
      }
      
      // Otherwise, convert from external odds service format
      return oddsService.convertOddsToBettingFormat(
        gameOdds.value,
        homeTeamName.value,
        awayTeamName.value
      )
    })
    
    onMounted(() => {
      fetchGameOdds()
    })
    
    // Watch for changes in game data (especially for embedded odds)
    watch(() => props.game.competitions?.[0]?.odds, () => {
      fetchGameOdds()
    }, { deep: true })
    
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
        
        // Check for halftime (0:00 in 1st half for college basketball - 2 halves total)
        if ((time === '0:00' || time === '0.0') && period === 1) {
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

    // Computed properties for live game display
    const displayTime = computed(() => {
      if (!gameInProgress.value) return ''
      const time = status.value.displayClock || '0:00'
      const period = status.value.period || 1
      
      // Show "Halftime" when time is 0:00 in 1st half (college basketball has 2 halves)
      if ((time === '0:00' || time === '0.0') && period === 1) {
        return 'Halftime'
      }
      
      return time
    })

    const displayPeriod = computed(() => {
      if (!gameInProgress.value) return ''
      const time = status.value.displayClock || '0:00'
      const period = status.value.period || 1
      
      // Don't show period label during halftime
      if ((time === '0:00' || time === '0.0') && period === 1) {
        return ''
      }
      
      return `${period}${getOrdinalSuffix(period)} Half`
    })

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

    // Get the openChatWithGame method from the composable
    const { openChatWithGame } = useChatWidget()

    const handleAskAI = () => {
      const homeTeam = getHomeTeamName()
      const awayTeam = getAwayTeamName()
      openChatWithGame('ncaa-basketball', homeTeam, awayTeam, props.game.id)
    }

    return {
      isCollapsed,
      competitors,
      venue,
      broadcast,
      betting,
      gameInProgress,
      gameCompleted,
      gameScheduled,
      status,
      statusClass,
      statusText,
      displayTime,
      displayPeriod,
      getRecord,
      getOrdinalSuffix,
      toggleCollapsed,
      getFavoriteTeam,
      getSpreadLine,
      getSpreadOdds,
      getHomeTeamName,
      getAwayTeamName,
      isWinning,
      getTeamStyle,
      handleAskAI,
      FEATURES,
      hasBets,
      betCount,
      gameBets,
      showBetsModal,
      openBetsModal,
      closeBetsModal
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

.odds-indicator {
  text-align: center;
  margin-top: 8px;
  font-size: 12px;
  color: #059669;
  font-weight: 500;
  cursor: pointer;
}

.ask-ai-button {
  width: 100%;
  margin-top: 12px;
  padding: 10px 16px;
  background: #4169e1;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.ask-ai-button:hover {
  background: #3151c7;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(65, 105, 225, 0.3);
}

.ask-ai-button:active {
  transform: translateY(0);
}

.bet-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.bet-indicator:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.bet-badge {
  background: transparent;
  color: white;
  font-weight: 700;
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.bet-icon {
  font-size: 0.9rem;
}

</style>
