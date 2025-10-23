const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = merge(common, {
  mode: 'production',
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'index.html', to: 'index.html' },
        { from: '404.html', to: '404.html' },
        { from: 'favicon.ico', to: 'favicon.ico' },
        { from: 'icon.png', to: 'icon.png' },
        { from: 'icon.svg', to: 'icon.svg' },
        { from: 'robots.txt', to: 'robots.txt' },
        { from: 'site.webmanifest', to: 'site.webmanifest' },
        { from: 'css', to: 'css' },
        { from: 'img', to: 'img' },
        { from: 'js/vendor', to: 'js/vendor' },

        // Optional: copy all your HTML views
        { from: '*.html', to: '[name][ext]' },
      ],
    }),
  ],
});
