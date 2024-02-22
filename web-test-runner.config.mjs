import { playwrightLauncher } from '@web/test-runner-playwright';
import { fromRollup } from '@web/dev-server-rollup';
import commonjs from '@rollup/plugin-commonjs';

const filteredLogs = ['Running in dev mode', 'lit-html is in dev mode', 'Lit is in dev mode'];

export default /** @type {import("@web/test-runner").TestRunnerConfig} */ ({
  /** Test files to run */
  files: 'test/**/*.test.js',

  /** Resolve bare module imports */
  nodeResolve: {
    exportConditions: ['browser', 'development'],
  },

  port: 9876,

  /** Filter out lit dev mode logs */
  filterBrowserLogs(log) {
    for (const arg of log.args) {
      if (typeof arg === 'string' && filteredLogs.some((l) => arg.includes(l))) {
        return false;
      }
    }
    return true;
  },

  /** Compile JS for older browsers. Requires @web/dev-server-esbuild plugin */
  // esbuildTarget: 'auto',

  /** Amount of browsers to run concurrently */
  // concurrentBrowsers: 2,

  /** Amount of test files per browser to test concurrently */
  // concurrency: 1,

  /** Browsers to run tests on */
  browsers: [
    playwrightLauncher({
      product: 'chromium',
      launchOptions: {
        // executablePath: '/path/to/executable',
        headless: true,
        args: [
          '--no-sandbox',
          '--no-first-run',
          '--noerrdialogs',
          '--no-default-browser-check',
          // '--user-data-dir=.chrome',
          '--disable-translate',
          '--disable-extensions',
          '--disable-infobars',
          '--ignore-certificate-errors',
          '--allow-insecure-localhost',
          '--autoplay-policy=no-user-gesture-required',
          // see https://developers.google.com/web/updates/2017/09/autoplay-policy-changes#webaudio
          '--disable-features=PreloadMediaEngagementData,AutoplayIgnoreWebAudio,MediaEngagementBypassAutoplayPolicies',
        ],
      },
    }),
  ],

  // See documentation for all available options
  testFramework: {
    config: {
      timeout: '5000',
    },
  },

  plugins: [
    fromRollup(commonjs)({
      exclude: [
        '**/node_modules/@open-wc/**/*',
        '**/node_modules/chai/**/*',
        '**/node_modules/chai-dom/**/*',
        '**/node_modules/sinon-chai/**/*',
      ],
    }),
  ],
});
