import { Stack } from 'expo-router';

export default function ScannerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="result" />
      <Stack.Screen name="ocr-capture" />
    </Stack>
  );
}
