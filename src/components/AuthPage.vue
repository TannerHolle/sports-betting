<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-header">
        <h1 class="auth-title">
          <span class="title-icon">🎯</span>
          Fantasy Sports Betting
        </h1>
        <p class="auth-subtitle">
          Create your account or sign in to start betting with $1,000 in virtual money
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
          <input 
            id="login-password"
            v-model="loginForm.password" 
            type="password" 
            required 
            placeholder="Enter your password"
            class="form-input"
          />
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
          <input 
          id="signup-password"
          v-model="signupForm.password" 
          type="password" 
          required 
          placeholder="Choose a password"
          class="form-input"
          />
        </div>
        <p class="signup-info">Not very secure so just use simple passwords</p>
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

.signup-info {
  text-align: center;
  color: #059669;
  font-weight: 600;
  margin-bottom: 1.5rem;
  padding: 0.75rem;
  background: #ecfdf5;
  border-radius: 8px;
  border: 1px solid #a7f3d0;
}

.form-group {
  margin-bottom: 1.5rem;
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
