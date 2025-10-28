<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-header">
        <h1 class="auth-title">
          <span class="title-icon">🎯</span>
          Fantasy Sports Betting
        </h1>
        <p class="auth-subtitle">
          Create your account or sign in to start betting with virtual money
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
              <svg v-if="!showLoginPassword" class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <svg v-else class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>
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
            <label for="signup-username">Username:</label>
            <input 
            id="signup-username"
            v-model="signupForm.username" 
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
              <svg v-if="!showSignupPassword" class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <svg v-else class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
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

export default {
  name: 'AuthPage',
  setup() {
    const userStore = useUserStore()
    const activeTab = ref('login')
    const loading = ref(false)
    const error = ref('')
    const successMessage = ref('')
    
    const loginForm = ref({
      username: '',
      password: ''
    })
    
    const signupForm = ref({
      username: '',
      password: ''
    })
    
    const passwordStrength = ref({
      score: 0,
      feedback: []
    })
    
    const passwordRequirements = ref([
      { text: 'At least 8 characters', met: false },
      { text: 'One lowercase letter', met: false },
      { text: 'One uppercase letter', met: false },
      { text: 'One number', met: false },
      { text: 'One special character', met: false }
    ])
    
    const showLoginPassword = ref(false)
    const showSignupPassword = ref(false)
    
    // Validate password strength
    const validatePasswordStrength = (password) => {
      const requirements = [
        { text: 'At least 8 characters', met: password.length >= 8 },
        { text: 'One lowercase letter', met: /(?=.*[a-z])/.test(password) },
        { text: 'One uppercase letter', met: /(?=.*[A-Z])/.test(password) },
        { text: 'One number', met: /(?=.*\d)/.test(password) },
        { text: 'One special character', met: /(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password) }
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

    const handleLogin = async () => {
      loading.value = true
      error.value = ''
      successMessage.value = ''
      
      try {
        const user = await userStore.login(loginForm.value.username, loginForm.value.password)
        if (user) {
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
        const user = await userStore.createAccount(
          signupForm.value.username,
          signupForm.value.password
        )
        
        if (user) {
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

    // Add event listener on mount
    onMounted(() => {
      window.addEventListener('change-page', handlePageChange)
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
