/**
 * (drawer)/index.tsx wird nicht direkt aufgerufen.
 * Die Rollenbasierte Weiterleitung übernimmt AppGate in src/app/_layout.tsx.
 * Diese Datei muss existieren, damit expo-router die Route kennt.
 */
import { View } from 'react-native';

export default function DrawerIndex() {
  return <View />;
}
