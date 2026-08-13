const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Metro configuration — monorepo aware.
 * Dependencies are hoisted to the repo-root node_modules, so Metro must
 * watch the workspace root and look there when resolving modules.
 * https://docs.expo.dev/guides/monorepos/
 *
 * @type {import('expo/metro-config').MetroConfig}
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so files in the root node_modules are served.
config.watchFolders = [workspaceRoot];
// Resolve modules from the app's own node_modules first, then the hoisted root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
