// src/lib/apiStatus.js

// Simple event emitter for API status
// This allows non-React services to communicate with React components

const listeners = new Set();

let currentStatus = {
    active: false,
    operation: null,
    source: null, // 'live' | 'mock'
    timestamp: 0
};

export const subscribe = (callback) => {
    listeners.add(callback);
    callback(currentStatus); // Immediate update
    return () => listeners.delete(callback);
};

export const updateStatus = (updates) => {
    currentStatus = {
        ...currentStatus,
        ...updates,
        timestamp: Date.now()
    };

    listeners.forEach(callback => callback(currentStatus));
};

export const getStatus = () => currentStatus;
