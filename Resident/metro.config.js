const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  "react-native-fs": require.resolve("./src/utils/rnfs-stub"),
};

module.exports = config;
