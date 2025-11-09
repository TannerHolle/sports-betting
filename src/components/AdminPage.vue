<template>
  <div class="admin-page" v-if="isAdmin">
    <div class="page-header">
      <h1 class="page-title">Admin Panel</h1>
      <p class="page-description">
        Administrative controls for the betting system
      </p>
    </div>
    
    <AdminPanel />
  </div>
  <div v-else class="admin-page">
    <div class="page-header">
      <h1 class="page-title">Access Denied</h1>
      <p class="page-description">
        You do not have permission to access this page.
      </p>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useUserStore } from '../stores/userStore.js'
import AdminPanel from './AdminPanel.vue'

export default {
  name: 'AdminPage',
  components: {
    AdminPanel
  },
  setup() {
    const userStore = useUserStore()
    const currentUser = computed(() => userStore.currentUser.value)
    
    // Check if current user is admin
    const isAdmin = computed(() => {
      return currentUser.value?.username === 'tannerholle' || currentUser.value?.username === 'tanner'
    })
    
    return {
      isAdmin
    }
  }
}
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #4169e1 0%, #1e3a8a 100%);
  padding: 2rem 0;
}

.page-header {
  text-align: center;
  margin-bottom: 3rem;
  color: white;
  padding: 0 2rem;
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

@media (max-width: 768px) {
  .admin-page {
    padding: 1rem 0;
  }
  
  .page-title {
    font-size: 2rem;
  }
  
  .page-description {
    font-size: 1rem;
    padding: 0 1rem;
  }
}
</style>

