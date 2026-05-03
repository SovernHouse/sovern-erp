// Root index — immediately redirect to login.
// The auth guard in _layout.tsx will redirect authenticated users
// onward to /(tabs)/dashboard from there.
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(auth)/login" />;
}
