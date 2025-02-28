import path from 'path';

export default {
    base: '',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '$': path.resolve(__dirname, 'src/js'),
        },
    },
    build: {
        outDir: 'public/build/',
        assetsDir: 'public',
        rollupOptions: {
            input: {
                content: path.resolve(__dirname, 'src/js/content.js'),
                mainCss: path.resolve(__dirname, 'src/assets/css/main.css'),
                popup: path.resolve(__dirname, 'popup.html'),
            },

            output: {
                assetFileNames: '[name].[ext]',
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
            },
        },
    },
    css: {
        postcss: {},
    },
    publicDir: false,
};
