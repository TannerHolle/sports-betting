<template>
  <div class="admin-panel" v-if="isAuthenticated">
    <div class="admin-header">
      <h3>Admin Panel</h3>
      <p class="admin-description">
        Administrative controls for the betting system
      </p>
    </div>


    <!-- Sportsbook Revenue -->
    <SportsbookRevenue />

    <!-- Bet Resolver -->
    <BetResolver />

    <!-- Advanced Statistics -->
    <div class="admin-section">
      <AdvancedStats v-if="currentUser?.username" :username="currentUser.username" />
    </div>

    <div class="admin-actions">
      <div class="action-group">
        <h4>Bet Resolution</h4>
        <p class="action-description">
          Manually trigger bet resolution to check for completed games
        </p>
        <button 
          @click="forceResolveBets"
          :disabled="isLoading"
          class="admin-btn resolve-btn"
        >
          {{ isLoading ? 'Resolving...' : 'Force Resolve Bets' }}
        </button>
        <p v-if="resolveMessage" class="message" :class="resolveMessage.type">
          {{ resolveMessage.text }}
        </p>
      </div>

      <div class="action-group">
        <h4>Odds Update</h4>
        <p class="action-description">
          Force update odds data from external API
        </p>
        <button 
          @click="forceUpdateOdds"
          :disabled="isLoadingOdds"
          class="admin-btn odds-btn"
        >
          {{ isLoadingOdds ? 'Updating...' : 'Force Update Odds' }}
        </button>
        <p v-if="oddsMessage" class="message" :class="oddsMessage.type">
          {{ oddsMessage.text }}
        </p>
      </div>
    </div>

    <!-- Suggestions Section -->
    <div class="suggestions-section">
      <div class="suggestions-header">
        <h3>User Suggestions</h3>
        <div class="suggestions-filters">
          <button 
            v-for="status in statusFilters" 
            :key="status.value"
            @click="filterStatus = status.value"
            :class="['filter-btn', { active: filterStatus === status.value }]"
          >
            {{ status.label }}
            <span v-if="status.count !== undefined" class="count-badge">{{ status.count }}</span>
          </button>
        </div>
        <button @click="fetchSuggestions" class="refresh-btn" :disabled="isLoadingSuggestions">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1V5M8 11V15M3 8H7M9 8H13M3.293 3.293L5.586 5.586M10.414 10.414L12.707 12.707M3.293 12.707L5.586 10.414M10.414 5.586L12.707 3.293" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          Refresh
        </button>
      </div>

      <div v-if="isLoadingSuggestions" class="loading-state">
        <div class="spinner"></div>
        <p>Loading suggestions...</p>
      </div>

      <div v-else-if="filteredSuggestions.length === 0" class="empty-state">
        <p>No suggestions found</p>
      </div>

      <div v-else class="suggestions-list">
        <div 
          v-for="suggestion in filteredSuggestions" 
          :key="suggestion._id"
          class="suggestion-card"
          :class="`status-${suggestion.status}`"
        >
          <div class="suggestion-header">
            <div class="suggestion-meta">
              <span class="username">{{ suggestion.username }}</span>
              <span class="date">{{ formatDate(suggestion.createdAt) }}</span>
            </div>
            <select 
              :value="suggestion.status" 
              @change="updateSuggestionStatus(suggestion._id, $event.target.value)"
              class="status-select"
            >
              <option value="new">New</option>
              <option value="reviewed">Reviewed</option>
              <option value="implemented">Implemented</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div class="suggestion-text">{{ suggestion.suggestion }}</div>
          <div v-if="suggestion.adminNotes" class="admin-notes">
            <strong>Admin Notes:</strong> {{ suggestion.adminNotes }}
          </div>
          <div class="suggestion-actions">
            <button 
              @click="showNotesEditor(suggestion._id)"
              class="action-btn notes-btn"
            >
              {{ suggestion.adminNotes ? 'Edit Notes' : 'Add Notes' }}
            </button>
          </div>
          <div v-if="editingNotesId === suggestion._id" class="notes-editor">
            <textarea
              v-model="notesText"
              placeholder="Add admin notes about this suggestion..."
              rows="3"
              class="notes-input"
            ></textarea>
            <div class="notes-actions">
              <button @click="saveNotes(suggestion._id)" class="btn btn-primary btn-sm">Save</button>
              <button @click="cancelNotesEditor" class="btn btn-secondary btn-sm">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- AI Questions Section -->
    <div class="ai-questions-section">
      <div class="ai-questions-header">
        <h3>AI Questions & Answers</h3>
        <div class="ai-actions">
          <button @click="fetchAIQuestions" class="refresh-btn" :disabled="isLoadingAIQuestions">
            <svg width="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1V5M8 11V15M3 8H7M9 8H13M3.293 3.293L5.586 5.586M10.414 10.414L12.707 12.707M3.293 12.707L5.586 10.414M10.414 5.586L12.707 3.293" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Refresh
          </button>
          <button @click="deleteAllAIQuestions" class="delete-all-btn" :disabled="isDeletingAIQuestions || aiQuestions.length === 0">
            {{ isDeletingAIQuestions ? 'Deleting...' : 'Delete All' }}
          </button>
        </div>
      </div>

      <div v-if="isLoadingAIQuestions" class="loading-state">
        <div class="spinner"></div>
        <p>Loading AI questions...</p>
      </div>

      <div v-else-if="aiQuestions.length === 0" class="empty-state">
        <p>No AI questions found</p>
      </div>

      <div v-else class="ai-questions-list">
        <div 
          v-for="question in aiQuestions" 
          :key="question._id"
          class="ai-question-card"
        >
          <div class="question-header">
            <div class="question-meta">
              <span v-if="question.username" class="username">{{ question.username }}</span>
              <span v-else class="username anonymous">Anonymous</span>
              <span class="date">{{ formatDate(question.createdAt) }}</span>
            </div>
            <div v-if="question.gameContext?.sport" class="game-context-badge">
              {{ question.gameContext.sport.toUpperCase() }}
            </div>
          </div>
          
          <div v-if="question.gameContext?.homeTeam && question.gameContext?.awayTeam" class="game-info">
            <strong>Game:</strong> {{ question.gameContext.awayTeam }} @ {{ question.gameContext.homeTeam }}
          </div>

          <div class="question-text">
            <strong>Question:</strong>
            <p>{{ question.question }}</p>
          </div>

          <div v-if="question.answer" class="answer-text">
            <strong>AI Answer:</strong>
            <p>{{ question.answer }}</p>
          </div>
        </div>
      </div>

      <div v-if="hasMoreAIQuestions" class="load-more-container">
        <button @click="loadMoreAIQuestions" class="load-more-btn" :disabled="isLoadingAIQuestions">
          Load More
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'
import SportsbookRevenue from './SportsbookRevenue.vue'
import BetResolver from './BetResolver.vue'
import AdvancedStats from './AdvancedStats.vue'

