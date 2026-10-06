import { AppRouter } from '@/app/router/AppRouter';
import { ThemeProvider } from '@/theme/ThemeProvider';

export function App() {
  return (
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  );
}
