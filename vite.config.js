import path from 'path';

export default {
    base: '',
    build: {
        outDir: 'public/build/',
        assetsDir: 'public',
        rollupOptions: {
            input: {
                content: path.resolve(__dirname, 'src/assets/js/content.js'),
                main: path.resolve(__dirname, 'popup.html'),
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
