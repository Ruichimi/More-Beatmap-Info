const axios = require('axios');

const instance = axios.create();

instance.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('Error:', error.response ? error.response.data : error.message);
        return Promise.reject(error);
    }
);

module.exports = instance;
