<template>
  <div class="ai-chat-page">
    <div class="chat-container">
      <div class="chat-header">
        <h1>Betting Assistant</h1>
        <p class="subtitle">Ask me anything about sports betting!</p>
      </div>

      <div class="chat-messages" ref="messagesContainer">
        <div v-if="messages.length === 0" class="welcome-message">
          <div class="welcome-icon">💬</div>
          <h2>Welcome to the Betting Assistant!</h2>
          <p>I'm here to help you understand sports betting. You can ask me about:</p>
          <ul class="example-questions">
            <li>• How to read betting odds</li>
            <li>• Different types of bets (moneyline, spread, totals)</li>
            <li>• Betting strategies and tips</li>
            <li>• Understanding probability and expected value</li>
            <li>• Bankroll management</li>
            <li>• And much more!</li>
          </ul>
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

      <div class="chat-input-container">
        <form @submit.prevent="sendMessage" class="chat-form">
          <input
            v-model="currentQuestion"
            type="text"
            placeholder="Ask a question about betting..."
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
      </div>
    </div>
  </div>
</template>

<script>
import { ref, nextTick, onMounted } from 'vue'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'

export default {
  name: 'AIChatPage',
  setup() {
    const messages = ref([])
    const currentQuestion = ref('')
    const isLoading = ref(false)
    const messagesContainer = ref(null)
    const chatInput = ref(null)

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

    onMounted(() => {
      if (chatInput.value) {
        chatInput.value.focus()
      }
    })

    return {
      messages,
      currentQuestion,
      isLoading,
      messagesContainer,
      chatInput,
      sendMessage,
      formatMessage,
      formatTime
    }
  }
}
</script>

<style scoped>
.ai-chat-page {
  min-height: calc(100vh - 80px);
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
  padding: 2rem 1rem;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.chat-container {
  max-width: 900px;
  width: 100%;
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  max-height: 800px;
  overflow: hidden;
}

.chat-header {
  padding: 2rem;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #4169e1 0%, #1e3a8a 100%);
  color: white;
}

.chat-header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 1.75rem;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  opacity: 0.9;
  font-size: 1rem;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.welcome-message {
  text-align: center;
  padding: 3rem 2rem;
  color: #64748b;
}

.welcome-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.welcome-message h2 {
  color: #1e293b;
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
}

.welcome-message p {
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.example-questions {
  text-align: left;
  display: inline-block;
  margin: 1rem 0 0 0;
  padding: 0;
  list-style: none;
}

.example-questions li {
  padding: 0.5rem 0;
  color: #475569;
}

.message {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  animation: fadeIn 0.3s ease;
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4169e1 0%, #1e3a8a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 1.25rem;
}

.message.user .message-avatar {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
}

.message-content {
  flex: 1;
  max-width: 75%;
}

.message.user .message-content {
  text-align: right;
}

.message-text {
  background: #f8fafc;
  padding: 0.875rem 1.125rem;
  border-radius: 12px;
  line-height: 1.6;
  color: #1e293b;
  word-wrap: break-word;
}

.message.user .message-text {
  background: linear-gradient(135deg, #4169e1 0%, #1e3a8a 100%);
  color: white;
}

.message-time {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.25rem;
  padding: 0 0.25rem;
}

.message.user .message-time {
  text-align: right;
}

.loading-dots {
  display: flex;
  gap: 0.5rem;
  padding: 0.875rem 1.125rem;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
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

.chat-input-container {
  padding: 1.5rem;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.chat-form {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.chat-input {
  flex: 1;
  padding: 0.875rem 1.125rem;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 1rem;
  outline: none;
  transition: all 0.3s ease;
  background: white;
}

.chat-input:focus {
  border-color: #4169e1;
  box-shadow: 0 0 0 3px rgba(65, 105, 225, 0.1);
}

.chat-input:disabled {
  background: #f1f5f9;
  cursor: not-allowed;
}

.send-button {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #4169e1 0%, #1e3a8a 100%);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.send-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(65, 105, 225, 0.4);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 20px;
  height: 20px;
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

/* Scrollbar styling */
.chat-messages::-webkit-scrollbar {
  width: 8px;
}

.chat-messages::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .ai-chat-page {
    padding: 1rem 0.5rem;
  }

  .chat-container {
    height: calc(100vh - 100px);
    border-radius: 12px;
  }

  .chat-header {
    padding: 1.5rem;
  }

  .chat-header h1 {
    font-size: 1.5rem;
  }

  .chat-messages {
    padding: 1rem;
  }

  .message-content {
    max-width: 85%;
  }

  .chat-input-container {
    padding: 1rem;
  }
}
</style>

