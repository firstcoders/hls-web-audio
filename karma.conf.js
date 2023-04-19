/* eslint-disable */
const webpack = require('webpack');

process.env.CHROME_BIN = require('puppeteer').executablePath();

// Chrome CLI options
// http://peter.sh/experiments/chromium-command-line-switches/
const chromeFlags = [
  '--no-sandbox',
  '--no-first-run',
  '--noerrdialogs',
  '--no-default-browser-check',
  '--user-data-dir=.chrome',
  '--disable-translate',
  '--disable-extensions',
  '--disable-infobars',
  '--ignore-certificate-errors',
  '--allow-insecure-localhost',
  '--autoplay-policy=no-user-gesture-required',
  // see https://developers.google.com/web/updates/2017/09/autoplay-policy-changes#webaudio
  '--disable-features=PreloadMediaEngagementData,AutoplayIgnoreWebAudio,MediaEngagementBypassAutoplayPolicies',
];

const firefoxFlags = {
  // disable autoplay blocking, see https://www.ghacks.net/2018/09/21/firefox-improved-autoplay-blocking/
  'media.autoplay.default': 0,
  'media.autoplay.ask-permission': false,
  'media.autoplay.enabled.user-gestures-needed': false,
  'media.autoplay.block-webaudio': false,
};

var linkMapper = {
  getPath(node) {
    if (typeof node === 'string') {
      return node;
    }
    let filePath = node.getQualifiedName();
    if (node.isSummary()) {
      if (filePath !== '') {
        filePath += '/index.html';
      } else {
        filePath = 'index.html';
      }
    } else {
      filePath += '.html';
    }
    return filePath;
  },

  relativePath(source, target) {
    const targetPath = this.getPath(target);
    const sourcePath = path.dirname(this.getPath(source));
    return path.posix.relative(sourcePath, targetPath);
  },

  assetPath(node, name) {
    return this.relativePath(this.getPath(node), name);
  },
};

const webpackConfig = {
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: [/node_modules/],
        loader: 'babel-loader',
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        TEST_DIST: JSON.stringify(process.env.TEST_DIST),
      },
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
  ],
};

const coverageIstanbulReporterConfig = {
  // reports can be any that are listed here: https://github.com/istanbuljs/istanbuljs/tree/73c25ce79f91010d1ff073aa6ff3fd01114f90db/packages/istanbul-reports/lib
  // https://istanbul.js.org/docs/advanced/alternative-reporters/
  reports: ['html', 'text-summary'],

  // base output directory. If you include %browser% in the path it will be replaced with the karma browser name
  dir: './.coverage',

  // Combines coverage information from multiple browsers into one report rather than outputting a report
  // for each browser.
  combineBrowserReports: true,

  // if using webpack and pre-loaders, work around webpack breaking the source path
  // fixWebpackSourcePaths: true,

  // Omit files with no statements, no functions and no branches covered from the report
  skipFilesWithNoCoverage: true,

  // Most reporters accept additional config options. You can pass these through the `report-config` option
  'report-config': {
    // all options available at: https://github.com/istanbuljs/istanbuljs/blob/73c25ce79f91010d1ff073aa6ff3fd01114f90db/packages/istanbul-reports/lib/html/index.js#L257-L261
    html: {
      // outputs the report in ./coverage/html
      subdir: 'html',
      // verbose: true,
      // see https://github.com/istanbuljs/istanbuljs/blob/master/packages/istanbul-reports/lib/html/index.js
      // linkMapper,
    },
  },

  // enforce percentage thresholds
  // anything under these percentages will cause karma to fail with an exit code of 1 if not running in watch mode
  thresholds: {
    emitWarning: true, // set to `true` to not fail the test command when thresholds are not met
    // thresholds for all files
    global: {
      statements: 100,
      lines: 100,
      branches: 100,
      functions: 100,
    },
    // thresholds per file
    // each: {
    //   statements: 100,
    //   lines: 100,
    //   branches: 100,
    //   functions: 100,
    //   overrides: {
    //     'baz/component/**/*.js': {
    //       statements: 98,
    //     },
    //   },
    // },
  },

  verbose: false, // output config used by istanbul for debugging
};

const defaultConfig = {
  customLaunchers: {
    Chrome_dev: {
      base: 'Chrome',
      flags: chromeFlags,
    },
    Chrome_ci: {
      base: 'ChromeHeadless',
      flags: chromeFlags,
    },
    Firefox_dev: {
      base: 'Firefox',
      prefs: firefoxFlags,
    },
    Firefox_ci: {
      base: 'FirefoxHeadless',
      prefs: firefoxFlags,
    },
  },
  basePath: '.',
  frameworks: ['mocha'],
  plugins: [
    'karma-mocha',
    'karma-mocha-reporter',
    'karma-chrome-launcher',
    'karma-webpack',
    'webpack-dev-middleware',
    'karma-firefox-launcher',
    // 'karma-safari-launcher',
    // 'karma-edge-launcher',
    'karma-coverage-istanbul-reporter',
  ],
  files: ['test/spec/**/*.js'],
  // reporters: ['progress', 'junit'],
  reporters: [process.env.COVERAGE ? 'coverage-istanbul' : 'progress', 'mocha'], //.filter(Boolean),
  port: 9876,
  captureConsole: true,
  colors: true,
  // autoWatch: true,
  browsers: [
    'Chrome_ci',
    // 'Firefox_ci',
    // Safari doesn't do headless
    // process.platform === 'darwin' && 'Safari',
    // process.platform === 'win32' && 'Edge',
  ].filter(Boolean),
  captureTimeout: 10000,
  singleRun: true,

  // So we can use ES 6 (in tests)
  // https://github.com/webpack-contrib/karma-webpack
  preprocessors: {
    'test/**/*.js': ['webpack'],
  },

  coverageIstanbulReporter: coverageIstanbulReporterConfig,
  webpack: webpackConfig,
  webpackMiddleware: {
    noInfo: true,
    stats: 'errors-only',
  },
};

module.exports = (config) => {
  config.set({
    ...defaultConfig,

    logLevel: config.LOG_INFO,

    files: [
      'test/spec/**/*.js',
      { pattern: 'test/fixtures/*', served: true, watched: false, included: false },
    ],

    webpack: {
      ...defaultConfig.webpack,

      // module: {
      //   rules: [
      //     {
      //       test: /\.worker\.js$/,
      //       use: {
      //         loader: 'worker-loader',
      //         options: { inline: 'no-fallback' },
      //       },
      //     },
      //   ].concat(defaultConfig.webpack.module.rules),
      // },
    },
  });
};
