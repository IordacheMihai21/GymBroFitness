// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// react-native-fast-tflite: lets `require('*.tflite')` bundle the model as an asset.
config.resolver.assetExts.push('tflite');

module.exports = config;
