import { Tabs } from 'expo-router';
import { PlatformPressable } from 'expo-router/react-navigation';
import type { BottomTabBarButtonProps } from 'expo-router/tabs';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { StyleSheet, type ColorValue } from 'react-native';

import { GuideTarget } from '@/demo-mode/guide/guide-target';
import { unreadCount } from '@/offchain/chat/merge';
import { chatTabLabel } from '@/screens/chat/line-model';
import { useChat, useRooms } from '@/state/app-services';
import { colors } from '@/theme';

const icon = (name: SymbolViewProps['name']) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <SymbolView name={name} tintColor={color} size={size} />;
  };

/** the default tab button, a target of the demo's guide (`tab.<route>`); one per route, made once, so the buttons are
    not remounted at each render of the tabs */
const tabButtons = new Map<string, (props: BottomTabBarButtonProps) => ReactNode>();
const tabButton = (route: string) => {
  let b = tabButtons.get(route);
  if (!b) {
    b = function TabButton(props: BottomTabBarButtonProps) {
      return (
        <GuideTarget id={`tab.${route}`} anyScreen style={styles.tab}>
          <PlatformPressable {...props} />
        </GuideTarget>
      );
    };
    tabButtons.set(route, b);
  }
  return b;
};

export default function TabsLayout() {
  // Public's, plus what the scans counted in the rooms joined
  const unread = useChat((s) => unreadCount(s, s.lastSeen, s.mine)) + useRooms((r) => r.book.rooms.reduce((n, e) => n + r.unreadOf(e.id), 0));
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarButton: tabButton(route.name),
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.fg,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.line },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: colors.bg },
      })}>
      <Tabs.Screen name="index" options={{ title: 'gno.world', tabBarLabel: 'Home', tabBarIcon: icon({ ios: 'house.fill', android: 'home' }) }} />
      {/* Chat before Pools: what most people open */}
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat', headerShown: false, tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarAccessibilityLabel: chatTabLabel(unread),
          tabBarIcon: icon({ ios: 'bubble.left.and.bubble.right.fill', android: 'forum' }),
        }}
      />
      <Tabs.Screen name="pools" options={{ title: 'Pools', tabBarIcon: icon({ ios: 'bubbles.and.sparkles', android: 'bubble_chart' }) }} />
      <Tabs.Screen name="session" options={{ title: 'Session', tabBarIcon: icon({ ios: 'key.fill', android: 'key' }) }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon({ ios: 'gearshape.fill', android: 'settings' }) }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({ tab: { flex: 1 } });
