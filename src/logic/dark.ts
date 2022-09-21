import { useDark } from '@vueuse/core'

const isDark = useDark()

const toggleDark = () => {
	isDark.value = !isDark.value
}

export { isDark, toggleDark }
