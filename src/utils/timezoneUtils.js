/**
 * Utility functions for handling timezone conversions and time formatting
 */

/**
 * Convert a time string to the user's local timezone
 * @param {string} timeString - Time string from API (e.g., "10/27 - 8:00 PM EDT")
 * @returns {string} - Formatted time in user's local timezone
 */
export function convertToLocalTime(timeString) {
  if (!timeString) return timeString
  
  try {
    // Handle different time formats from ESPN API
    // Format 1: "10/27 - 8:00 PM EDT" or "10/27 - 8:00 PM EST"
    // Format 2: "Oct 27, 8:00 PM EDT"
    // Format 3: "8:00 PM EDT"
    
    let dateTimeStr = timeString.trim()
    
    // If it's just a time without date, assume today
    if (dateTimeStr.match(/^\d{1,2}:\d{2}\s*[AP]M\s*[A-Z]{3,4}$/)) {
      const today = new Date()
      const month = today.getMonth() + 1
      const day = today.getDate()
      dateTimeStr = `${month}/${day} - ${dateTimeStr}`
    }
    
    // Extract date and time parts
    const dateTimeMatch = dateTimeStr.match(/(\d{1,2}\/\d{1,2})\s*-\s*(.+)/)
    if (dateTimeMatch) {
      const [, datePart, timePart] = dateTimeMatch
      const currentYear = new Date().getFullYear()
      const [month, day] = datePart.split('/')
      
      // Create a date string that can be parsed
      const fullDateStr = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timePart}`
      
      // Parse the date in the original timezone
      const originalDate = new Date(fullDateStr)
      
      // Check if the date is valid
      if (isNaN(originalDate.getTime())) {
        return timeString // Return original if parsing fails
      }
      
      // Convert to local timezone
      return originalDate.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      })
    }
    
    // Try to parse as a full date string
    const parsedDate = new Date(dateTimeStr)
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      })
    }
    
    // If all parsing fails, return original
    return timeString
    
  } catch (error) {
    console.warn('Error converting time to local timezone:', error)
    return timeString
  }
}

/**
 * Format a date string to show relative time (e.g., "Today at 8:00 PM", "Tomorrow at 2:00 PM")
 * @param {string} timeString - Time string from API
 * @returns {string} - Formatted relative time
 */
export function formatRelativeTime(timeString) {
  if (!timeString) return timeString
  
  try {
    const convertedTime = convertToLocalTime(timeString)
    const now = new Date()
    const gameDate = new Date(convertedTime)
    
    if (isNaN(gameDate.getTime())) {
      return convertedTime
    }
    
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const gameDay = new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const timeStr = gameDate.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    
    if (gameDay.getTime() === today.getTime()) {
      return `Today at ${timeStr}`
    } else if (gameDay.getTime() === tomorrow.getTime()) {
      return `Tomorrow at ${timeStr}`
    } else {
      return convertedTime
    }
    
  } catch (error) {
    console.warn('Error formatting relative time:', error)
    return timeString
  }
}

/**
 * Get the user's timezone
 * @returns {string} - User's timezone (e.g., "America/New_York")
 */
export function getUserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Check if a game is today in the user's local timezone
 * Properly handles UTC dates from the API by normalizing both dates to local timezone
 * @param {string} gameDate - Game date string (ISO format, e.g., "2025-10-26T18:00Z")
 * @returns {boolean} - True if game is today in user's local timezone
 */
export function isGameToday(gameDate) {
  if (!gameDate) return false
  
  try {
    // Parse the game date (which may be in UTC or with timezone info)
    const game = new Date(gameDate)
    
    if (isNaN(game.getTime())) {
      return false
    }
    
    // Get current date/time in local timezone
    const now = new Date()
    
    // Convert both to local timezone date strings for comparison
    // This ensures we're comparing the actual calendar date in the user's timezone
    const gameLocalDate = new Date(game.getFullYear(), game.getMonth(), game.getDate())
    const todayLocalDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Compare the timestamp of the start of each day in local time
    return gameLocalDate.getTime() === todayLocalDate.getTime()
  } catch (error) {
    console.warn('Error checking if game is today:', error)
    return false
  }
}

/**
 * Check if a game is tomorrow in the user's local timezone
 * Properly handles UTC dates from the API by normalizing both dates to local timezone
 * @param {string} gameDate - Game date string (ISO format, e.g., "2025-10-27T18:00Z")
 * @returns {boolean} - True if game is tomorrow in user's local timezone
 */
export function isGameTomorrow(gameDate) {
  if (!gameDate) return false
  
  try {
    // Get tomorrow's date in local timezone
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    // Extract date parts from tomorrow
    const tomorrowYear = tomorrow.getFullYear()
    const tomorrowMonth = tomorrow.getMonth() + 1 // 1-12
    const tomorrowDay = tomorrow.getDate()
    
    // Format tomorrow as YYYY-MM-DD for comparison
    const tomorrowStr = `${tomorrowYear}-${String(tomorrowMonth).padStart(2, '0')}-${String(tomorrowDay).padStart(2, '0')}`
    
    // Extract date part from game date string (handles both ISO and date-only formats)
    // ESPN API dates are typically in format: "2025-11-06T00:00Z" or "2025-11-06T02:00Z"
    const dateMatch = gameDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (dateMatch) {
      const gameYear = dateMatch[1]
      const gameMonth = dateMatch[2]
      const gameDay = dateMatch[3]
      const gameDateStr = `${gameYear}-${gameMonth}-${gameDay}`
      
      return gameDateStr === tomorrowStr
    }
    
    // Fallback: parse as Date object and compare
    const game = new Date(gameDate)
    if (isNaN(game.getTime())) {
      return false
    }
    
    const gameYear = game.getFullYear()
    const gameMonth = game.getMonth()
    const gameDay = game.getDate()
    
    return gameYear === tomorrowYear && 
           gameMonth === tomorrow.getMonth() && 
           gameDay === tomorrowDay
  } catch (error) {
    console.warn('Error checking if game is tomorrow:', error)
    return false
  }
}
