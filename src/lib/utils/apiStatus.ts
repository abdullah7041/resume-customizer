// src/lib/utils/apiStatus.ts

// Simple event emitter for API status
// This allows non-React services to communicate with React components

export interface ApiStatus {
    active: boolean;
    operation: string | null;
    source: 'live' | 'mock' | null;
    timestamp: number;
}

type StatusCallback = (status: ApiStatus) => void;

const listeners = new Set<StatusCallback>();

let currentStatus: ApiStatus = {
    active: false,
    operation: null,
    source: null,
    timestamp: 0
};

export const subscribe = (callback: StatusCallback): (() => void) => {
    listeners.add(callback);
    callback(currentStatus); // Immediate update
    return () => { listeners.delete(callback); };
};

export const updateStatus = (updates: Partial<ApiStatus>): void => {
    currentStatus = {
        ...currentStatus,
        ...updates,
        timestamp: Date.now()
    };

    listeners.forEach(callback => callback(currentStatus));
};

export const getStatus = (): ApiStatus => currentStatus;




