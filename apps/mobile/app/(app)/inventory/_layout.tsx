import { Stack } from 'expo-router';
import { colors } from '../../../src/theme';

export default function InventoryLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    />
  );
}
