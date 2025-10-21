const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    app: './js/app.js',
    'dashboard-producer': './js/dashboard-producer.js'
  },
  output: {
    filename: 'js/[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: '*.html', to: '' },
        { from: 'css', to: 'css' },
        { from: 'img', to: 'img', noErrorOnMissing: true },
        { from: 'icon.png', to: '', noErrorOnMissing: true },
        { from: 'favicon.ico', to: '', noErrorOnMissing: true },
        { from: 'robots.txt', to: '', noErrorOnMissing: true },
        { from: 'site.webmanifest', to: '', noErrorOnMissing: true }
      ]
    })
  ]
};
