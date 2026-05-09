// ─── Tab Navigator — Odoo-style Home Grid ─────────────────────────────────────
// 4 visible tabs: Home, Inbox, Chat, Settings.
// All other screens are accessible via the Home grid (dashboard.tsx) and are
// registered as tabs here so Expo Router can route to them, but they are not
// shown in the custom tab bar.
// When the user is inside any secondary module (Leads, Quotations, etc.),
// the Home tab stays active in the bar — same pattern as Odoo Mobile.

import { Tabs, router } from 'expo-router';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/config';

// Tabs that have their own bottom-nav slot
const PRIMARY_TABS = new Set(['triage', 'chat', 'assistant']);

const NAV_ITEMS = [
  { name: 'dashboard', icon: '🏠', label: 'Home' },
  { name: 'triage',   icon: '📥', label: 'Inbox' },
  { name: 'chat',     icon: '🗨️', label: 'Chat' },
  { name: 'assistant', icon: '✦', label: 'AI' },
] as const;

// ─── Back Button for secondary modules ───────────────────────────────────────
// Secondary modules (Leads, Quotations, etc.) are tabs, not stack screens, so
// Expo Router gives them no back gesture or header back button. This component
// renders a ‹ arrow in the header that returns the user to Home (dashboard).

function BackToHome() {
  return (
    <TouchableOpacity
      onPress={() => router.navigate('/(tabs)/dashboard')}
      style={{ paddingHorizontal: 14, paddingVertical: 4 }}
      accessibilityLabel="Back to Home"
      accessibilityRole="button"
    >
      <Text style={{ color: COLORS.white, fontSize: 22, lineHeight: 26 }}>‹</Text>
    </TouchableOpacity>
  );
}

// ─── Custom Tab Bar ───────────────────────────────────────────────────────────

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const currentRoute: string = state.routes[state.index]?.name ?? 'dashboard';

  // If the current route is a secondary module (Leads, Quotations, etc.),
  // highlight Home as the active tab.
  const activeTab = PRIMARY_TABS.has(currentRoute) ? currentRoute : 'dashboard';

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {NAV_ITEMS.map(tab => {
        const isActive = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabItem}
            onPress={() => navigation.navigate(tab.name)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <Text style={[styles.tabIcon, { opacity: isActive ? 1 : 0.4 }]}>
              {tab.icon}
            </Text>
            <Text style={[
              styles.tabLabel,
              {
                color: isActive ? COLORS.forest : COLORS.muted,
                fontWeight: isActive ? '700' : '400',
              },
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  tabIcon:  { fontSize: 22 },
  tabLabel: { fontSize: 11 },
});

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.forest },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      {/* -- Visible in bottom nav ------------------------------------------ */}
      <Tabs.Screen name="dashboard" options={{ title: 'Home' }} />
      <Tabs.Screen name="triage"    options={{ title: 'Inbox' }} />
      <Tabs.Screen name="chat"      options={{ title: 'Chat' }} />
      <Tabs.Screen name="assistant" options={{ title: 'AI Assistant' }} />

      {/* -- Accessible via Home grid, not in tab bar ----------------------- */}
      {/* All secondary modules get a ‹ back button in the header so users  */}
      {/* can return to Home — Tabs have no native back gesture.            */}
      <Tabs.Screen name="leads"           options={{ title: 'Leads',          headerLeft: () => <BackToHome /> }} />
      <Tabs.Screen name="quotations"      options={{ title: 'Quotations',     headerLeft: () => <BackToHome /> }} />
      <Tabs.Screen name="inquiries"       options={{ title: 'Inquiries',      headerLeft: () => <BackToHome /> }} />
      <Tabs.Screen name="approvals"       options={{ title: 'Approvals',      headerLeft: () => <BackToHome /> }} />
      <Tabs.Screen name="activities"      options={{ title: 'Activities',     headerLeft: () => <BackToHome /> }} />
      <Tabs.Screen name="shipments"       options={{ title: 'Shipments',      headerLeft: () => <BackToHome /> }} />
      <Tabs.Screen name="invoices"        options={{ title: 'Invoices',       headerLeft: () => <BackToHome /> }} />
      <Tabs.Screen name="sales-orders"    options={{ title: 'Sales Orders',   headerLeft: () => <BackToHome /> }} />
      <Tabs.Screen name="purchase-orders" options={{ title: 'Purchase Orders',headerLeft: () => <BackToHome /> }} />
      <Tabs.Screen name="products"        options={{ title: 'Products',       headerLeft: () => <BackToHome /> }} />
      <Tabs.Screen name="customers"       options={{ title: 'Customers',      headerLeft: () => <BackToHome /> }} />
      <Tabs.Screen name="factories"       options={{ title: 'Factories',      headerLeft: () => <BackToHome /> }} />
      <Tabs.Screen name="research"        options={{ title: 'AI Research',    headerLeft: () => <BackToHome /> }} />
      <Tabs.Screen name="settings"        options={{ title: 'Settings',       headerLeft: () => <BackToHome /> }} />
    </Tabs>
  );
}
