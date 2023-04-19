module.exports = {
  extends: ['airbnb-base', 'prettier'],
  env: {
    browser: true,
    node: false,
    mocha: true,
  },
  plugins: ['prettier'],
  parser: '@babel/eslint-parser',
  rules: {
    'class-methods-use-this': 0,
    'no-param-reassign': ['error', { props: false }],
    'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    'prettier/prettier': ['error'],
    // 'no-underscore-dangle': ['error', { allow: ['_place'] }],
    'no-underscore-dangle': 'off',
    'lines-between-class-members': 'off',
    'no-bitwise': 'off',
  },
};
