import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../api/products';

export const useProducts = () => {
    return useQuery({
        queryKey: ['products'],
        queryFn: productsApi.getProducts,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useMarkets = () => {
    return useQuery({
        queryKey: ['markets'],
        queryFn: productsApi.getMarkets,
        staleTime: 10 * 60 * 1000, // 10 minutes
    });
};
