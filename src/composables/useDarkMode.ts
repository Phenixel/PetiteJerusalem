import { ref, onMounted } from 'vue'

const isDark = ref(false)

export function useDarkMode() {
  const applyTheme = () => {
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  onMounted(() => {
    // Check system preference
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    applyTheme()

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      isDark.value = e.matches
      applyTheme()
    })
  })

  return {
    isDark,
  }
}
