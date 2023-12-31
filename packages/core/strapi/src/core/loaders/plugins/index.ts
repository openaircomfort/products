import { join } from 'path';
import fse from 'fs-extra';
import { defaultsDeep, defaults, getOr, get } from 'lodash/fp';
import { env } from '@strapi/utils';
import type { Strapi, Common, Schema } from '@strapi/types';
import { loadFile } from '../../app-configuration/load-config-file';
import loadFiles from '../../../load/load-files';
import { getEnabledPlugins } from './get-enabled-plugins';
import { getUserPluginsConfig } from './get-user-plugins-config';

type LoadedPlugin = {
  config: {
    default: Record<string, unknown> | ((opts: { env: typeof env }) => Record<string, unknown>);
    validator: (config: Record<string, unknown>) => void;
  };
  bootstrap: ({ strapi }: { strapi: Strapi }) => void | Promise<void>;
  destroy: ({ strapi }: { strapi: Strapi }) => void | Promise<void>;
  register: ({ strapi }: { strapi: Strapi }) => void | Promise<void>;
  routes: Record<string, Common.Router>;
  controllers: Record<string, Common.Controller>;
  services: Record<string, Common.Service>;
  policies: Record<string, Common.Policy>;
  middlewares: Record<string, Common.Middleware>;
  contentTypes: Record<string, { schema: Schema.ContentType }>;
};

interface Plugins {
  [key: string]: LoadedPlugin;
}

const defaultPlugin = {
  bootstrap() {},
  destroy() {},
  register() {},
  config: {
    default: {},
    validator() {},
  },
  routes: [],
  controllers: {},
  services: {},
  policies: {},
  middlewares: {},
  contentTypes: {},
};

const applyUserExtension = async (plugins: Plugins) => {
  const extensionsDir = strapi.dirs.dist.extensions;
  if (!(await fse.pathExists(extensionsDir))) {
    return;
  }

  const extendedSchemas = await loadFiles(extensionsDir, '**/content-types/**/schema.json');
  const strapiServers = await loadFiles(extensionsDir, '**/strapi-server.js');

  for (const pluginName of Object.keys(plugins)) {
    const plugin = plugins[pluginName];
    // first: load json schema
    for (const ctName of Object.keys(plugin.contentTypes)) {
      const extendedSchema = get([pluginName, 'content-types', ctName, 'schema'], extendedSchemas);
      if (extendedSchema) {
        plugin.contentTypes[ctName].schema = {
          ...plugin.contentTypes[ctName].schema,
          ...extendedSchema,
        };
      }
    }
    // second: execute strapi-server extension
    const strapiServer = get([pluginName, 'strapi-server'], strapiServers);
    if (strapiServer) {
      plugins[pluginName] = await strapiServer(plugin);
    }
  }
};

const applyUserConfig = async (plugins: Plugins) => {
  const userPluginsConfig = await getUserPluginsConfig();

  for (const pluginName of Object.keys(plugins)) {
    const plugin = plugins[pluginName];
    const userPluginConfig = getOr({}, `${pluginName}.config`, userPluginsConfig);
    const defaultConfig =
      typeof plugin.config.default === 'function'
        ? plugin.config.default({ env })
        : plugin.config.default;

    const config = defaultsDeep(defaultConfig, userPluginConfig);
    try {
      plugin.config.validator(config);
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`Error regarding ${pluginName} config: ${e.message}`);
      }

      throw e;
    }
    plugin.config = config;
  }
};

export default async function loadPlugins(strapi: Strapi) {
  const plugins: Plugins = {};

  const enabledPlugins = await getEnabledPlugins(strapi);

  strapi.config.set('enabledPlugins', enabledPlugins);

  for (const pluginName of Object.keys(enabledPlugins)) {
    const enabledPlugin = enabledPlugins[pluginName];

    let serverEntrypointPath;

    try {
      serverEntrypointPath = join(enabledPlugin.pathToPlugin, 'strapi-server.js');
    } catch (e) {
      throw new Error(
        `Error loading the plugin ${pluginName} because ${pluginName} is not installed. Please either install the plugin or remove it's configuration.`
      );
    }

    // only load plugins with a server entrypoint
    if (!(await fse.pathExists(serverEntrypointPath))) {
      continue;
    }

    const pluginServer = loadFile(serverEntrypointPath);
    plugins[pluginName] = {
      ...defaultPlugin,
      ...pluginServer,
      config: defaults(defaultPlugin.config, pluginServer.config),
      routes: pluginServer.routes ?? defaultPlugin.routes,
    };
  }

  // TODO: validate plugin format
  await applyUserConfig(plugins);
  await applyUserExtension(plugins);

  for (const pluginName of Object.keys(plugins)) {
    strapi.container.get('plugins').add(pluginName, plugins[pluginName]);
  }
}
