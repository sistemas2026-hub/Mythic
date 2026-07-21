// Metro configurado para monorepo pnpm (workspaces).
// Ver: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Observar también la raíz del monorepo (para packages/*).
config.watchFolders = [workspaceRoot];

// 2. Resolver módulos desde la app y desde la raíz.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
