import { api, upload } from './http.js';

export const listRestaurants = () => api('/api/restaurants');
export const getRestaurant = (id) => api(`/api/restaurants/${id}`);
export const createRestaurant = (payload) => api('/api/restaurants', { method: 'POST', body: payload });
export const updateRestaurant = (id, payload) => api(`/api/restaurants/${id}`, { method: 'PUT', body: payload });
export const uploadRestaurantLogo = (id, file) => upload(`/api/restaurants/${id}/logo`, file);
export const uploadRestaurantCover = (id, file) => upload(`/api/restaurants/${id}/cover`, file);

export const listBranches = (restaurantId) => api(`/api/restaurants/${restaurantId}/branches`);
export const createBranch = (restaurantId, payload) =>
  api(`/api/restaurants/${restaurantId}/branches`, { method: 'POST', body: payload });
export const updateBranch = (id, payload) => api(`/api/branches/${id}`, { method: 'PUT', body: payload });
