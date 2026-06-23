// craco.config.js
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
require("dotenv").config();

// Use the generated deployment metadata as the version compiled into this frontend build.
try {
  const { version } = require("./public/version.json");
  process.env.REACT_APP_VERSION = process.env.REACT_APP_VERSION || version;
} catch {
  // Development can still start before the first generated version file exists.
}

// Check if we're in development/preview mode (not production build)
// Craco sets NODE_ENV=development for start, NODE_ENV=production for build
const isDevServer = process.env.NODE_ENV !== "production";
const isLocalDesktopBuild = process.env.REACT_APP_LOCAL_DESKTOP === "true";

const removeLocalDesktopExternalStartupResources = (html) => html
  .replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"\s*\/?>/g, "")
  .replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin\s*\/?>/g, "")
  .replace(/\s*<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:wght@600&display=swap" rel="stylesheet"\s*\/?>/g, "")
  .replace(/\s*<script src="https:\/\/assets\.emergent\.sh\/scripts\/emergent-main\.js"><\/script>/g, "")
  .replace(/\s*<script>(?:(?!<\/script>)[\s\S])*posthog\.init[\s\S]*?<\/script>/g, "");

class LocalDesktopHtmlPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap("LocalDesktopHtmlPlugin", (compilation) => {
      HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tap(
        "LocalDesktopHtmlPlugin",
        (data) => {
          data.html = removeLocalDesktopExternalStartupResources(data.html);
          return data;
        },
      );
    });
  }
}

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

let webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  jest: {
    configure: {
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {

      // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
        ],
      };

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }

      if (isLocalDesktopBuild) {
        webpackConfig.plugins.push(new LocalDesktopHtmlPlugin());
      }

      return webpackConfig;
    },
  },
};

webpackConfig.devServer = (devServerConfig) => {
  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
    };
  }

  return devServerConfig;
};

// Wrap with visual edits (automatically adds babel plugin, dev server, and overlay in dev mode)
if (isDevServer) {
  try {
    const { withVisualEdits } = require("@emergentbase/visual-edits/craco");
    webpackConfig = withVisualEdits(webpackConfig);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && err.message.includes('@emergentbase/visual-edits/craco')) {
      console.warn(
        "[visual-edits] @emergentbase/visual-edits not installed — visual editing disabled."
      );
    } else {
      throw err;
    }
  }
}

module.exports = webpackConfig;
