<template>
  <div class="league-management" v-if="isAuthenticated">

    <div class="league-management-content">
      <!-- Create League Form -->
      <div class="create-league-section">
        <h4>Create a League</h4>
        <form @submit.prevent="createLeague" class="league-form">
          <input
            v-model="newLeagueName"
            type="text"
            placeholder="Enter league name"
            class="league-input"
            required
            :disabled="creating"
          />
          <button type="submit" class="create-btn" :disabled="creating || !newLeagueName.trim()">
            <span v-if="creating" class="spinner-small"></span>
            {{ creating ? 'Creating...' : 'Create League' }}
          </button>
        </form>
        <div v-if="createError" class="error-message">{{ createError }}</div>
        <div v-if="createSuccess && !createError" class="success-message">{{ createSuccess }}</div>
      </div>

      <!-- Join League Section -->
      <div class="join-league-section">
        <h4>Join a League</h4>
        
        <!-- Join by Invite Code -->
        <div class="join-by-id-section">
          <p class="join-instructions">Enter an invite code (e.g., ABC123) to join a league. Invite codes can be shared by league members.</p>
          <form @submit.prevent="joinByInviteCode" class="league-form">
            <input
              v-model="inviteCodeToJoin"
              type="text"
              placeholder="Enter Invite Code (e.g., ABC123)"
              class="league-input"
              :disabled="joiningById"
              style="text-transform: uppercase;"
            />
            <button type="submit" class="join-btn" :disabled="joiningById || !inviteCodeToJoin.trim()">
              <span v-if="joiningById" class="spinner-small"></span>
              {{ joiningById ? 'Joining...' : 'Join League' }}
            </button>
          </form>
          <div v-if="joinByIdError" class="error-message">{{ joinByIdError }}</div>
          <div v-if="joinByIdSuccess && !joinByIdError" class="success-message">{{ joinByIdSuccess }}</div>
        </div>
      </div>

      <!-- My Leagues Section -->
      <div class="my-leagues-section" v-if="userLeagues.length > 0">
        <h4>My Leagues</h4>
        <div class="leagues-list">
          <div
            v-for="league in userLeagues"
            :key="league._id"
            class="league-item my-league"
          >
            <div class="league-header">
              <div class="league-info">
                <div class="league-name">{{ league.name }}</div>
                <div class="league-meta">
                  <span v-if="league.creator?._id === currentUser?._id" class="creator-badge">Creator</span>
                </div>
              </div>
              <div class="league-members" v-if="league.members && league.members.length > 0">
                <div class="members-label">{{ league.members?.length || 0 }} members:</div>
                <div class="members-list">
                  <span 
                    v-for="(member, index) in league.members" 
                    :key="member._id || member.username || index"
                    class="member-item"
                  >
                    <span class="member-username">{{ member.username || member }}</span>
                    <span v-if="index < league.members.length - 1" class="member-comma">,</span>
                  </span>
                </div>
              </div>
            </div>
            <div class="league-id-section">
                <label class="league-id-label">Invite Code (Easy Share):</label>
                <div class="league-id-container">
                  <code class="league-id invite-code">{{ league.inviteCode || 'N/A' }}</code>
                  <button
                    @click="copyInviteCode(league.inviteCode)"
                    class="copy-btn"
                    :class="{ 'copied': copiedCode === league.inviteCode }"
                    v-if="league.inviteCode"
                  >
                    <span v-if="copiedCode === league.inviteCode">✓ Copied</span>
                    <span v-else>Copy Code</span>
                  </button>
                </div>
                <div class="share-link-section" v-if="league.inviteCode">
                  <label class="share-link-label">Or share this link:</label>
                  <div class="share-link-container">
                    <input
                      :value="getShareLink(league.inviteCode)"
                      readonly
                      class="share-link-input"
                    />
                    <button
                      @click="copyShareLink(league.inviteCode)"
                      class="copy-btn"
                      :class="{ 'copied': copiedLink === league.inviteCode }"
                    >
                      <span v-if="copiedLink === league.inviteCode">✓ Copied</span>
                      <span v-else>Copy Link</span>
                    </button>
                  </div>
                  <p class="share-link-hint">Anyone who creates an account with this link will automatically join your league!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'

