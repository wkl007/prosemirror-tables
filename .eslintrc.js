module.exports = {
  env: {
    browser: true,
    es2020: true,
    jest: true,
  },
  extends: ['eslint:recommended', 'airbnb/base'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    requireConfigFile: false,
  },
  parser: '@babel/eslint-parser',
  rules: {
    semi: 0,
    'comma-dangle': 0,
    'no-return-assign': 0,
    'no-shadow': 0,
    'no-param-reassign': 0,
    'implicit-arrow-linebreak': 0,
    'object-curly-newline': 0,
    'consistent-return': 0,
    'operator-linebreak': 0,
    'no-use-before-define': 0,
    'guard-for-in': 0,
    'no-bitwise': 0,
    'no-labels': 0,
    'max-len': 0,
    'no-plusplus': 0,
    'no-restricted-syntax': 0,
    'max-classes-per-file': 0,
    'no-continue': 0,
    'import/no-extraneous-dependencies': 0,
  },
}
