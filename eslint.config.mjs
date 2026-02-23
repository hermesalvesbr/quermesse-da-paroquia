import antfu from '@antfu/eslint-config'

export default antfu(
  {
    vue: true,
    typescript: true,
    formatters: false,
    stylistic: false,
    ignores: [
      'node_modules/**',
      'platforms/**',
      'hooks/**',
      'App_Resources/**/build/**',
      'pdv-app/**',
      '*.config.js',
    ],
  },
  {
    rules: {
      'no-alert': 'off',
      'no-console': 'off',
      'no-unmodified-loop-condition': 'off',
      'no-useless-return': 'off',
      'import/consistent-type-specifier-style': 'off',
      'perfectionist/sort-named-imports': 'off',
      'prefer-template': 'off',
      'unicorn/number-literal-case': 'off',
      'vue/attribute-hyphenation': 'off',
      'vue/attributes-order': 'off',
      'vue/block-order': 'off',
      'vue/eqeqeq': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-closing-bracket-spacing': 'off',
      'vue/html-indent': 'off',
      'vue/prefer-template': 'off',
      'vue/v-on-event-hyphenation': 'off',
    },
  },
  {
    files: ['app/services/BluetoothService.ts'],
    languageOptions: {
      globals: {
        android: 'readonly',
        java: 'readonly',
      },
    },
  },
)
