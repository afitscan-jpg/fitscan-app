module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // NOTE: Do NOT add react-native-worklets/plugin (or the deprecated
    // react-native-reanimated/plugin) here. babel-preset-expo@56 auto-injects
    // react-native-worklets/plugin last when react-native-worklets is installed.
    // Adding it manually would duplicate the plugin and break the build.
  };
};