export default {
  name: 'LeagueManagement',
  emits: ['leagues-updated'],
  setup(props, { emit }) {
    const userStore = useUserStore()
    const newLeagueName = ref('')
    const userLeagues = ref([])
    const creating = ref(false)
    const createError = ref('')
    const createSuccess = ref('')
    const inviteCodeToJoin = ref('')
    const joiningById = ref(false)
    const joinByIdError = ref('')
    const joinByIdSuccess = ref('')
    const copiedCode = ref('')
    const copiedLink = ref('')

    const isAuthenticated = computed(() => userStore.isAuthenticated.value)
    const currentUser = computed(() => userStore.currentUser.value)

    const fetchUserLeagues = async () => {
      if (!currentUser.value?.username) return
      
      try {
        const response = await axios.get(`${API_BASE_URL}/user/${currentUser.value.username}/leagues`)
        userLeagues.value = response.data || []
        emit('leagues-updated', userLeagues.value)
      } catch (error) {
        console.error('Error fetching user leagues:', error)
        userLeagues.value = []
      }
    }


    const createLeague = async () => {
      if (!newLeagueName.value.trim() || !currentUser.value?.username) return
      
      creating.value = true
      createError.value = ''
      createSuccess.value = ''
      
      try {
        const response = await axios.post(`${API_BASE_URL}/leagues`, {
          name: newLeagueName.value.trim(),
          username: currentUser.value.username
        })
        
        createSuccess.value = `League "${response.data.name}" created successfully!`
        newLeagueName.value = ''
        
        // Clear any previous errors
        createError.value = ''
        
        // Refresh leagues
        await fetchUserLeagues()
      } catch (error) {
        console.error('Error creating league:', error)
        createError.value = error.response?.data?.error || 'Failed to create league'
        // Clear success message if there was an error
        createSuccess.value = ''
      } finally {
        creating.value = false
      }
    }


    const joinByInviteCode = async () => {
      if (!inviteCodeToJoin.value.trim() || !currentUser.value?.username) return
      
      joiningById.value = true
      joinByIdError.value = ''
      joinByIdSuccess.value = ''
      
      try {
        const response = await axios.post(`${API_BASE_URL}/leagues/join-by-code`, {
          inviteCode: inviteCodeToJoin.value.trim().toUpperCase(),
          username: currentUser.value.username
        })
        
        joinByIdSuccess.value = `Successfully joined "${response.data.name}"!`
        inviteCodeToJoin.value = ''
        
        // Refresh leagues
        await fetchUserLeagues()
      } catch (error) {
        console.error('Error joining league by code:', error)
        joinByIdError.value = error.response?.data?.error || 'Failed to join league. Please check the invite code.'
      } finally {
        joiningById.value = false
      }
    }

    const copyInviteCode = async (code) => {
      if (!code) return
      try {
        await navigator.clipboard.writeText(code)
        copiedCode.value = code
        setTimeout(() => {
          copiedCode.value = ''
        }, 2000)
      } catch (error) {
        console.error('Failed to copy invite code:', error)
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = code
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        try {
          document.execCommand('copy')
          copiedCode.value = code
          setTimeout(() => {
            copiedCode.value = ''
          }, 2000)
        } catch (err) {
          console.error('Fallback copy failed:', err)
        }
        document.body.removeChild(textArea)
      }
    }

    const getShareLink = (inviteCode) => {
      if (!inviteCode) return ''
      // Generate link that includes invite code
      // When user visits, App.vue should check for invite and redirect to auth
      const baseUrl = window.location.origin
      return `${baseUrl}/?invite=${inviteCode}`
    }

    const copyShareLink = async (inviteCode) => {
      const shareLink = getShareLink(inviteCode)
      if (!shareLink) return
      
      try {
        await navigator.clipboard.writeText(shareLink)
        copiedLink.value = inviteCode
        setTimeout(() => {
          copiedLink.value = ''
        }, 2000)
      } catch (error) {
        console.error('Failed to copy share link:', error)
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = shareLink
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        try {
          document.execCommand('copy')
          copiedLink.value = inviteCode
          setTimeout(() => {
            copiedLink.value = ''
          }, 2000)
        } catch (err) {
          console.error('Fallback copy failed:', err)
        }
        document.body.removeChild(textArea)
      }
    }

    const copyLeagueId = async (leagueId) => {
      try {
        await navigator.clipboard.writeText(leagueId)
        // Show feedback briefly
        const originalCode = copiedCode.value
        copiedCode.value = 'ID_COPIED'
        setTimeout(() => {
          copiedCode.value = originalCode
        }, 1000)
      } catch (error) {
        console.error('Failed to copy league ID:', error)
      }
    }

    onMounted(async () => {
      await fetchUserLeagues()
    })

    return {
      isAuthenticated,
      currentUser,
      newLeagueName,
      userLeagues,
      creating,
      createError,
      createSuccess,
      createLeague,
      joinByInviteCode,
      inviteCodeToJoin,
      joiningById,
      joinByIdError,
      joinByIdSuccess,
      copyInviteCode,
      copyShareLink,
      getShareLink,
      copyLeagueId,
      copiedCode,
      copiedLink
    }
  }
}
</script>

