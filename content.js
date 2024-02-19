import axios from 'axios';
import $ from 'jquery';

$(document).ready(function () {
    console.log(123);

    axios.get('https://example.com/api/data')
        .then(response => {
            console.log(response.data);
        })
        .catch(error => {
            console.error('Ошибка при выполнении запроса:', error);
        });
});