export default {
  name: 'AdminPanel',
  components: {
    SportsbookRevenue,
    BetResolver,
    AdvancedStats
  },
  setup() {
    const userStore = useUserStore()
    const currentUser = computed(() => userStore.currentUser.value)
    const isLoading = ref(false)
    const isLoadingOdds = ref(false)
    const resolveMessage = ref('')
    const oddsMessage = ref('')
    const suggestions = ref([])
    const isLoadingSuggestions = ref(false)
    const filterStatus = ref('new')
    const editingNotesId = ref(null)
    const notesText = ref('')
    const aiQuestions = ref([])
    const isLoadingAIQuestions = ref(false)
    const isDeletingAIQuestions = ref(false)
    const aiQuestionsSkip = ref(0)
    const aiQuestionsLimit = ref(50)
    const hasMoreAIQuestionsData = ref(false)

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    
    const statusFilters = computed(() => {
      const counts = {
        all: suggestions.value.length,
        new: suggestions.value.filter(s => s.status === 'new').length,
        reviewed: suggestions.value.filter(s => s.status === 'reviewed').length,
        implemented: suggestions.value.filter(s => s.status === 'implemented').length,
        rejected: suggestions.value.filter(s => s.status === 'rejected').length
      }
      
      return [
        { value: 'all', label: 'All', count: counts.all },
        { value: 'new', label: 'New', count: counts.new },
        { value: 'reviewed', label: 'Reviewed', count: counts.reviewed },
        { value: 'implemented', label: 'Implemented', count: counts.implemented },
        { value: 'rejected', label: 'Rejected', count: counts.rejected }
      ]
    })
    
    const filteredSuggestions = computed(() => {
      if (filterStatus.value === 'all') {
        return suggestions.value
      }
      return suggestions.value.filter(s => s.status === filterStatus.value)
    })
    
    const fetchSuggestions = async () => {
      isLoadingSuggestions.value = true
      try {
        const response = await axios.get(`${API_BASE_URL}/suggestions`)
        suggestions.value = response.data
      } catch (error) {
        console.error('Error fetching suggestions:', error)
      } finally {
        isLoadingSuggestions.value = false
      }
    }
    
    const updateSuggestionStatus = async (suggestionId, newStatus) => {
      try {
        await axios.put(`${API_BASE_URL}/suggestions/${suggestionId}`, {
          status: newStatus
        })
        await fetchSuggestions()
      } catch (error) {
        console.error('Error updating suggestion status:', error)
      }
    }
    
    const showNotesEditor = (suggestionId) => {
      const suggestion = suggestions.value.find(s => s._id === suggestionId)
      if (suggestion) {
        editingNotesId.value = suggestionId
        notesText.value = suggestion.adminNotes || ''
      }
    }
    
    const cancelNotesEditor = () => {
      editingNotesId.value = null
      notesText.value = ''
    }
    
    const saveNotes = async (suggestionId) => {
      try {
        await axios.put(`${API_BASE_URL}/suggestions/${suggestionId}`, {
          adminNotes: notesText.value.trim()
        })
        await fetchSuggestions()
        cancelNotesEditor()
      } catch (error) {
        console.error('Error saving notes:', error)
      }
    }
    
    const formatDate = (dateString) => {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const hasMoreAIQuestions = computed(() => {
      return hasMoreAIQuestionsData.value
    })

    const fetchAIQuestions = async (loadMore = false) => {
      isLoadingAIQuestions.value = true
      try {
        const params = new URLSearchParams({
          limit: aiQuestionsLimit.value.toString(),
          skip: loadMore ? aiQuestions.value.length : 0
        })

        const response = await axios.get(`${API_BASE_URL}/ai/questions?${params}`)
        
        if (loadMore) {
          aiQuestions.value = [...aiQuestions.value, ...response.data.questions]
        } else {
          aiQuestions.value = response.data.questions
          aiQuestionsSkip.value = 0
        }
        
        hasMoreAIQuestionsData.value = response.data.pagination?.hasMore || false
      } catch (error) {
        console.error('Error fetching AI questions:', error)
      } finally {
        isLoadingAIQuestions.value = false
      }
    }

    const loadMoreAIQuestions = () => {
      fetchAIQuestions(true)
    }

    const deleteAllAIQuestions = async () => {
      if (!confirm('Are you sure you want to delete all AI questions? This action cannot be undone.')) {
        return
      }

      isDeletingAIQuestions.value = true
      try {
        await axios.delete(`${API_BASE_URL}/ai/questions`)
        aiQuestions.value = []
        hasMoreAIQuestionsData.value = false
      } catch (error) {
        console.error('Error deleting AI questions:', error)
        alert('Failed to delete AI questions. Please try again.')
      } finally {
        isDeletingAIQuestions.value = false
      }
    }

    onMounted(() => {
      fetchSuggestions()
      fetchAIQuestions()
    })

    const forceResolveBets = async () => {
      isLoading.value = true
      resolveMessage.value = ''
      
      try {
        const response = await axios.post(`${API_BASE_URL}/bets/force-resolve`)
        
        if (response.data.success) {
          resolveMessage.value = {
            type: 'success',
            text: '✅ Bets resolved successfully! Check your bet history for updates.'
          }
        } else {
          resolveMessage.value = {
            type: 'error',
            text: '❌ Failed to resolve bets'
          }
        }
      } catch (error) {
        console.error('Error resolving bets:', error)
        resolveMessage.value = {
          type: 'error',
          text: '❌ Error resolving bets: ' + (error.response?.data?.error || error.message)
        }
      } finally {
        isLoading.value = false
        
        // Clear message after 5 seconds
        setTimeout(() => {
          resolveMessage.value = ''
        }, 5000)
      }
    }

    const forceUpdateOdds = async () => {
      isLoadingOdds.value = true
      oddsMessage.value = ''
      
      try {
        const response = await axios.post(`${API_BASE_URL}/odds/force-update`)
        
        if (response.data.success) {
          oddsMessage.value = {
            type: 'success',
            text: '✅ Odds updated successfully!'
          }
        } else {
          oddsMessage.value = {
            type: 'error',
            text: '❌ Failed to update odds'
          }
        }
      } catch (error) {
        console.error('Error updating odds:', error)
        oddsMessage.value = {
          type: 'error',
          text: '❌ Error updating odds: ' + (error.response?.data?.error || error.message)
        }
      } finally {
        isLoadingOdds.value = false
        
        // Clear message after 5 seconds
        setTimeout(() => {
          oddsMessage.value = ''
        }, 5000)
      }
    }

    return {
      isAuthenticated,
      currentUser,
      isLoading,
      isLoadingOdds,
      resolveMessage,
      oddsMessage,
      forceResolveBets,
      forceUpdateOdds,
      suggestions,
      isLoadingSuggestions,
      filterStatus,
      statusFilters,
      filteredSuggestions,
      fetchSuggestions,
      updateSuggestionStatus,
      editingNotesId,
      notesText,
      showNotesEditor,
      cancelNotesEditor,
      saveNotes,
      formatDate,
      aiQuestions,
      isLoadingAIQuestions,
      isDeletingAIQuestions,
      hasMoreAIQuestions,
      fetchAIQuestions,
      loadMoreAIQuestions,
      deleteAllAIQuestions
    }
  }
}
</script>

<style scoped>
.admin-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  margin-bottom: 2rem;
}

