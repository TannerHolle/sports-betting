<template>
  <div class="leagues-page">
    <div class="page-header">
      <h1 class="page-title">
        Leagues
      </h1>
      <p class="page-description">
        Show your friends you know ball way better than them
      </p>
    </div>

    <div class="tabs-container">
      <div class="tabs-header">
        <button 
          @click="activeTab = 'friends'" 
          :class="{ active: activeTab === 'friends' }"
          class="tab-btn"
        >
          Friends' Bets
        </button>
        <button 
          @click="activeTab = 'management'" 
          :class="{ active: activeTab === 'management' }"
          class="tab-btn"
        >
          Management
        </button>
      </div>

      <div class="tab-content">
        <LeagueManagement v-if="activeTab === 'management'" />
        <FriendsBets v-if="activeTab === 'friends'" />
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import LeagueManagement from './LeagueManagement.vue'
import FriendsBets from './FriendsBets.vue'

export default {
  name: 'LeaguesPage',
  components: {
    LeagueManagement,
    FriendsBets
  },
  setup() {
    const activeTab = ref('friends')

    return {
      activeTab
    }
  }
}
</script>

<style scoped>
.leagues-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #4169e1 0%, #1e3a8a 100%);
  padding: 2rem 0;
}

.page-header {
  text-align: center;
  margin-bottom: 2rem;
  color: white;
}

.page-title {
  font-size: 3rem;
  font-weight: 800;
  margin: 0 0 1rem 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.page-description {
  font-size: 1.2rem;
  margin: 0;
  opacity: 0.9;
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
}

.tabs-container {
  margin: 0 auto;
  max-width: 100%;
  overflow-x: hidden;
}

.tabs-header {
  display: flex;
  gap: 0;
  margin-bottom: 0;
  background: white;
  border-radius: 12px 12px 0 0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 0;
  overflow: hidden;
}

.tab-btn {
  flex: 1;
  padding: 1rem 2rem;
  border: none;
  background: #f9fafb;
  border-bottom: 3px solid transparent;
  font-weight: 600;
  font-size: 1rem;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.tab-btn:hover {
  color: #374151;
  background: #f3f4f6;
}

.tab-btn.active {
  background: white;
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.tab-content {
  min-height: 400px;
  background: white;
  border-radius: 0 0 12px 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.tab-content :deep(.league-management),
.tab-content :deep(.friends-bets) {
  background: transparent;
  box-shadow: none;
  border-radius: 0;
  margin-bottom: 0;
}

@media (max-width: 768px) {
  .leagues-page {
    padding: 1rem 0;
  }
  
  .page-title {
    font-size: 2rem;
  }
  
  .page-description {
    font-size: 1rem;
    padding: 0 1rem;
  }

  .tabs-container {
    padding: 0 0.5rem;
    max-width: 100%;
    box-sizing: border-box;
  }
  
  .tab-content {
    overflow-x: hidden;
  }

  .tabs-header {
    width: 100%;
    max-width: 100%;
  }

  .tab-btn {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
  }
}
</style>