<style scoped>
.league-management {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  margin-bottom: 2rem;
}

.league-management-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
}

.league-management-header h3 {
  margin: 0 0 0.5rem 0;
  color: #1a1a1a;
  font-size: 1.5rem;
  font-weight: 700;
}

.league-description {
  margin: 0;
  color: #6b7280;
  font-size: 1rem;
}

.league-management-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.create-league-section,
.join-league-section,
.my-leagues-section {
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.create-league-section h4,
.join-league-section h4,
.my-leagues-section h4 {
  margin: 0 0 1rem 0;
  color: #1a1a1a;
  font-size: 1.1rem;
  font-weight: 600;
}

.league-form {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.league-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.league-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.create-btn,
.join-btn {
  padding: 0.75rem 1.5rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.create-btn:hover:not(:disabled) {
  background: #2563eb;
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.join-btn {
  background: #10b981;
}

.join-btn:hover:not(:disabled) {
  background: #059669;
}

.join-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.leagues-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

@media (min-width: 1024px) {
  .leagues-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

.league-item {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.league-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.league-item.my-league {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-color: #3b82f6;
}

.league-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 1rem;
}

.league-info {
  flex: 0 0 auto;
  min-width: 0;
  max-width: 35%;
}

.league-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 0.25rem;
  white-space: nowrap;
}

.league-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

@media (min-width: 1280px) {
  .league-meta {
    flex-direction: row;
    gap: 1rem;
    align-items: center;
  }
}

.creator-badge {
  background: #fbbf24;
  color: #78350f;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.75rem;
  display: inline-block;
  width: 70px;
  text-align: center;
  box-sizing: border-box;
}

.league-members {
  flex-shrink: 0;
  text-align: right;
  min-width: 200px;
  max-width: 450px;
  flex: 0 1 auto;
  padding-left: 0.5rem;
}

.members-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.members-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
  font-size: 0.875rem;
  color: #1a1a1a;
  justify-content: flex-end;
  align-items: flex-start;
  padding: 0.25rem;
  padding-right: 0.5rem;
}

.members-list::-webkit-scrollbar {
  width: 6px;
}

.members-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.members-list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.members-list::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

.member-item {
  display: inline-flex;
  align-items: center;
}

.member-username {
  font-weight: 500;
  color: #3b82f6;
  white-space: nowrap;
}

.member-comma {
  color: #6b7280;
  margin-left: 0.25rem;
}

.league-id-section {
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.league-id-label {
  display: block;
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.league-id-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.league-id {
  flex: 1;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  color: #1a1a1a;
  overflow-x: auto;
  word-break: break-all;
}

.league-id.invite-code {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #3b82f6;
  text-align: center;
}

.league-id-alt {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.alt-label {
  font-weight: 500;
}

.league-id-small {
  flex: 1;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-size: 0.7rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  color: #6b7280;
  overflow-x: auto;
}

.copy-btn-small {
  padding: 0.25rem 0.5rem;
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.copy-btn-small:hover {
  background: #e5e7eb;
}

.share-link-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.share-link-label {
  display: block;
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.share-link-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.share-link-input {
  flex: 1;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  color: #1a1a1a;
  overflow-x: auto;
}

.share-link-hint {
  margin: 0.5rem 0 0 0;
  font-size: 0.75rem;
  color: #6b7280;
  font-style: italic;
}

.copy-btn {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.copy-btn:hover {
  background: #2563eb;
}

.copy-btn.copied {
  background: #10b981;
}

.copy-btn.copied:hover {
  background: #059669;
}

.error-message {
  color: #dc2626;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.success-message {
  color: #059669;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.empty-state,
.loading-state {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.join-by-id-section {
  margin-bottom: 1.5rem;
}

.join-instructions {
  margin: 0 0 0.75rem 0;
  color: #6b7280;
  font-size: 0.875rem;
}


@media (max-width: 768px) {
  .league-management {
    padding: 1.5rem;
  }
  
  .league-form {
    flex-direction: column;
  }
  
  .league-header {
    flex-direction: row;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .league-info {
    flex: 0 0 auto;
    min-width: 0;
    max-width: 35%;
  }
  
  .league-members {
    text-align: right;
    min-width: 150px;
    max-width: 60%;
    flex: 1 1 auto;
  }
  
  .members-list {
    justify-content: flex-end;
  }
  
  .join-btn {
    width: 100%;
    justify-content: center;
  }
  
  .browse-leagues {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>

