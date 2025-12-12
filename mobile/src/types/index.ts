export interface User {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    role: string;
    balance?: number;
    lifetimeEntries?: number;
    country?: string;
}

export interface AuthResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

export interface OTPResponse {
    message: string;
    expiresIn: number;
}

export interface Product {
    id: string;
    name: string;
    category?: string;
    unitsAllowed: string[];
}

export interface Market {
    id: string;
    name: string;
    city: string;
    lat?: number;
    lon?: number;
}

export interface PriceEntry {
    id?: string;
    clientId: string;
    productId: string;
    marketId: string;
    unit: 'kg' | 'piece' | 'basket';
    priceValue: number;
    currency: string;
    photoUrl?: string;
    lat: number;
    lon: number;
    capturedAt: string;
    status?: 'pending' | 'synced' | 'error' | 'validated' | 'rejected' | 'accepted';
    reason?: string;
    product?: Product;
    market?: Market;
}

export interface SyncResponse {
    clientId: string;
    status: 'accepted' | 'rejected' | 'duplicate' | 'limit_exceeded';
    reason?: string;
    id?: string;
}
