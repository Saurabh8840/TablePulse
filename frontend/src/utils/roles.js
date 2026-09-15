// Role helpers — single place that maps backend Role enum values to UI access.

export const homeForRole = (role) =>
  role === 'KITCHEN_STAFF' ? '/kitchen' : role === 'WAITER' ? '/waiter' : '/admin';

export const isManager = (user) =>
  !!user && (user.role === 'OWNER' || user.role === 'MANAGER');

export const isKitchen = (user) => !!user && user.role === 'KITCHEN_STAFF';

export const isWaiter = (user) => !!user && user.role === 'WAITER';

export const canSeeKitchen = (user) =>
  !!user && (user.role === 'KITCHEN_STAFF' || user.role === 'OWNER' || user.role === 'MANAGER');

export const canSeeWaiter = (user) =>
  !!user && (user.role === 'WAITER' || user.role === 'OWNER' || user.role === 'MANAGER');
