<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-header">
        <h1 class="auth-title">
          Sports Betting
        </h1>
        <p class="auth-subtitle">
          Experience the thrill of sports betting without the risk of becoming a degenerate gambler or eternal damnation.
        </p>
      </div>

      <div class="auth-tabs">
        <button 
          @click="activeTab = 'login'" 
          :class="{ active: activeTab === 'login' }"
          class="tab-btn"
        >
          Sign In
        </button>
        <button 
          @click="activeTab = 'signup'" 
          :class="{ active: activeTab === 'signup' }"
          class="tab-btn"
        >
          Create Account
        </button>
      </div>

      <!-- Login Form -->
      <form v-if="activeTab === 'login'" @submit.prevent="handleLogin" class="auth-form">
        <h3>Welcome Back!</h3>
        <div class="form-group">
          <label for="login-username">Username:</label>
          <input 
            id="login-username"
            v-model="loginForm.username" 
            @input="removeSpacesFromUsername('login')"
            type="text" 
            required 
            placeholder="Enter your username"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="login-password">Password:</label>
          <div class="password-input-container">
            <input 
              id="login-password"
              v-model="loginForm.password" 
              :type="showLoginPassword ? 'text' : 'password'"
              required 
              placeholder="Enter your password"
              class="form-input password-input"
            />
            <button 
              type="button"
              @click="toggleLoginPasswordVisibility"
              class="password-toggle-btn"
              :title="showLoginPassword ? 'Hide password' : 'Show password'"
            >
              <EyeIcon v-if="!showLoginPassword" class="eye-icon" />
              <EyeSlashIcon v-else class="eye-icon" />
            </button>
          </div>
        </div>
        <div class="form-group remember-me-group">
          <label class="remember-me-label">
            <input 
              type="checkbox" 
              v-model="loginForm.rememberMe"
              class="remember-me-checkbox"
            />
            <span>Remember me</span>
          </label>
        </div>
        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>
        <p v-if="error" class="error-message">{{ error }}</p>
      </form>

      <!-- Sign Up Form -->
      <form v-if="activeTab === 'signup'" @submit.prevent="handleSignup" class="auth-form">
        <h3>Create Your Account</h3>
        <div class="form-group">
          <label for="signup-name">Name:</label>
          <input 
            id="signup-name"
            v-model="signupForm.name" 
            type="text" 
            required 
            placeholder="Enter your full name"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="signup-email">Email:</label>
          <input 
            id="signup-email"
            v-model="signupForm.email" 
            type="email" 
            required 
            placeholder="Enter your email"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="signup-phone">Phone Number:</label>
          <input 
            id="signup-phone"
            v-model="signupForm.phoneNumber" 
            @input="formatPhoneNumber"
            type="tel" 
            required 
            placeholder="Enter your phone number"
            class="form-input"
            maxlength="14"
          />
        </div>
        <div class="form-group">
            <label for="signup-username">Username:</label>
            <input 
            id="signup-username"
            v-model="signupForm.username" 
            @input="removeSpacesFromUsername('signup')"
            type="text" 
            required 
            placeholder="Choose a username"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="signup-password">Password:</label>
          <div class="password-input-container">
            <input 
              id="signup-password"
              v-model="signupForm.password" 
              @input="validatePasswordStrength(signupForm.password)"
              :type="showSignupPassword ? 'text' : 'password'"
              required 
              placeholder="Choose a secure password"
              class="form-input password-input"
            />
            <button 
              type="button"
              @click="toggleSignupPasswordVisibility"
              class="password-toggle-btn"
              :title="showSignupPassword ? 'Hide password' : 'Show password'"
            >
              <EyeIcon v-if="!showSignupPassword" class="eye-icon" />
              <EyeSlashIcon v-else class="eye-icon" />
            </button>
          </div>
          
          <!-- Password Strength Indicator -->
          <div v-if="signupForm.password" class="password-strength">
            <div class="strength-bar">
              <div 
                class="strength-fill" 
                :class="{
                  'weak': passwordStrength.score < 40,
                  'fair': passwordStrength.score >= 40 && passwordStrength.score < 80,
                  'strong': passwordStrength.score >= 80
                }"
                :style="{ width: passwordStrength.score + '%' }"
              ></div>
            </div>
            <div class="strength-text">
              <span v-if="passwordStrength.score < 40" class="weak">Weak</span>
              <span v-else-if="passwordStrength.score < 80" class="fair">Fair</span>
              <span v-else class="strong">Strong</span>
            </div>
          </div>
          
          <!-- Password Requirements -->
          <div v-if="signupForm.password" class="password-requirements">
            <div 
              v-for="requirement in passwordRequirements" 
              :key="requirement.text"
              class="requirement"
              :class="{ 'met': requirement.met }"
            >
              <span class="requirement-icon">{{ requirement.met ? '✓' : '○' }}</span>
              <span class="requirement-text">{{ requirement.text }}</span>
            </div>
          </div>
        </div>
        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? 'Creating Account...' : 'Create Account' }}
        </button>
        <p v-if="error" class="error-message">{{ error }}</p>
      </form>

      <!-- Success Message -->
      <div v-if="successMessage" class="success-message">
        <h4>🎉 {{ successMessage }}</h4>
        <p>You can now start betting!</p>
        <button @click="goToBetting" class="success-btn">
          Go to Betting
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import { EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'

export default {
  name: 'AuthPage',
  components: {
    EyeIcon,
    EyeSlashIcon
  },
  setup() {
    const userStore = useUserStore()
    const activeTab = ref('login')
    const loading = ref(false)
    const error = ref('')
    const successMessage = ref('')
    const pendingInviteCode = ref(null)
    
    const loginForm = ref({
      username: '',
      password: '',
      rememberMe: false
    })
    
    const signupForm = ref({
      name: '',
      email: '',
      phoneNumber: '',
      username: '',
      password: ''
    })
    
    const passwordStrength = ref({
      score: 0,
      feedback: []
    })
    
    const passwordRequirements = ref([
      { text: 'At least 8 characters', met: false },
      { text: 'One uppercase letter', met: false },
      { text: 'One number', met: false }
    ])
    
    const showLoginPassword = ref(false)
    const showSignupPassword = ref(false)
    
    // Validate password strength
    const validatePasswordStrength = (password) => {
      const requirements = [
        { text: 'At least 8 characters', met: password.length >= 8 },
        { text: 'One uppercase letter', met: /(?=.*[A-Z])/.test(password) },
        { text: 'One number', met: /(?=.*\d)/.test(password) }
      ]
      
      passwordRequirements.value = requirements
      
      const metCount = requirements.filter(req => req.met).length
      const score = Math.round((metCount / requirements.length) * 100)
      
      passwordStrength.value = {
        score,
        feedback: requirements.filter(req => !req.met).map(req => req.text)
      }
      
      return metCount === requirements.length
    }
    
    // Toggle password visibility
    const toggleLoginPasswordVisibility = () => {
      showLoginPassword.value = !showLoginPassword.value
    }
    
    const toggleSignupPasswordVisibility = () => {
      showSignupPassword.value = !showSignupPassword.value
    }
    
    // Format phone number as user types
    const formatPhoneNumber = (event) => {
      // Remove all non-numeric characters
      let input = event.target.value.replace(/\D/g, '')
      
      // Limit to 10 digits
      if (input.length > 10) {
        input = input.slice(0, 10)
      }
      
      // Format as (XXX) XXX-XXXX
      let formatted = ''
      if (input.length > 0) {
        formatted = '(' + input.slice(0, 3)
      }
      if (input.length > 3) {
        formatted += ') ' + input.slice(3, 6)
      }
      if (input.length > 6) {
        formatted += '-' + input.slice(6, 10)
      }
      
      signupForm.value.phoneNumber = formatted
    }

    // Remove spaces from username as user types
    const removeSpacesFromUsername = (formType) => {
      if (formType === 'login') {
        loginForm.value.username = loginForm.value.username.replace(/\s/g, '')
      } else if (formType === 'signup') {
        signupForm.value.username = signupForm.value.username.replace(/\s/g, '')
      }
    }

    const handleLogin = async () => {
      loading.value = true
      error.value = ''
      successMessage.value = ''
      
      try {
        const user = await userStore.login(
          loginForm.value.username, 
          loginForm.value.password,
          loginForm.value.rememberMe
        )
        if (user) {
          // Join league if invite code is in URL
          if (pendingInviteCode.value) {
            await joinLeagueFromInvite(pendingInviteCode.value)
          }
          // Auto-redirect to betting page after successful login
          setTimeout(() => {
            goToBetting()
          }, 500) // Small delay to show success message
        } else {
          error.value = 'Invalid username or password. Please try again.'
          loading.value = false
        }
      } catch (err) {
        error.value = 'Sign in failed. Please try again.'
        loading.value = false
      }
    }

    const handleSignup = async () => {
      loading.value = true
      error.value = ''
      successMessage.value = ''
      
      // Validate password strength
      if (!validatePasswordStrength(signupForm.value.password)) {
        error.value = 'Password does not meet security requirements'
        loading.value = false
        return
      }
      
      try {
        // Strip formatting from phone number before sending (only send digits)
        const phoneDigits = signupForm.value.phoneNumber.replace(/\D/g, '')
        
        const user = await userStore.createAccount(
          signupForm.value.username,
          signupForm.value.password,
          signupForm.value.name,
          signupForm.value.email,
          phoneDigits
        )
        
        if (user) {
          // Join league if invite code is in URL
          if (pendingInviteCode.value) {
            await joinLeagueFromInvite(pendingInviteCode.value)
          }
          // Auto-redirect to betting page after successful signup
          setTimeout(() => {
            goToBetting()
          }, 1000) // Small delay to show success message
        }
      } catch (err) {
        error.value = err.message || 'Account creation failed. Please try again.'
        loading.value = false
      }
    }

    const joinLeagueFromInvite = async (inviteCode) => {
      if (!inviteCode || !userStore.currentUser.value?.username) return
      
      try {
        const response = await axios.post(`${API_BASE_URL}/leagues/join-by-code`, {
          inviteCode: inviteCode.toUpperCase(),
          username: userStore.currentUser.value.username
        })
        
        // Clear the invite code from URL
        const url = new URL(window.location.href)
        url.searchParams.delete('invite')
        window.history.replaceState({}, '', url)
        pendingInviteCode.value = null
        
        console.log(`Successfully joined league: ${response.data.name}`)
      } catch (error) {
        console.error('Error joining league from invite:', error)
        // Don't show error to user, just log it
      }
    }

    const goToBetting = () => {
      // Emit event to parent to change page
      window.dispatchEvent(new CustomEvent('change-page', { detail: 'betting' }))
    }

    // Listen for page change events
    const handlePageChange = (event) => {
      if (event.detail === 'betting') {
        // Page will change via parent component
      }
    }

    // Check for invite code in URL
    const checkInviteCode = () => {
      const urlParams = new URLSearchParams(window.location.search)
      const invite = urlParams.get('invite')
      if (invite) {
        pendingInviteCode.value = invite.toUpperCase()
        // Automatically switch to signup tab if invite code is present
        activeTab.value = 'signup'
      }
    }

    // Add event listener on mount
    onMounted(() => {
      window.addEventListener('change-page', handlePageChange)
      checkInviteCode()
    })

    // Remove event listener on unmount
    onUnmounted(() => {
      window.removeEventListener('change-page', handlePageChange)
    })

    return {
      activeTab,
      loading,
      error,
      successMessage,
      loginForm,
      signupForm,
      passwordStrength,
      passwordRequirements,
      showLoginPassword,
      showSignupPassword,
      validatePasswordStrength,
      toggleLoginPasswordVisibility,
      toggleSignupPasswordVisibility,
      formatPhoneNumber,
      removeSpacesFromUsername,
      handleLogin,
      handleSignup,
      goToBetting
    }
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #4169e1 0%, #1e3a8a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.auth-container {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  padding: 3rem;
  max-width: 500px;
  width: 100%;
}

.auth-header {
  text-align: center;
  margin-bottom: 2rem;
}

.auth-title {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0 0 1rem 0;
  color: #1a1a1a;
}

.title-icon {
  font-size: 3rem;
  margin-right: 0.5rem;
}

.auth-subtitle {
  color: #6b7280;
  font-size: 1.1rem;
  margin: 0;
  line-height: 1.6;
}

.auth-tabs {
  display: flex;
  margin-bottom: 2rem;
  border-bottom: 2px solid #f0f0f0;
}

.tab-btn {
  flex: 1;
  padding: 1rem;
  border: none;
  background: none;
  font-size: 1.1rem;
  font-weight: 600;
  color: #666;
  cursor: pointer;
  transition: all 0.3s ease;
  border-bottom: 3px solid transparent;
}

.tab-btn.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.tab-btn:hover {
  color: #2563eb;
}

.auth-form h3 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #1a1a1a;
  font-size: 1.5rem;
}

/* Password Strength Styles */
.password-strength {
  margin-top: 0.5rem;
}

.strength-bar {
  width: 100%;
  height: 4px;
  background-color: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.strength-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.strength-fill.weak {
  background-color: #ef4444;
}

.strength-fill.fair {
  background-color: #f59e0b;
}

.strength-fill.strong {
  background-color: #10b981;
}

.strength-text {
  font-size: 0.75rem;
  font-weight: 600;
  text-align: right;
}

.strength-text.weak {
  color: #ef4444;
}

.strength-text.fair {
  color: #f59e0b;
}

.strength-text.strong {
  color: #10b981;
}

.password-requirements {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background-color: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.requirement {
  display: flex;
  align-items: center;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
}

.requirement:last-child {
  margin-bottom: 0;
}

.requirement-icon {
  margin-right: 0.5rem;
  font-weight: bold;
  width: 16px;
  text-align: center;
}

.requirement.met .requirement-icon {
  color: #10b981;
}

.requirement:not(.met) .requirement-icon {
  color: #6b7280;
}

.requirement-text {
  color: #374151;
}

.requirement.met .requirement-text {
  color: #10b981;
  text-decoration: line-through;
}

.form-group {
  margin-bottom: 1.5rem;
}

.password-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input {
  padding-right: 3rem; /* Make room for the toggle button */
}

.password-toggle-btn {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  color: #6b7280;
}

.eye-icon {
  width: 1.25rem;
  height: 1.25rem;
  stroke: currentColor;
}

.password-toggle-btn:hover {
  background-color: #f3f4f6;
  color: #374151;
}

.password-toggle-btn:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #374151;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.submit-btn {
  width: 100%;
  padding: 0.875rem;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.submit-btn:hover:not(:disabled) {
  background: #1d4ed8;
}

.submit-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.error-message {
  color: #dc2626;
  text-align: center;
  margin-top: 1rem;
  font-weight: 500;
}

.success-message {
  text-align: center;
  padding: 2rem;
  background: #f0fdf4;
  border-radius: 12px;
  border: 2px solid #bbf7d0;
}

.success-message h4 {
  color: #059669;
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
}

.success-message p {
  color: #6b7280;
  margin: 0 0 1.5rem 0;
}

.success-btn {
  background: #059669;
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.success-btn:hover {
  background: #047857;
}

.remember-me-group {
  margin-bottom: 1rem;
}

.remember-me-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 0.95rem;
  color: #374151;
  user-select: none;
}

.remember-me-checkbox {
  margin-right: 0.5rem;
  width: 1.1rem;
  height: 1.1rem;
  cursor: pointer;
  accent-color: #2563eb;
}

.remember-me-label:hover {
  color: #1f2937;
}

@media (max-width: 768px) {
  .auth-page {
    padding: 1rem;
  }
  
  .auth-container {
    padding: 2rem;
  }
  
  .auth-title {
    font-size: 2rem;
  }
  
  .title-icon {
    font-size: 2.5rem;
  }
}
</style>
