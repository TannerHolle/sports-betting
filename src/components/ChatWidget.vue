<template>
  <div class="chat-widget-container">
    <!-- Persistent Toggle Button (Bottom Right) -->
    <button 
      v-if="!isOpen"
      class="chat-toggle-button"
      @click="toggleChat"
      aria-label="Open chat"
    >
      <img src="../assets/icons/ai-icon.png" alt="AI Assistant" class="ai-icon" />
    </button>

    <!-- Chat Widget -->
    <transition name="chat-widget">
      <div v-if="isOpen" class="chat-widget">
        <!-- Chat Header -->
        <div class="chat-widget-header">
          <div class="header-content">
            <div class="header-icon">🤖</div>
            <div class="header-text">
              <h3>Betting Assistant</h3>
            </div>
          </div>
          <button 
            class="header-close-button"
            @click="toggleChat"
            aria-label="Close chat"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
            </svg>
          </button>
        </div>

        <!-- League and Game Selectors -->
        <div class="game-selector-container" v-if="availableGames.length > 0">
          <div class="selectors-row">
            <!-- League Selector -->
            <div class="selector-group league-selector-group">
              <label class="game-selector-label">
                <span>Select a league:</span>
              </label>
              <select
                v-model="selectedLeague"
                class="game-selector"
                @change="onLeagueChange"
              >
                <option value="">All leagues</option>
                <option
                  v-for="sport in sports"
                  :key="sport.id"
                  :value="sport.id"
                >
                  {{ sport.name }}
                </option>
              </select>
            </div>

            <!-- Game Selector -->
            <div class="selector-group game-selector-group">
              <label class="game-selector-label">
                <span>Select a game:</span>
              </label>
              <select
                v-model="selectedGameId"
                class="game-selector"
                @change="onGameChange"
                :disabled="!selectedLeague"
              >
                <option value="">No game selected</option>
                <option
                  v-for="game in filteredGames"
                  :key="game.id"
                  :value="game.id"
                >
                  {{ game.awayTeam }} @ {{ game.homeTeam }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <!-- Chat Messages -->
        <div class="chat-widget-messages" ref="messagesContainer">
          <div v-if="messages.length === 0 && !selectedGameContext" class="welcome-message">
            <p class="welcome-text">I'm an AI bot that's here to help! Select a game above to get personalized insights, or feel free to ask me general questions about sports betting without the need to select a game.</p>
            <div class="suggested-actions">
              <button class="action-button" @click="sendSuggestedMessage('How do I read betting odds?')">
                <span class="action-icon">💬</span>
                <span>Learn about odds</span>
              </button>
              <button class="action-button" @click="sendSuggestedMessage('What types of bets can I make on this app?')">
                <span class="action-icon">📊</span>
                <span>Bet types</span>
              </button>
              <button class="action-button" @click="sendSuggestedMessage('What is expected value in betting?')">
                <span class="action-icon">📈</span>
                <span>Betting strategy</span>
              </button>
            </div>
          </div>
          
          <div v-if="messages.length === 0 && selectedGameContext" class="game-welcome-message">
            <p class="welcome-text">I'm ready to help you with <strong>{{ selectedGameContext.awayTeam }} @ {{ selectedGameContext.homeTeam }}</strong>!</p>
            <p class="welcome-subtext">Ask me anything about the betting odds for this game - recommendations, analysis, or how to interpret the lines.</p>
          </div>

          <div
            v-for="(message, index) in messages"
            :key="index"
            :class="['message', message.type]"
          >
            <div class="message-avatar" v-if="message.type === 'assistant'">
              <span>🤖</span>
            </div>
            <div class="message-avatar user-avatar" v-if="message.type === 'user'">
              <span class="avatar-text">{{ currentUser?.username ? currentUser.username.charAt(0).toUpperCase() : 'U' }}</span>
            </div>
            <div class="message-content">
              <div class="message-text" v-html="formatMessage(message.text)"></div>
              <div class="message-time">{{ formatTime(message.timestamp) }}</div>
            </div>
          </div>

          <div v-if="isLoading" class="message assistant loading">
            <div class="message-avatar">
              <span>🤖</span>
            </div>
            <div class="message-content">
              <div class="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Chat Input -->
        <div class="chat-widget-input-container">
          <form @submit.prevent="sendMessage" class="chat-form">
            <input
              v-model="currentQuestion"
              type="text"
              :placeholder="selectedGameContext ? `Ask about ${selectedGameContext.awayTeam} @ ${selectedGameContext.homeTeam}...` : 'Ask me anything...'"
              class="chat-input"
              :disabled="isLoading"
              ref="chatInput"
            />
            <button
              type="submit"
              class="send-button"
              :disabled="isLoading || !currentQuestion.trim()"
            >
              <svg v-if="!isLoading" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <div v-else class="spinner"></div>
            </button>
          </form>
          <p class="ai-disclaimer">AI-generated content may be inaccurate.</p>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { ref, nextTick, watch, computed, onMounted } from 'vue'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'
import { useUserStore } from '../stores/userStore.js'
import oddsService from '../services/oddsService.js'
import { useChatWidget } from '../composables/useChatWidget.js'

export default {
  name: 'ChatWidget',
  setup() {
    const userStore = useUserStore()
    const currentUser = computed(() => userStore.currentUser.value)
    const isOpen = ref(false)
    const messages = ref([])
    const currentQuestion = ref('')
    const isLoading = ref(false)
    const messagesContainer = ref(null)
    const chatInput = ref(null)
    const availableGames = ref([])
    const loadingGames = ref(false)
    const selectedLeague = ref('')
    const selectedGameId = ref('')
    const selectedGameContext = ref(null)

    // Filter games by selected league
    const filteredGames = computed(() => {
      if (!selectedLeague.value) {
        return []
      }
      return availableGames.value.filter(game => game.sport === selectedLeague.value)
    })

    // Sports configuration
    const sports = [
      {
        id: 'nba',
        name: 'NBA',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard'
      },
      {
        id: 'nfl',
        name: 'NFL',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
      },
      {
        id: 'ncaa-basketball',
        name: 'NCAA Basketball',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'
      },
      {
        id: 'ncaa-football',
        name: 'NCAA Football',
        apiUrl: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard'
      }
    ]

    // Format date for ESPN API (YYYYMMDD)
    const formatDateForAPI = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}${month}${day}`
    }


    // Fetch available games with odds
    const fetchAvailableGames = async () => {
      if (loadingGames.value) return
      loadingGames.value = true

      try {
        // Fetch all odds first
        const allOdds = await oddsService.getAllOdds()

        // Fetch games for today and tomorrow from all sports
        const today = new Date()
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const todayFormatted = formatDateForAPI(today)
        const tomorrowFormatted = formatDateForAPI(tomorrow)
        
        const gamesPromises = sports.map(async (sport) => {
          try {
            let allGames = []
            
            // Fetch today's games
            let apiUrl = sport.apiUrl
            if (sport.id === 'nba' || sport.id === 'ncaa-basketball' || sport.id === 'ncaa-football') {
              apiUrl = `${sport.apiUrl}?dates=${todayFormatted}`
            }
            const todayResponse = await axios.get(apiUrl)
            allGames = allGames.concat(todayResponse.data.events || [])
            
            // Also fetch tomorrow's games for sports that need date filtering
            if (sport.id === 'nba' || sport.id === 'ncaa-basketball' || sport.id === 'ncaa-football') {
              const tomorrowApiUrl = `${sport.apiUrl}?dates=${tomorrowFormatted}`
              try {
                const tomorrowResponse = await axios.get(tomorrowApiUrl)
                allGames = allGames.concat(tomorrowResponse.data.events || [])
              } catch (err) {
                // If tomorrow's games fail, continue with today's
                console.warn(`Failed to fetch tomorrow's games for ${sport.name}:`, err)
              }
            }
            
            const games = allGames

            // Filter for scheduled games that have odds available
            return games
              .filter(game => {
                const competition = game.competitions?.[0]
                const status = competition?.status
                const isScheduled = status?.type?.state === 'pre'
                if (!isScheduled) return false

                const competitors = competition.competitors || []
                const homeTeam = competitors.find(c => c.homeAway === 'home')
                const awayTeam = competitors.find(c => c.homeAway === 'away')

                if (!homeTeam || !awayTeam) return false

                const homeTeamName = homeTeam.team?.shortDisplayName || homeTeam.team?.displayName || ''
                const awayTeamName = awayTeam.team?.shortDisplayName || awayTeam.team?.displayName || ''
                const sportId = sport.id

                // Only include games that have odds
                const gameOdds = oddsService.findGameOdds(allOdds, sportId, homeTeamName, awayTeamName)
                return !!gameOdds
              })
              .map(game => {
                const competition = game.competitions?.[0]
                const competitors = competition.competitors || []
                const homeTeam = competitors.find(c => c.homeAway === 'home')
                const awayTeam = competitors.find(c => c.homeAway === 'away')
                const homeTeamName = homeTeam.team?.shortDisplayName || homeTeam.team?.displayName || ''
                const awayTeamName = awayTeam.team?.shortDisplayName || awayTeam.team?.displayName || ''

                // Use the sport from the API call (we're already iterating through sports)
                const sportId = sport.id

                // Find odds (we know it exists from the filter above)
                const gameOdds = oddsService.findGameOdds(allOdds, sportId, homeTeamName, awayTeamName)

                return {
                  id: game.id,
                  sport: sportId,
                  homeTeam: homeTeamName,
                  awayTeam: awayTeamName,
                  gameData: game,
                  gameOdds
                }
              })
          } catch (error) {
            console.error(`Error fetching games for ${sport.name}:`, error)
            return []
          }
        })

        const allGamesArrays = await Promise.all(gamesPromises)
        // Flatten all games and deduplicate by game ID
        const allGames = allGamesArrays.flat()
        const uniqueGames = []
        const seenGameIds = new Set()
        
        for (const game of allGames) {
          if (!seenGameIds.has(game.id)) {
            seenGameIds.add(game.id)
            uniqueGames.push(game)
          }
        }
        
        // Include all games - no limit since we're filtering by league now
        availableGames.value = uniqueGames
        console.log(`[ChatWidget] Loaded ${uniqueGames.length} unique games across all sports`)
      } catch (error) {
        console.error('Error fetching available games:', error)
        availableGames.value = []
      } finally {
        loadingGames.value = false
      }
    }

    // Format game data for AI context
    const formatGameForContext = (game) => {
      const competition = game.gameData?.competitions?.[0]
      if (!competition) return null

      const competitors = competition.competitors || []
      const homeTeam = competitors.find(c => c.homeAway === 'home')
      const awayTeam = competitors.find(c => c.homeAway === 'away')

      if (!homeTeam || !awayTeam) return null

      const context = {
        gameId: game.id,
        sport: game.sport,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        commenceTime: game.gameData?.date || competition.date,
        venue: competition.venue?.fullName || null,
        status: competition.status?.type?.shortDetail || 'Scheduled'
      }

      // Add odds if available
      if (game.gameOdds && game.gameOdds.odds) {
        const actualHomeTeam = game.gameOdds.homeTeam
        const actualAwayTeam = game.gameOdds.awayTeam

        context.odds = {}

        // Moneyline
        const homeMoneylineKey = `${actualHomeTeam}_moneyline`
        const awayMoneylineKey = `${actualAwayTeam}_moneyline`
        if (game.gameOdds.odds[homeMoneylineKey]) {
          context.odds.homeMoneyline = game.gameOdds.odds[homeMoneylineKey]
        }
        if (game.gameOdds.odds[awayMoneylineKey]) {
          context.odds.awayMoneyline = game.gameOdds.odds[awayMoneylineKey]
        }

        // Spread
        const homeSpreadKey = `${actualHomeTeam}_spread`
        const awaySpreadKey = `${actualAwayTeam}_spread`
        if (game.gameOdds.odds[homeSpreadKey]) {
          context.odds.homeSpread = game.gameOdds.odds[homeSpreadKey]
        }
        if (game.gameOdds.odds[awaySpreadKey]) {
          context.odds.awaySpread = game.gameOdds.odds[awaySpreadKey]
        }

        // Totals
        if (game.gameOdds.odds['Over_total']) {
          context.odds.overTotal = game.gameOdds.odds['Over_total']
        }
        if (game.gameOdds.odds['Under_total']) {
          context.odds.underTotal = game.gameOdds.odds['Under_total']
        }
      }

      return context
    }

    const onLeagueChange = () => {
      // Clear game selection when league changes
      selectedGameId.value = ''
      selectedGameContext.value = null
    }

    const onGameChange = () => {
      if (!selectedGameId.value) {
        selectedGameContext.value = null
        return
      }

      const selectedGame = filteredGames.value.find(g => g.id === selectedGameId.value)
      if (selectedGame) {
        selectedGameContext.value = formatGameForContext(selectedGame)
      }
    }

    const toggleChat = () => {
      if (isOpen.value) {
        // Closing the chat - clear messages and reset
        messages.value = []
        currentQuestion.value = ''
        isLoading.value = false
        selectedLeague.value = ''
        selectedGameId.value = ''
        selectedGameContext.value = null
      } else {
        // Opening the chat - fetch available games
        fetchAvailableGames()
      }
      isOpen.value = !isOpen.value
      if (isOpen.value) {
        nextTick(() => {
          scrollToBottom()
          if (chatInput.value) {
            chatInput.value.focus()
          }
        })
      }
    }

    // Method to open chat with a specific game pre-selected
    const openChatWithGame = async (sport, homeTeam, awayTeam, gameId = null) => {
      // If chat is not open, open it and fetch games
      if (!isOpen.value) {
        isOpen.value = true
        await fetchAvailableGames()
      }
      
      // Wait for games to be loaded
      await nextTick()
      
      // Set the league first
      selectedLeague.value = sport
      
      // Wait for filtered games to update
      await nextTick()
      
      // Find the matching game
      const matchingGame = filteredGames.value.find(game => {
        // Try to match by gameId first if provided
        if (gameId && game.id === gameId) {
          return true
        }
        // Otherwise match by team names
        return game.homeTeam === homeTeam && game.awayTeam === awayTeam
      })
      
      if (matchingGame) {
        selectedGameId.value = matchingGame.id
        selectedGameContext.value = formatGameForContext(matchingGame)
      }
      
      // Focus the input
      await nextTick()
      if (chatInput.value) {
        chatInput.value.focus()
      }
    }

    // Register the method globally so game cards can use it
    const { setOpenChatWithGame } = useChatWidget()
    onMounted(() => {
      setOpenChatWithGame(openChatWithGame)
    })

    const sendSuggestedMessage = (message) => {
      currentQuestion.value = message
      sendMessage()
    }

    const sendMessage = async () => {
      const question = currentQuestion.value.trim()
      if (!question || isLoading.value) return

      // Add user message
      const userMessage = {
        type: 'user',
        text: question,
        timestamp: new Date()
      }
      messages.value.push(userMessage)
      currentQuestion.value = ''
      isLoading.value = true

      // Scroll to bottom
      await nextTick()
      scrollToBottom()

      try {
        // Send selected game context if a game is selected, otherwise send null
        const response = await axios.post(`${API_BASE_URL}/ai/ask`, {
          question: question,
          gameContext: selectedGameContext.value
        })

        // Add assistant response
        const assistantMessage = {
          type: 'assistant',
          text: response.data.answer,
          timestamp: new Date()
        }
        messages.value.push(assistantMessage)
      } catch (error) {
        console.error('Error getting AI response:', error)
        const errorMessage = {
          type: 'assistant',
          text: error.response?.data?.error || 'Sorry, I encountered an error. Please try again later.',
          timestamp: new Date()
        }
        messages.value.push(errorMessage)
      } finally {
        isLoading.value = false
        await scrollToLastAssistantMessage()
        // Focus input after response
        if (chatInput.value) {
          chatInput.value.focus()
        }
      }
    }

    const scrollToBottom = () => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    }

    const scrollToLastAssistantMessage = async () => {
      if (messagesContainer.value) {
        await nextTick()
        // Find all message elements
        const allMessages = messagesContainer.value.querySelectorAll('.message')
        if (allMessages.length > 0) {
          // Find the last user message (which should be right before the assistant response)
          let lastUserMessage = null
          for (let i = allMessages.length - 1; i >= 0; i--) {
            if (allMessages[i].classList.contains('user')) {
              lastUserMessage = allMessages[i]
              break
            }
          }
          
          // If we found a user message, scroll to show it (which will also show the assistant message below)
          if (lastUserMessage) {
            lastUserMessage.scrollIntoView({ behavior: 'smooth', block: 'start' })
          } else {
            // Fallback: scroll to the last assistant message
            const assistantMessages = messagesContainer.value.querySelectorAll('.message.assistant')
            if (assistantMessages.length > 0) {
              assistantMessages[assistantMessages.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' })
            } else {
              scrollToBottom()
            }
          }
        } else {
          scrollToBottom()
        }
      }
    }

    const formatMessage = (text) => {
      // Convert markdown-style formatting to HTML
      return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>')
    }

    const formatTime = (timestamp) => {
      const date = new Date(timestamp)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    // Watch for messages changes to auto-scroll
    watch(() => messages.value.length, () => {
      nextTick(() => {
        // If the last message is from assistant, scroll to show its top
        // Otherwise, scroll to bottom for user messages
        if (messages.value.length > 0) {
          const lastMessage = messages.value[messages.value.length - 1]
          if (lastMessage.type === 'assistant') {
            scrollToLastAssistantMessage()
          } else {
            scrollToBottom()
          }
        }
      })
    })

    return {
      currentUser,
      isOpen,
      messages,
      currentQuestion,
      isLoading,
      messagesContainer,
      chatInput,
      selectedLeague,
      selectedGameId,
      selectedGameContext,
      filteredGames,
      availableGames,
      loadingGames,
      sports,
      toggleChat,
      openChatWithGame,
      sendMessage,
      sendSuggestedMessage,
      formatMessage,
      formatTime,
      onLeagueChange,
      onGameChange,
    }
  }
}
</script>

