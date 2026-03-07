module.exports = {
  entry: './src/main/index.js',
  externals: ['socket.io-client'],
  module: {
    rules: require('./webpack.rules'),
  },
};