.admin-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
}

.admin-header h3 {
  margin: 0 0 0.5rem 0;
  color: #1a1a1a;
  font-size: 1.5rem;
  font-weight: 700;
}

.admin-description {
  margin: 0;
  color: #6b7280;
  font-size: 1rem;
}

.admin-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.action-group {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
}

.action-group h4 {
  margin: 0 0 0.5rem 0;
  color: #374151;
  font-size: 1.1rem;
  font-weight: 600;
}

.action-description {
  margin: 0 0 1rem 0;
  color: #6b7280;
  font-size: 0.9rem;
  line-height: 1.4;
}

.admin-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9rem;
}

.resolve-btn {
  background: #dc2626;
  color: white;
}

.resolve-btn:hover:not(:disabled) {
  background: #b91c1c;
}

.odds-btn {
  background: #2563eb;
  color: white;
}

.odds-btn:hover:not(:disabled) {
  background: #1d4ed8;
}

.admin-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message {
  margin: 1rem 0 0 0;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
}

.message.success {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.message.error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.suggestions-section {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 2px solid #f0f0f0;
}

.suggestions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.suggestions-header h3 {
  margin: 0;
  color: #1a1a1a;
  font-size: 1.5rem;
  font-weight: 700;
}

.suggestions-filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 0.5rem 1rem;
  border: 2px solid #e5e7eb;
  background: white;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.875rem;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-btn:hover {
  border-color: #4169e1;
  color: #4169e1;
}

.filter-btn.active {
  background: linear-gradient(135deg, #4169e1 0%, #1e3a8a 100%);
  color: white;
  border-color: transparent;
}

.count-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
}

.filter-btn.active .count-badge {
  background: rgba(255, 255, 255, 0.3);
}

.refresh-btn {
  padding: 0.5rem 1rem;
  border: 2px solid #e5e7eb;
  background: white;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.875rem;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.refresh-btn:hover:not(:disabled) {
  border-color: #4169e1;
  color: #4169e1;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.delete-all-btn {
  padding: 0.5rem 1rem;
  border: 2px solid #dc2626;
  background: white;
  color: #dc2626;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.delete-all-btn:hover:not(:disabled) {
  background: #dc2626;
  color: white;
}

.delete-all-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #6b7280;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top-color: #4169e1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.suggestion-card {
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.2s ease;
}

.suggestion-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.suggestion-card.status-new {
  border-left: 4px solid #3b82f6;
}

.suggestion-card.status-reviewed {
  border-left: 4px solid #f59e0b;
}

.suggestion-card.status-implemented {
  border-left: 4px solid #10b981;
}

.suggestion-card.status-rejected {
  border-left: 4px solid #ef4444;
}

.suggestion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.suggestion-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.username {
  font-weight: 700;
  color: #1a1a1a;
  font-size: 0.95rem;
}

.date {
  font-size: 0.75rem;
  color: #6b7280;
}

.status-select {
  padding: 0.5rem 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  font-weight: 600;
  font-size: 0.875rem;
  color: #374151;
  cursor: pointer;
}

.suggestion-text {
  color: #1a1a1a;
  line-height: 1.6;
  margin-bottom: 1rem;
  white-space: pre-wrap;
}

.admin-notes {
  background: #eff6ff;
  border-left: 3px solid #4169e1;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: #1e3a8a;
}

.admin-notes strong {
  color: #1e3a8a;
}

.suggestion-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.5rem 1rem;
  border: 2px solid #e5e7eb;
  background: white;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.875rem;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  border-color: #4169e1;
  color: #4169e1;
}

