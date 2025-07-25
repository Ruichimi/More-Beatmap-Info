import path from 'path';

export default {
    base: '',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@assets': path.resolve(__dirname, 'src/assets'),
        },
    },
    build: {
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
        minify: true,
    },
    css: {
        postcss: {},
    },
    publicDir: 'public',
};
