module.exports = {
  entry: './src/main/index.js',
  externals: ['printer'],
  module: {
    rules: require('./webpack.rules'),
  },
};
