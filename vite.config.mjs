import { svelte } from "@sveltejs/vite-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve"; // This resolves NPM modules from node_modules.
import preprocess from "svelte-preprocess";
import { MODULE_ID } from "./src/helpers/constants.js";
import { postcssConfig, terserConfig, typhonjsRuntime } from "#runtime/rollup";
import * as path from "path";
import sass from 'sass'; // Import sass for svelte preprocessing

const s_COMPRESS = false; // Set to true to compress the module bundle.
const s_SOURCEMAPS = true; // Generate sourcemaps for the bundle (recommended).

// Set to true to enable linking against the TyphonJS Runtime Library module.
// You must add a Foundry module dependency on the `typhonjs` Foundry package or manually install it in Foundry from:
// https://github.com/typhonjs-fvtt-lib/typhonjs/releases/latest/download/module.json
const s_TYPHONJS_MODULE_LIB = false;

// Used in bundling.
const s_RESOLVE_CONFIG = {
  browser: true,
  dedupe: ["svelte"],
};

// ATTENTION!
// You must change `base` and the `proxy` strings replacing `/modules/${MODULE_ID}/` with your
// module or system ID.

export default () => {
  /** @type {import('vite').UserConfig} */
  return {
    root: "src/", // Source location / esbuild root.
    base: `/modules/${MODULE_ID}/`, // Base module path that 30001 / served dev directory.
    publicDir: false, // No public resources to copy.
    cacheDir: "../.vite-cache", // Relative from root directory.

    test: {
      mockReset: true,
      globals: true,
    },

    resolve: {
      conditions: ["import", "browser"],
      alias: {
        "~": path.resolve(__dirname)
      },
    },

    // Add Foundry globals
    define: {
      'global': {},
      'process.env': {}
    },

    esbuild: {
      target: ["es2022", "chrome100"],
      keepNames: true, // Note: doesn't seem to work.
    },

    css: {
      // Creates a standard configuration for PostCSS with autoprefixer & postcss-preset-env.
      postcss: postcssConfig({ compress: s_COMPRESS, sourceMap: s_SOURCEMAPS }),
      url: false,
    },

    // About server options:
    // - Set to `open` to boolean `false` to not open a browser window automatically. This is useful if you set up a
    // debugger instance in your IDE and launch it with the URL: 'http://localhost:30001/game'.
    //
    // - The top proxy entry for `lang` will pull the language resources from the main Foundry / 30000 server. This
    // is necessary to reference the dev resources as the root is `/src` and there is no public / static resources
    // served.
    server: {
      port: 30001,
      // open: "/game",
      open: false,
      // Force Vite to expose style.css at the expected path
      fs: {
        allow: ['..', 'dist']  // Allow serving files from the dist directory
      },
      proxy: {
        // Redirect specific requests to the main Foundry server
        [`^(/modules/${MODULE_ID}/(lang|packs|assets))`]: "http://localhost:30000",
        // Special handling for index.js in dev mode - map dist/index.js to our Vite-served index.js
        [`^/modules/${MODULE_ID}/dist/index.js`]: {
          target: "http://localhost:30001",
          rewrite: (path) => `/modules/${MODULE_ID}/index.js`
        },
        // Add a specific rule for style.css - redirect to the CSS file that Vite is actually serving
        [`^/modules/${MODULE_ID}/dist/style.css`]: {
          target: "http://localhost:30001",
          rewrite: (path) => `/css/style.css`
        },
        // All other requests go to the main Foundry server
        [`^(?!/modules/${MODULE_ID}/)`]: "http://localhost:30000",
        "/socket.io": { target: "ws://localhost:30000", ws: true }
      },
    },

    build: {
      outDir: __dirname+'/dist',
      emptyOutDir: false,
      sourcemap: s_SOURCEMAPS,
      brotliSize: true,
      minify: s_COMPRESS ? "terser" : false,
      target: ["es2022", "chrome100"],
      terserOptions: s_COMPRESS ? { ...terserConfig(), ecma: 2022 } : void 0,
      rollupOptions: {
        input: "./src/index.js",
        output: {
          entryFileNames: "index.js",
          format: "es",
          assetFileNames: (assetInfo) => {
            // Force CSS files to be named style.css
            if (assetInfo.name === 'style.css' || assetInfo.name.endsWith('.css')) {
              return 'style.css';
            }
            return '[name].[ext]';
          }
        },
        external: (id) => id.startsWith("/modules/foundryvtt-final-fantasy/assets/"), // Correctly return `true/false`.
      }
    },
    
    plugins: [
      // Note: Vite handles style injection automatically in development mode
      // No custom middleware needed for style injection
      
      // Custom plugin to handle CSS loading in development mode
      {
        name: 'css-redirect',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            // If Foundry is requesting the CSS file from the dist directory
            if (req.url === `/modules/${MODULE_ID}/dist/style.css`) {
              // In development mode, we want to prevent loading both CSS files
              // Return an empty CSS file with proper headers to satisfy the request
              // without actually loading duplicate styles
              res.setHeader('Content-Type', 'text/css');
              res.end('/* CSS is loaded via Vite\'s hot module replacement in development mode */');
              return;
            }
            next();
          });
        }
      },
      
      svelte({
        preprocess: preprocess({
          pug: true,
          sass: {
            // This ensures imported SASS files are correctly processed
            renderSync: true,
            implementation: sass
          }
        }),
        onwarn: (warning, handler) => {
          // Suppress `a11y-missing-attribute` for missing href in <a> links.
          // Foundry doesn't follow accessibility rules.
          if (warning.message.includes(`<a> element should have an href attribute`)) {
            return;
          }

          // Suppress keyboard event handler warnings since Foundry uses tab for targeting
          if (warning.message.includes(`visible, non-interactive elements with an on:click event must be accompanied by a keyboard event handler`)) {
            return;
          }

          // Suppress tabindex warnings since Foundry uses tab for targeting
          if (warning.message.includes(`Elements with the 'button' interactive role must have a tabindex value`)) {
            return;
          }

          // Suppress warnings about non-interactive img elements with click handlers
          if (warning.message.includes(`Non-interactive element <img> should not be assigned mouse or keyboard event listeners`)) {
            return;
          }

          // Suppress asset resolution warnings
          if (warning.message && warning.message.includes("didn't resolve at build time")) {
            return;
          }

          // Suppress warnings about Foundry global variables
          if (warning.code === 'undefined-variable' && ['game', 'foundry', 'CONFIG', 'Hooks', 'Actors', 'Items', 'Dialog', 'Roll', 'fromUuid'].includes(warning.message.split("'")[1])) {
            return;
          }

          // Suppress warnings about Foundry global variables in template expressions
          if (warning.code === 'missing-declaration' && ['game', 'foundry', 'CONFIG', 'Hooks', 'Actors', 'Items', 'Dialog', 'Roll', 'fromUuid'].includes(warning.message.split("'")[1])) {
            return;
          }

          // Let Rollup handle all other warnings normally.
          handler(warning);
        },
      }),

      resolve(s_RESOLVE_CONFIG), // Necessary when bundling npm-linked packages.

      // When s_TYPHONJS_MODULE_LIB is true transpile against the Foundry module version of TRL.
      s_TYPHONJS_MODULE_LIB && typhonjsRuntime(),
    ]
  };
};

