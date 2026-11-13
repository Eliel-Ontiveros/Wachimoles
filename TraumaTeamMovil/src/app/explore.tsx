import React, { useState, useEffect } from 'react';
import { ScrollView, BackHandler } from 'react-native';

import { BodyView } from '@/components/trauma/BodyView';
import { TraumaScreen } from '@/components/trauma/TraumaHeader';

export default function ExploreScreen() {
  const [scrollEnabled, setScrollEnabled] = useState(true);

  useEffect(() => {
    if (!scrollEnabled) {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }
  }, [scrollEnabled]);

  return (
    <TraumaScreen>
      <ScrollView
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
      >
        <BodyView onSetScrollEnabled={setScrollEnabled} />
      </ScrollView>
    </TraumaScreen>
  );
}
