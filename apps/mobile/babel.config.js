module.exports = {
  // babel-preset-expo auto-detects react-native-worklets and appends its
  // plugin (react-native-worklets/plugin, required by reanimated v4) itself —
  // don't also list it in `plugins` or Babel throws "Duplicate plugin".
  presets: ['babel-preset-expo'],
};
