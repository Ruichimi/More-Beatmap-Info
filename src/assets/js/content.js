import axios from 'axios';

console.log(124);

axios.get('https://example.com/api/data')
    .then(response => {
        console.log(response.data);
    })
    .catch(error => {
        console.error('Ошибка при выполнении запроса:', error);
    });

