import { useEffect } from 'react';
import { Stack, useSegments, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export default function RootLayout() {
  const { session, setSession } = useAuthStore();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  const inAuthGroup = segments[0] === '(auth)';

  // Declarative redirects: use Redirect component instead of router.replace
  if (!session && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }

  if (session && inAuthGroup) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="habit/new"
          options={{ presentation: 'modal', headerShown: true, title: 'New Habit' }}
        />
        <Stack.Screen
          name="social/search"
          options={{ presentation: 'modal', headerShown: true, title: 'Search Friends' }}
        />
        <Stack.Screen
          name="habit/[id]"
          options={{ headerShown: true, title: 'Habit Details' }}
        />
      </Stack>
    </>
  );
}
