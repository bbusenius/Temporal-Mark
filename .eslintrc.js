module.exports = {
  env: {
    browser: false,
    es2021: true,
    node: true,
    jest: true,
  },
  extends: ['airbnb-base', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'commonjs',
  },
  rules: {
    'no-console': 'off',
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
      },
    ],
    // Allow common CLI patterns
    'no-await-in-loop': 'warn',
    'no-restricted-syntax': 'warn',
    'class-methods-use-this': 'warn',
    'no-param-reassign': ['error', { props: false }],
    'no-plusplus': 'off',
    'no-continue': 'off',
    'no-else-return': 'warn',
    'prefer-template': 'warn',
    'global-require': 'warn',
    'consistent-return': 'warn',
    'no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'no-underscore-dangle': 'off',
    'no-cond-assign': ['error', 'except-parens'],
    // Allow some functional programming patterns
    'prefer-destructuring': 'warn',
    'no-nested-ternary': 'warn',
    'dot-notation': 'warn',
    'arrow-body-style': 'warn',
    'import/order': 'warn',
    'no-useless-catch': 'warn',
    'no-useless-escape': 'warn',
  },
};
