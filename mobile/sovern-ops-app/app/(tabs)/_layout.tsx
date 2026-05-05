// ─── Tab Navigator ────────────────────────────────────────────────────────
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { COLORS } from '../../src/constants/config';

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icon}</Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.forest,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
        },
        tabBarScrollEnabled: true,
        headerStyle: { backgroundColor: COLORS.forest },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      {/* — Decision surfaces (top of nav, things that need your attention) — */}
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: ({ focused }) => <TabIcon icon="📊" focused={focused} /> }} />
      <Tabs.Screen name="triage"    options={{ title: 'Inbox',    tabBarIcon: ({ focused }) => <TabIcon icon="📥" focused={focused} /> }} />
      <Tabs.Screen name="approvals" options={{ title: 'Approvals', tabBarIcon: ({ focused }) => <TabIcon icon="✅" focused={focused} /> }} />
      <Tabs.Screen name="activities" options={{ title: 'Activities', tabBarIcon: ({ focused }) => <TabIcon icon="🗓️" focused={focused} /> }} />

      {/* — CRM — */}
      <Tabs.Screen name="inquiries"   options={{ title: 'Inquiries',   tabBarIcon: ({ focused }) => <TabIcon icon="📨" focused={focused} /> }} />
      <Tabs.Screen name="leads"       options={{ title: 'Leads',       tabBarIcon: ({ focused }) => <TabIcon icon="👥" focused={focused} /> }} />
      <Tabs.Screen name="quotations"  options={{ title: 'Quotations',  tabBarIcon: ({ focused }) => <TabIcon icon="💬" focused={focused} /> }} />

      {/* — Operations (read-only on the road) — */}
      <Tabs.Screen name="shipments" options={{ title: 'Shipments', tabBarIcon: ({ focused }) => <TabIcon icon="🚢" focused={focused} /> }} />
      <Tabs.Screen name="invoices"  options={{ title: 'Invoices',  tabBarIcon: ({ focused }) => <TabIcon icon="🧾" focused={focused} /> }} />
      <Tabs.Screen name="purchase-orders" options={{ title: 'POs', tabBarIcon: ({ focused }) => <TabIcon icon="📋" focused={focused} /> }} />

      {/* — Reference data — */}
      <Tabs.Screen name="products"  options={{ title: 'Products',  tabBarIcon: ({ focused }) => <TabIcon icon="📦" focused={focused} /> }} />
      <Tabs.Screen name="customers" options={{ title: 'Customers', tabBarIcon: ({ focused }) => <TabIcon icon="🏢" focused={focused} /> }} />