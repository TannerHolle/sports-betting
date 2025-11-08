import { ref } from 'vue'

// Global ref to store the openChatWithGame function
const openChatWithGameRef = ref(null)

export function useChatWidget() {
  const setOpenChatWithGame = (fn) => {
    openChatWithGameRef.value = fn
  }

  const openChatWithGame = (...args) => {
    if (openChatWithGameRef.value) {
      return openChatWithGameRef.value(...args)
    } else {
      console.warn('ChatWidget is not available')
    }
  }

  return {
    setOpenChatWithGame,
    openChatWithGame
  }
}

