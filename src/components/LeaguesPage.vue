<template>
  <div class="leagues-page">
    <div class="page-header">
      <h1 class="page-title">
        Leagues
      </h1>
      <p class="page-description">
        Create or join leagues to compete with friends
      </p>
    </div>

    <LeagueManagement />
  </div>
</template>

<script>
import LeagueManagement from './LeagueManagement.vue'

export default {
  name: 'LeaguesPage',
  components: {
    LeagueManagement
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
  margin-bottom: 3rem;
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
}
</style>

