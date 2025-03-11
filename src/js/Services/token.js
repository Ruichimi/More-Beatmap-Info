import axios from 'axios';
import Cookies from 'js-cookie';

const setToken = (headerName, token, errorMessage) => {
    if (!token) throw new Error(errorMessage);
    return {[headerName]: token};
};

const getClientToken = async () => {
    let token = Cookies.get('client_token');
    if (!token) {
        try {
            const response = await axios.post('http://localhost:3000/api/token');
            token = response.data.token;
            Cookies.set('client_token', token, { expires: 100, secure: true });
        } catch (error) {
            console.error('Failed to get client token:', error);
            return null;
        }
    }
    return token;
};

const refreshClientToken = async () => {
    try {
        const response = await axios.post('http://localhost:3000/api/token');
        const newToken = response.data.token;
        Cookies.set('client_token', newToken, { expires: 100,
            //secure: true
        });
        return newToken;
    } catch (error) {
        console.error('Failed to refresh client token:', error);
        return null;
    }
};

export { getClientToken, setToken, refreshClientToken };
