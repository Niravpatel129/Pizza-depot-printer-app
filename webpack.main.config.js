module.exports = {
  entry: './src/main/index.js',
  externals: ['printer', 'electron-pos-printer'],
  module: {
    rules: require('./webpack.rules'),
  },
};
