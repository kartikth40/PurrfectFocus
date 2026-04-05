import js from '@eslint/js'
import globals from 'globals'
import prettier from 'eslint-config-prettier'

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        chrome: 'readonly',
        Chart: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^sender$|^sendResponse$|^e$|^event$|^error$|^tabs$|^tab$', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-useless-assignment': 'warn',
      'no-async-promise-executor': 'warn',
    },
  },
  {
    files: ['src/newTab/over.js', 'src/utils.js'],
    languageOptions: {
      globals: {
        timer: 'readonly',
      },
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'public/scripts/**'],
  },
  prettier,
]
