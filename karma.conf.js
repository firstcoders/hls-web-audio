/* eslint-disable */
const defaultConfig = require('../../build/karma-default-config');

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
