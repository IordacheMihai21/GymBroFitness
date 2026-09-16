module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets-core (used by VisionCamera's frame processors) is not
    // auto-detected by babel-preset-expo the way react-native-worklets is — its
    // plugin must be registered explicitly, and listed last per its own docs.
    plugins: ['react-native-worklets-core/plugin'],
  };
};
