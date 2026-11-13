import { ScrollView } from 'react-native';

import { TraumaScreen } from '@/components/trauma/TraumaHeader';
import { VitalMonitorView } from '@/components/trauma/VitalMonitorView';

export default function HomeScreen() {
  return (
    <TraumaScreen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <VitalMonitorView />
      </ScrollView>
    </TraumaScreen>
  );
}
