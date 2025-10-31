// API configuration using environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'

// Log which API we're using for debugging
console.log('🌐 Using API:', API_BASE_URL)

export { API_BASE_URL }
