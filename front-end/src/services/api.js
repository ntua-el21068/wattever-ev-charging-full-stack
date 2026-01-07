import axios from 'axios';

// Αλλάξτε το URL ανάλογα με το πού τρέχει το backend σας
const API_URL = 'https://localhost:9876/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;