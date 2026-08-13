module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.js'],
  // jest-expo's own default (see node_modules/jest-expo/jest-preset.js) omits
  // react-redux, which ships an ESM-only build behind its "react-native"
  // package.json condition (fine for Metro, but Jest's CJS loader can't
  // require() raw `import` syntax) — reuse that default pattern verbatim and
  // add react-redux, rather than narrowing it by hand.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|react-redux|@reduxjs/toolkit|immer|redux))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
};
