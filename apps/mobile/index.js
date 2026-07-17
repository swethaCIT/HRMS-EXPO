/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundHandler } from './src/utils/pushNotifications';

// Must run before registerComponent — the only place React Native Firebase
// allows the background/quit-state message handler to be set up. No-ops safely
// if no Firebase project is configured yet (see pushNotifications.ts).
registerBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