.notes-editor {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.notes-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  font-size: 0.9rem;
  font-family: inherit;
  resize: vertical;
  margin-bottom: 0.75rem;
  box-sizing: border-box;
}

.notes-input:focus {
  outline: none;
  border-color: #4169e1;
}

.notes-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .admin-actions {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .admin-panel {
    padding: 1.5rem;
  }
  
  .suggestions-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .suggestions-filters {
    width: 100%;
  }
  
  .filter-btn {
    flex: 1;
    justify-content: center;
  }
  
  .suggestion-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .status-select {
    width: 100%;
  }
}

/* AI Questions Section Styles */
.ai-questions-section {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 2px solid #f0f0f0;
}

.ai-questions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.ai-questions-header h3 {
  margin: 0;
  color: #1a1a1a;
  font-size: 1.5rem;
  font-weight: 700;
}

.ai-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.ai-questions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ai-question-card {
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.2s ease;
}

.ai-question-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.question-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.question-meta .username {
  font-weight: 700;
  color: #1a1a1a;
  font-size: 0.95rem;
}

.question-meta .username.anonymous {
  color: #6b7280;
  font-style: italic;
}

.question-meta .date {
  font-size: 0.75rem;
  color: #6b7280;
}

.game-context-badge {
  padding: 0.25rem 0.75rem;
  background: linear-gradient(135deg, #4169e1 0%, #1e3a8a 100%);
  color: white;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
}

.game-info {
  background: #eff6ff;
  border-left: 3px solid #4169e1;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: #1e3a8a;
}

.game-info strong {
  color: #1e3a8a;
}

.question-text {
  margin-bottom: 1rem;
}

.question-text strong {
  display: block;
  margin-bottom: 0.5rem;
  color: #374151;
  font-size: 0.9rem;
}

.question-text p {
  color: #1a1a1a;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}

.answer-text {
  background: #f0fdf4;
  border-left: 3px solid #10b981;
  padding: 1rem;
  border-radius: 6px;
  margin-top: 1rem;
}

.answer-text strong {
  display: block;
  margin-bottom: 0.5rem;
  color: #065f46;
  font-size: 0.9rem;
}

.answer-text p {
  color: #1a1a1a;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}

.load-more-container {
  text-align: center;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e5e7eb;
}

.load-more-btn {
  padding: 0.75rem 2rem;
  border: 2px solid #4169e1;
  background: white;
  color: #4169e1;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.load-more-btn:hover:not(:disabled) {
  background: #4169e1;
  color: white;
}

.load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .ai-questions-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .ai-actions {
    width: 100%;
  }

  .refresh-btn,
  .delete-all-btn {
    flex: 1;
  }

  .question-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
