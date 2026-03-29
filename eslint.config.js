import prettierConfig from 'eslint-config-prettier';
import importXPlugin from 'eslint-plugin-import-x';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'shared/**', 'stems/**'],
  },

  {
    plugins: {
      'import-x': importXPlugin,
    },

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.mocha,
      },
    },

    rules: {
      ...prettierConfig.rules,

      'no-param-reassign': ['error', { props: false }],
      'class-methods-use-this': 'off',
      'no-underscore-dangle': 'off',
      'lines-between-class-members': 'off',
      'no-bitwise': 'off',

      'import-x/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/test/**/*.{js,mjs}',
            '**/*.config.{js,mjs,cjs}',
            '**/*.conf.{js,mjs,cjs}',
            'eslint.config.js',
          ],
        },
      ],
      'import-x/extensions': ['error', 'always', { ignorePackages: true }],
    },
  },
  {
    files: ['eslint.config.js'],
    rules: {
      'import-x/no-extraneous-dependencies': 'off',
    },
  },
];
