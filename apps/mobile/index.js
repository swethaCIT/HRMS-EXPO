/**
 * @format
 */

import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App)
// and, in Expo Go, wires up the correct root view automatically. Background/
// quit-state push delivery is handled by the OS + Expo push service — no
// manual background-message-handler registration needed (unlike Firebase).
registerRootComponent(App);
