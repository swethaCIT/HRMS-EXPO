const path = require('path');
const { getDefaultConfig, mergeConfig } = require('expo/metro-config');

/**
 * Metro configuration — monorepo aware.
 * Dependencies are hoisted to the repo-root node_modules, so Metro must
 * watch the workspace root and look there when resolving modules.
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = {
  // Watch the whole monorepo so files in the root node_modules are served.
  watchFolders: [workspaceRoot],
  resolver: {
    // Resolve modules from the app's own node_modules first, then the hoisted root.
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
