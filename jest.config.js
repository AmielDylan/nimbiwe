/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      // Vrai client, vraie base locale : pas de preset jest-expo, qui
      // remplacerait fetch par une doublure.
      displayName: 'api',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/api/**/*.test.ts'],
      globalSetup: '<rootDir>/tests/attendre-api.js',
      setupFiles: ['<rootDir>/tests/charger-env.js'],
      transform: {
        '^.+\\.tsx?$': [
          'babel-jest',
          {
            presets: ['@babel/preset-typescript'],
            plugins: ['@babel/plugin-transform-modules-commonjs'],
          },
        ],
      },
    },
    {
      displayName: 'ecrans',
      preset: 'jest-expo',
      setupFiles: ['<rootDir>/tests/preparer-ecrans.js'],
      testMatch: ['<rootDir>/tests/ecrans/**/*.test.tsx'],
    },
  ],
};
