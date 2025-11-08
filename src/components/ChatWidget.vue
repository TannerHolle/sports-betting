<template>
  <div class="chat-widget-container">
    <!-- Persistent Toggle Button (Bottom Right) -->
    <button 
      class="chat-toggle-button"
      @click="toggleChat"
      :aria-label="isOpen ? 'Close chat' : 'Open chat'"
    >
      <svg v-if="!isOpen" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H6L4 18V4H20V16Z" fill="currentColor"/>
        <path d="M7 9H17V11H7V9ZM7 12H14V14H7V12Z" fill="currentColor"/>
      </svg>
      <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
      </svg>
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
        </div>

        <!-- Chat Messages -->
        <div class="chat-widget-messages" ref="messagesContainer">
          <div v-if="messages.length === 0" class="welcome-message">
            <p class="welcome-text">Want to learn about sports betting? I'm an AI bot that's here to help! 😊</p>
            <p class="welcome-prompt">What would you like to do next?</p>
            <div class="suggested-actions">
              <button class="action-button" @click="sendSuggestedMessage('How do I read betting odds?')">
                <span class="action-icon">💬</span>
                <span>Learn about odds</span>
              </button>
              <button class="action-button" @click="sendSuggestedMessage('What types of bets can I make?')">
                <span class="action-icon">📊</span>
                <span>Bet types</span>
              </button>
              <button class="action-button" @click="sendSuggestedMessage('How do I manage my bankroll?')">
                <span class="action-icon">💰</span>
                <span>Bankroll tips</span>
              </button>
              <button class="action-button" @click="sendSuggestedMessage('What is expected value in betting?')">
                <span class="action-icon">📈</span>
                <span>Betting strategy</span>
              </button>
            </div>
          </div>

          <div
            v-for="(message, index) in messages"
            :key="index"
            :class="['message', message.type]"
          >
            <div class="message-avatar" v-if="message.type === 'user'">
              <span>👤</span>
            </div>
            <div class="message-content">
              <div class="message-text" v-html="formatMessage(message.text)"></div>
              <div class="message-time">{{ formatTime(message.timestamp) }}</div>
            </div>
            <div class="message-avatar" v-if="message.type === 'assistant'">
              <span>🤖</span>
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
              placeholder="Ask me anything..."
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
import { ref, nextTick, watch } from 'vue'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'

export default {
  name: 'ChatWidget',
  setup() {
    const isOpen = ref(false)
    const messages = ref([])
    const currentQuestion = ref('')
    const isLoading = ref(false)
    const messagesContainer = ref(null)
    const chatInput = ref(null)

    const toggleChat = () => {
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
        const response = await axios.post(`${API_BASE_URL}/ai/ask`, {
          question: question
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
        await nextTick()
        scrollToBottom()
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
        scrollToBottom()
      })
    })

    return {
      isOpen,
      messages,
      currentQuestion,
      isLoading,
      messagesContainer,
      chatInput,
      toggleChat,
      sendMessage,
      sendSuggestedMessage,
      formatMessage,
      formatTime
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

/* Chat Widget */
.chat-widget {
  position: fixed;
  bottom: 96px;
  right: 24px;
  width: 380px;
  max-width: calc(100vw - 48px);
  height: 600px;
  max-height: calc(100vh - 120px);
  background: white;
  border-radius: 12px;
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

.message.user .message-avatar {
  background: #4169e1;
}

.message-content {
  flex: 1;
  max-width: 75%;
}

.message.user .message-content {
  text-align: right;
}

.message-text {
  background: #f3f4f6;
  padding: 10px 14px;
  border-radius: 12px;
  line-height: 1.5;
  color: #1f2937;
  font-size: 14px;
  word-wrap: break-word;
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
    bottom: 88px;
    height: calc(100vh - 100px);
    max-height: calc(100vh - 100px);
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