<style scoped>
.chat-widget-container {
  position: fixed;
  bottom: 0;
  right: 0;
  z-index: 1000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Toggle Button */
.chat-toggle-button {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #2d3748;
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  z-index: 1001;
}

.chat-toggle-button:hover {
  background: #1a202c;
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.chat-toggle-button:active {
  transform: scale(0.95);
}

.chat-toggle-button .ai-icon {
  width: 24px;
  height: 24px;
  display: block;
}

/* Chat Widget */
.chat-widget {
  position: fixed;
  bottom: 0;
  right: 24px;
  width: 380px;
  max-width: calc(100vw - 48px);
  height: 600px;
  max-height: calc(100vh - 24px);
  background: white;
  border-radius: 12px 12px 0 0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1000;
}

/* Chat Widget Animations */
.chat-widget-enter-active,
.chat-widget-leave-active {
  transition: all 0.3s ease;
}

.chat-widget-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.chat-widget-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

/* Chat Header */
.chat-widget-header {
  background: #2d3748;
  color: white;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.header-text h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: white;
}

.header-close-button {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
  flex-shrink: 0;
}

.header-close-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.header-close-button:active {
  background: rgba(255, 255, 255, 0.2);
}

/* Chat Messages */
.chat-widget-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: white;
}

/* Welcome Message */
.welcome-message {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.welcome-text {
  margin: 0;
  color: #374151;
  font-size: 14px;
  line-height: 1.5;
}

.welcome-subtext {
  margin: 8px 0 0 0;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.5;
}

.game-welcome-message {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.welcome-prompt {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
}

.suggested-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  color: #374151;
  transition: all 0.2s ease;
}

.action-button:hover {
  background: #e5e7eb;
  border-color: #d1d5db;
}

.action-icon {
  font-size: 18px;
}

/* Messages */
.message {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  animation: fadeIn 0.3s ease;
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
}

.message.user .message-avatar.user-avatar {
  background: linear-gradient(135deg, #4169e1 0%, #1e3a8a 100%);
}

.message.user .message-avatar.user-avatar .avatar-text {
  color: white;
  font-weight: 700;
  font-size: 0.875rem;
}

.message-content {
  flex: 1;
  max-width: 75%;
}

.message.user .message-content {
  text-align: right;
  flex: 0 1 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message-text {
  background: #f3f4f6;
  padding: 10px 14px;
  border-radius: 12px;
  line-height: 1.5;
  color: #1f2937;
  font-size: 14px;
  word-wrap: break-word;
  display: inline-block;
  max-width: 100%;
}

.message.user .message-text {
  background: #4169e1;
  color: white;
}

.message-time {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
  padding: 0 4px;
}

.message.user .message-time {
  text-align: right;
}

.loading-dots {
  display: flex;
  gap: 4px;
  padding: 10px 14px;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9ca3af;
  animation: bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.loading-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Chat Input */
.chat-widget-input-container {
  padding: 16px;
  border-top: 1px solid #e5e7eb;
  background: white;
  flex-shrink: 0;
}

/* Game Selector */
.game-selector-container {
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.selectors-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.selector-group {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.league-selector-group {
  flex: 0 0 auto;
  max-width: 140px;
}

.game-selector-group {
  flex: 1;
}

.game-selector-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 4px;
}

.game-selector {
  flex: 1;
  padding: 6px 28px 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 12px;
  background: white;
  color: #374151;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 10px;
  width: 100%;
  min-width: 0;
}

.game-selector:hover {
  border-color: #d1d5db;
}

.game-selector:focus {
  border-color: #4169e1;
  box-shadow: 0 0 0 3px rgba(65, 105, 225, 0.1);
}

.game-selector:disabled {
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}

.chat-form {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.chat-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
  background: white;
}

.chat-input:focus {
  border-color: #4169e1;
  box-shadow: 0 0 0 3px rgba(65, 105, 225, 0.1);
}

.chat-input:disabled {
  background: #f9fafb;
  cursor: not-allowed;
}

.send-button {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: none;
  background: #4169e1;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.send-button:hover:not(:disabled) {
  background: #3151c7;
  transform: translateY(-1px);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.ai-disclaimer {
  margin: 0;
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
}

/* Scrollbar styling */
.chat-widget-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-widget-messages::-webkit-scrollbar-track {
  background: #f9fafb;
}

.chat-widget-messages::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.chat-widget-messages::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Mobile Responsiveness */
@media (max-width: 480px) {
  .chat-widget {
    width: calc(100vw - 24px);
    right: 12px;
    bottom: 0;
    height: calc(100vh - 24px);
    max-height: calc(100vh - 24px);
    border-radius: 12px 12px 0 0;
  }

  .chat-toggle-button {
    bottom: 16px;
    right: 16px;
    width: 52px;
    height: 52px;
  }

  .message-content {
    max-width: 80%;
  }
}
</style>
