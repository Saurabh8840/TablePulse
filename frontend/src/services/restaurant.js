import { api } from './http.js';

export const listRestaurants = () => api('/api/restaurants');
export const getRestaurant = (id) => api(`/api/restaurants/${id}`);
export const createRestaurant = (payload) => api('/api/restaurants', { method: 'POST', body: payload });
export const updateRestaurant = (id, payload) => api(`/api/restaurants/${id}`, { method: 'PUT', body: payload });

export const listBranches = (restaurantId) => api(`/api/restaurants/${restaurantId}/branches`);
export const createBranch = (restaurantId, payload) =>
  api(`/api/restaurants/${restaurantId}/branches`, { method: 'POST', body: payload });
export const updateBranch = (id, payload) => api(`/api/branches/${id}`, { method: 'PUT', body: payload });
