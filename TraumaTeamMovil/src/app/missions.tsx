import { ScrollView } from 'react-native';

import { MissionsView } from '@/components/trauma/MissionsView';
import { TraumaScreen } from '@/components/trauma/TraumaHeader';

export default function MissionsScreen() {
  return (
    <TraumaScreen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <MissionsView />
      </ScrollView>
    </TraumaScreen>
  );
}

