import axios from 'axios';
import { config } from '../constants/config';
import { PriceEntry, SyncResponse } from '../types';

const api = axios.create({
    baseURL: config.apiUrl,
});

// Intercepteur pour ajouter le token JWT
export const setAuthToken = (token: string) => {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export const removeAuthToken = () => {
    delete api.defaults.headers.common['Authorization'];
};

export const entriesApi = {
    createEntry: async (entry: Omit<PriceEntry, 'id' | 'status'>): Promise<SyncResponse> => {
        const { data } = await api.post('/sync/entries', entry);
        return data;
    },
};
