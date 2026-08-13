// AsyncStorage's native module isn't available under Jest's Node
// environment — use the package's own official mock.
// https://react-native-async-storage.github.io/async-storage/docs/advanced/jest/
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// react-native-gesture-handler's native `install()` call needs its own
// official jest mock too — https://docs.swmansion.com/react-native-gesture-handler/docs/guides/testing/
require('react-native-gesture-handler/jestSetup');
