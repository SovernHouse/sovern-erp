/**
 * Desktop App Install — Phase 4.24.x-c.
 *
 * Mobile explainer screen. React Native apps cannot trigger PWA
 * installs (only the web app shell can), so this screen documents how
 * the user gets the desktop experience on Mac, Windows, and iPad.
 *
 * Reached from Settings -> "Get the Desktop App".
 */
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../src/constants/config';
import { Stack } from 'expo-router';

export default function DesktopAppInstallScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Get the Desktop App' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Sovern House Operations as a desktop app</Text>
        <Text style={styles.lede}>
          The ERP is a Progressive Web App: install it on your computer for a
          standalone window, dock icon, and Cmd-Q semantics. No App Store,
          no separate code, no extra licence.
        </Text>

        <View style={styles.platformBlock}>
          <Text style={styles.platformTitle}>macOS</Text>
          <Text style={styles.platformBody}>
            1. Open https://erp.sovernhouse.co in Brave or Chrome.{'\n'}
            2. Click the address-bar install icon (square with down-arrow), OR open the menu and choose
            <Text style={styles.bold}> Install Sovern House ERP</Text>.{'\n'}
            3. The app opens in its own window. Pin to Dock from Launchpad.
          </Text>
        </View>

        <View style={styles.platformBlock}>
          <Text style={styles.platformTitle}>Windows</Text>
          <Text style={styles.platformBody}>
            1. Open https://erp.sovernhouse.co in Brave, Chrome, or Edge.{'\n'}
            2. Click the address-bar install icon, OR open the menu and choose
            <Text style={styles.bold}> Install Sovern House ERP</Text>.{'\n'}
            3. The app shortcut lands on the desktop and Start menu.
          </Text>
        </View>

        <View style={styles.platformBlock}>
          <Text style={styles.platformTitle}>iPad (Safari)</Text>
          <Text style={styles.platformBody}>
            1. Open https://erp.sovernhouse.co in Safari.{'\n'}
            2. Tap the <Text style={styles.bold}>Share</Text> icon, then choose
            <Text style={styles.bold}> Add to Home Screen</Text>.{'\n'}
            3. The icon lands on the Home Screen and opens as a full-screen app.
          </Text>
        </View>

        <Text style={styles.note}>
          The install only needs to happen once per device per browser. Updates land automatically the next
          time you open the installed app.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.ink, marginBottom: 8 },
  lede: { fontSize: 14, color: COLORS.ink, lineHeight: 20, marginBottom: 24 },
  platformBlock: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  platformTitle: { fontSize: 16, fontWeight: '700', color: COLORS.forest, marginBottom: 8 },
  platformBody: { fontSize: 13, color: COLORS.ink, lineHeight: 20 },
  bold: { fontWeight: '700' },
  note: {
    fontSize: 12,
    color: COLORS.muted,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
});
