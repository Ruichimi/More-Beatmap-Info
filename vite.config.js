import path from 'path';
import config from './config';

export default {
    base: '',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@services': path.resolve(__dirname, 'src/js/Services'),
            '@assets': path.resolve(__dirname, 'src/assets'),
        },
    },
    build: {
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'src/js/main.js'),
                mainCss: path.resolve(__dirname, 'src/assets/css/main.css'),
                popup: path.resolve(__dirname, 'popup.html'),
            },

            output: {
                assetFileNames: '[name].[ext]',
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
            },
        },
        minify: config.minifyCode,
    },
    css: {
        postcss: {},
    },
    publicDir: 'public',
};
