import { api, upload } from './http.js';

export const listCategories = (restaurantId) => api(`/api/restaurants/${restaurantId}/categories`);
export const createCategory = (restaurantId, payload) =>
  api(`/api/restaurants/${restaurantId}/categories`, { method: 'POST', body: payload });
export const updateCategory = (id, payload) => api(`/api/categories/${id}`, { method: 'PUT', body: payload });
export const deleteCategory = (id) => api(`/api/categories/${id}`, { method: 'DELETE' });

export const listItems = (categoryId) => api(`/api/categories/${categoryId}/items`);
export const createItem = (categoryId, payload) =>
  api(`/api/categories/${categoryId}/items`, { method: 'POST', body: payload });
export const updateItem = (id, payload) => api(`/api/items/${id}`, { method: 'PUT', body: payload });
export const deleteItem = (id) => api(`/api/items/${id}`, { method: 'DELETE' });
export const restoreItem = (id) => api(`/api/items/${id}`, { method: 'PUT', body: { active: true } });
export const setAvailability = (id, available) =>
  api(`/api/items/${id}/availability`, { method: 'PATCH', body: { available } });
export const uploadItemImage = (id, file) => upload(`/api/items/${id}/image`, file);
export const deleteItemImage = (id) => api(`/api/items/${id}/image`, { method: 'DELETE' });

export const createModifierGroup = (itemId, payload) =>
  api(`/api/items/${itemId}/modifier-groups`, { method: 'POST', body: payload });
export const listModifierGroups = (itemId) => api(`/api/items/${itemId}/modifier-groups`);
export const createModifierOption = (groupId, payload) =>
  api(`/api/modifier-groups/${groupId}/options`, { method: 'POST', body: payload });
// Fix 3: S/M/L variant management — edit prices, sold-out toggles, deletes.
export const updateModifierGroup = (groupId, payload) =>
  api(`/api/modifier-groups/${groupId}`, { method: 'PUT', body: payload });
export const deleteModifierGroup = (groupId) =>
  api(`/api/modifier-groups/${groupId}`, { method: 'DELETE' });
export const updateModifierOption = (optionId, payload) =>
  api(`/api/modifier-options/${optionId}`, { method: 'PUT', body: payload });
export const setModifierOptionAvailability = (optionId, available) =>
  api(`/api/modifier-options/${optionId}/availability`, { method: 'PATCH', body: { available } });
export const deleteModifierOption = (optionId) =>
  api(`/api/modifier-options/${optionId}`, { method: 'DELETE' });
