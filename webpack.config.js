const path = require('path');

module.exports = {
    entry: {
        content: './content.js',
        main: './src/assets/css/main.css',
        popup: './src/assets/css/popup.css'
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'public/build'),
    },
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
};