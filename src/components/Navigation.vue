<template>
  <nav class="navigation">
    <div class="nav-container">
      <div class="nav-brand">
        <span class="brand-icon">🏈</span>
        <span class="brand-text">Sports Hub</span>
      </div>
      
      <div class="nav-links">
        <!-- Show Scoreboard button only when on betting page -->
        <button 
          v-if="currentPage === 'betting'"
          @click="$emit('change-page', 'scoreboard')"
          class="nav-link"
        >
          <span class="nav-icon">📊</span>
          Scoreboard
        </button>
        
        <!-- Show Fantasy Betting button only when on scoreboard page -->
        <button 
          v-if="currentPage === 'scoreboard'"
          @click="$emit('change-page', 'betting')"
          class="nav-link"
        >
          <span class="nav-icon">🎯</span>
          Fantasy Betting
        </button>
      </div>
    </div>
  </nav>
</template>

<script>
export default {
  name: 'Navigation',
  props: {
    currentPage: {
      type: String,
      required: true
    }
  },
  emits: ['change-page']
}
</script>

<style scoped>
.navigation {
  background: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.5rem;
  font-weight: 800;
  color: #1a1a1a;
}

.brand-icon {
  font-size: 2rem;
}

.brand-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.nav-links {
  display: flex;
  gap: 0.5rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: 2px solid transparent;
  background: #f8fafc;
  border-radius: 8px;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1rem;
}

.nav-link:hover {
  background: #e2e8f0;
  color: #374151;
  transform: translateY(-1px);
}

.nav-link.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.nav-link.active:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.nav-icon {
  font-size: 1.2rem;
}

@media (max-width: 768px) {
  .nav-container {
    padding: 1rem;
    flex-direction: column;
    gap: 1rem;
  }
  
  .nav-brand {
    font-size: 1.25rem;
  }
  
  .brand-icon {
    font-size: 1.5rem;
  }
  
  .nav-links {
    width: 100%;
    justify-content: center;
  }
  
  .nav-link {
    flex: 1;
    justify-content: center;
    padding: 0.875rem 1rem;
  }
}
</style>
