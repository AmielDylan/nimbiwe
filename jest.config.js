// reicon-react-native est publié en modules ES : Jest doit le transformer,
// comme les paquets React Native que jest-expo transforme déjà.
const transformIgnorePatterns = require('jest-expo/jest-preset').transformIgnorePatterns.map((motif) =>
  motif.replace('/node_modules/(?!(', '/node_modules/(?!(reicon-react-native|'),
);

/** @type {import('jest').Config} */
module.exports = {
  // Les tests de l'API font de vrais appels à une vraie base : de la marge quand la machine est chargée.
  // (Option globale : Jest l'ignore dans un projet.)
  testTimeout: 30_000,
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
      transformIgnorePatterns,
      // Le paquet n'expose que la condition « import » : on le résout à la main.
      moduleNameMapper: {
        '^reicon-react-native/icons/(.*)$': '<rootDir>/node_modules/reicon-react-native/icons/$1.js',
      },
      setupFiles: ['<rootDir>/tests/preparer-ecrans.js'],
      testMatch: ['<rootDir>/tests/ecrans/**/*.test.tsx'],
    },
  ],
};
