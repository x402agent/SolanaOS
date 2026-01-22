module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'react-native-reanimated/plugin',
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: process.env.ENVFILE || '.env.local',
        safe: false,
        allowUndefined: true,
      },
    ],
  ],
  // Enable specific transformations for web compatibility
  env: {
    production: {
      plugins: ['transform-remove-console'],
    },
  },
};
