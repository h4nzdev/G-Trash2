// Central API URL — change this one value when switching between local and ngrok
import axios from 'axios';
const API = import.meta.env.VITE_API_URL || 'https://g-trash2.onrender.com';
// Set Axios defaults for base URL and attach auth token if present
axios.defaults.baseURL = API;
const storedToken = localStorage.getItem('gtrash_token');
if (storedToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
}
export default API;
