import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { fetchPrices, fetchWhere, type PriceDays } from '@/offchain/home';
import { useServices } from '@/state/app-services';
import { colors, space } from '@/theme';

import { ChatCard } from './chat-card';
import { HereCard } from './here-card';
import { PriceCard } from './price-card';
import { usePoll } from './use-poll';

const PRICE_EVERY_MS = 300000; // as the site's hereStatPaint
const WHERE_EVERY_MS = 20000; // the presence heartbeat's rhythm

export function HomeScreen() {
  const { offchain } = useServices();
  const [days, setDays] = useState<PriceDays>(1);
  const prices = usePoll(() => fetchPrices(offchain, days), PRICE_EVERY_MS, String(days));
  const where = usePoll(() => fetchWhere(offchain), WHERE_EVERY_MS);
  const [refreshing, setRefreshing] = useState(false);

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={
        <RefreshControl
          tintColor={colors.fg}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await Promise.all([prices.refresh(), where.refresh()]);
            setRefreshing(false);
          }}
        />
      }>
      <PriceCard data={prices.data} failed={prices.failed} days={days} onDays={setDays} />
      <HereCard data={where.data} failed={where.failed} />
      <ChatCard />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.l, gap: space.m },
});
