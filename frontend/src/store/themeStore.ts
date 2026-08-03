import { create } from 'zustand';

interface ThemeState {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const useThemeStore = create<ThemeState>((set) => {
  const getInitialTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  return {
    isDarkMode: getInitialTheme(),
    toggleDarkMode: () => set((state) => {
      const newIsDarkMode = !state.isDarkMode;
      localStorage.setItem('theme', newIsDarkMode ? 'dark' : 'light');
      
      if (newIsDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      return { isDarkMode: newIsDarkMode };
    }),
  };
});
