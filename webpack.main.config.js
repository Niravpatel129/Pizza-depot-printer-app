module.exports = {
  entry: './src/main/index.js',
  externals: ['printer', '@thesusheer/electron-printer'],
  module: {
    rules: require('./webpack.rules'),
  },
};
