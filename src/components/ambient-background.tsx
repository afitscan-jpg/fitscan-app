import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { Gradients } from '@/constants/theme';

/**
 * v3's "morning light" ambient wash: a soft top-anchored cream gradient with two
 * faint wellness-tinted glows (sage + warm sand) approximating the html's organic
 * blobs. Purely decorative — absolutely positioned behind screen content, never
 * intercepts touches. Blob blur is approximated with large translucent radials
 * (soft, low-opacity) since RN has no view blur without a native lib.
 */
export function AmbientBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={Gradients.ambient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.blobSage} />
      <View style={styles.blobSand} />
    </View>
  );
}

const styles = StyleSheet.create({
  blobSage: {
    position: 'absolute',
    top: -120,
    right: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(196,214,178,0.28)',
  },
  blobSand: {
    position: 'absolute',
    bottom: 80,
    left: -110,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(233,204,166,0.22)',
  },
});
