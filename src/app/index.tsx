import { Redirect } from 'expo-router';

/**
 * Root-Index leitet sofort in die Drawer-Gruppe weiter.
 * Die Rollenweiterleitung übernimmt (drawer)/index.tsx.
 */
export default function RootIndex() {
  return <Redirect href="/(drawer)/" />;
}
