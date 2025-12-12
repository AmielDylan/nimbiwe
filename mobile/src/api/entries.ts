import axios from 'axios';
import { config } from '../constants/config';
import { PriceEntry, SyncResponse, Product, Market } from '../types';

const api = axios.create({
    baseURL: config.apiUrl,
});

// Intercepteur pour ajouter le token JWT
let authToken: string | null = null;

export const setAuthToken = (token: string) => {
    authToken = token;
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export const removeAuthToken = () => {
    authToken = null;
    delete api.defaults.headers.common['Authorization'];
};

// API Products et Markets
export const productsApi = {
    getProducts: async (): Promise<Product[]> => {
        const { data } = await api.get('/products');
        return data;
    },

    getMarkets: async (): Promise<Market[]> => {
        const { data } = await api.get('/markets');
        return data;
    },
};

// API Entries
export const entriesApi = {
    createEntry: async (entries: Omit<PriceEntry, 'id' | 'status'>[]): Promise<SyncResponse[]> => {
        const { data } = await api.post('/sync/entries', entries);
        return data;
    },
};
