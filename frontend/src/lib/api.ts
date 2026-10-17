import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ==================== Auth ====================
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
  register: (data: any) => api.post('/auth/register', data),
  listUsers: () => api.get('/auth/users'),
  updateUser: (id: string, data: any) => api.patch(`/auth/users/${id}`, data),
};

// ==================== Tables ====================
export const tablesApi = {
  list: () => api.get('/tables'),
  get: (id: string) => api.get(`/tables/${id}`),
  getByQr: (qrCodeId: string) => api.get(`/tables/qr/${qrCodeId}`),
  create: (data: any) => api.post('/tables', data),
  update: (id: string, data: any) => api.patch(`/tables/${id}`, data),
  regenerateQr: (id: string) => api.post(`/tables/${id}/regenerate-qr`),
  remove: (id: string) => api.delete(`/tables/${id}`),
};

// ==================== Menu ====================
export const menuApi = {
  fullMenu: () => api.get('/menu'),
  stations: () => api.get('/menu/stations'),
  createStation: (data: any) => api.post('/menu/stations', data),
  updateStation: (id: string, data: any) => api.patch(`/menu/stations/${id}`, data),
  deleteStation: (id: string) => api.delete(`/menu/stations/${id}`),
  categories: () => api.get('/menu/categories'),
  items: (categoryId?: string) =>
    api.get('/menu/items', { params: categoryId ? { categoryId } : {} }),
  getItem: (id: string) => api.get(`/menu/items/${id}`),
  availableItemAddons: (id: string) => api.get(`/menu/items/${id}/available-addons`),
  addons: () => api.get('/menu/addons'),
  createAddon: (data: any) => api.post('/menu/addons', data),
  updateAddon: (id: string, data: any) => api.patch(`/menu/addons/${id}`, data),
  deleteAddon: (id: string) => api.delete(`/menu/addons/${id}`),
  categoryAddons: (id: string) => api.get(`/menu/categories/${id}/addons`),
  setCategoryAddons: (id: string, addonIds: string[]) => api.put(`/menu/categories/${id}/addons`, { addonIds }),
  itemAddons: (id: string) => api.get(`/menu/items/${id}/addons`),
  setItemAddons: (id: string, addonIds: string[]) => api.put(`/menu/items/${id}/addons`, { addonIds }),
  createCategory: (data: any) => api.post('/menu/categories', data),
  updateCategory: (id: string, data: any) => api.patch(`/menu/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete(`/menu/categories/${id}`),
  createItem: (data: any) => api.post('/menu/items', data),
  updateItem: (id: string, data: any) => api.patch(`/menu/items/${id}`, data),
  toggleItem: (id: string) => api.patch(`/menu/items/${id}/toggle`),
  deleteItem: (id: string) => api.delete(`/menu/items/${id}`),
};

// ==================== Orders ====================
export const ordersApi = {
  create: (data: any) => api.post('/orders', data),
  list: (params?: any) => api.get('/orders', { params }),
  transactions: (params?: {
    from?: string;
    to?: string;
    settlement?: 'ALL' | 'PAID' | 'UNPAID' | 'CANCELLED' | 'REFUNDED';
    orderType?: 'ALL' | 'DINE_IN' | 'TAKE_AWAY' | 'ONLINE' | 'QR';
    method?: 'ALL' | 'CASH' | 'QR' | 'CARD' | 'SPLIT' | 'UNKNOWN';
    search?: string;
  }) => api.get('/orders/transactions', { params }),
  itemPerformance: (params?: {
    from?: string;
    to?: string;
    orderType?: 'ALL' | 'DINE_IN' | 'TAKE_AWAY' | 'ONLINE' | 'QR';
    search?: string;
  }) => api.get('/orders/item-performance', { params }),
  active: () => api.get('/orders/active'),
  activeByTable: () => api.get('/orders/active-by-table'),
  pendingApproval: () => api.get('/orders/pending-approval'),
  get: (id: string) => api.get(`/orders/${id}`),
  complete: (id: string, payload?: {
    paymentMethod?: 'CASH' | 'QR' | 'CARD' | 'SPLIT' | 'UNKNOWN';
    couponCode?: string;
  }) => api.patch(`/orders/${id}/complete`, payload ?? {}),
  refund: (id: string, reason?: string) => api.patch(`/orders/${id}/refund`, { reason }),
  cancel: (id: string, reason?: string) =>
    api.patch(`/orders/${id}/cancel`, { reason }),
  updateItemStatus: (itemId: string, status: string) =>
    api.patch(`/orders/items/${itemId}/status`, { status }),
  deleteItem: (itemId: string) => api.delete(`/orders/items/${itemId}`),
  transfer: (orderId: string, toTableId: string) =>
    api.post('/orders/transfer', { orderId, toTableId }),
  merge: (sourceOrderId: string, destinationOrderId: string) =>
    api.post('/orders/merge', { sourceOrderId, destinationOrderId }),
  addItems: (orderId: string, data: { items: any[] }) =>
    api.post(`/orders/${orderId}/items`, data),
};

// ==================== Kitchen ====================
export const kitchenApi = {
  fireItems: (orderId: string, orderItemIds: string[]) =>
    api.post('/kitchen/fire', { orderId, orderItemIds }),
  queue: (station?: string) =>
    api.get('/kitchen/queue', { params: station ? { station } : {} }),
  batchesForOrder: (orderId: string) => api.get(`/kitchen/batches/${orderId}`),
  markCooking: (orderItemId: string) => api.patch(`/kitchen/items/${orderItemId}/cooking`),
  markReady: (orderItemId: string) => api.patch(`/kitchen/items/${orderItemId}/ready`),
  markServed: (orderItemId: string) => api.patch(`/kitchen/items/${orderItemId}/served`),
};

// ==================== Approval ====================
export const approvalApi = {
  pending: () => api.get('/approval/pending'),
  approve: (orderId: string) => api.post(`/approval/${orderId}/approve`),
  reject: (orderId: string, reason: string) =>
    api.post(`/approval/${orderId}/reject`, { reason }),
  hold: (orderId: string) => api.post(`/approval/${orderId}/hold`),
};

// ==================== QR ====================
export const qrApi = {
  getMenu: (qrCodeId: string) => api.get(`/qr/${qrCodeId}/menu`),
};

// ==================== Kiosk ====================
export const kioskApi = {
  menu: () => api.get('/kiosk/menu'),
  tables: () => api.get('/kiosk/tables'),
  checkout: (data: {
    orderType: 'DINE_IN' | 'TAKE_AWAY';
    tableId?: string;
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    paymentMethod: 'COUNTER' | 'ONLINE_QR' | 'ONLINE_CARD';
    items: { menuItemId: string; quantity: number; notes?: string; selectedAddOns?: { addonId: string; quantity?: number }[] }[];
  }) => api.post('/kiosk/checkout', data),
};

// ==================== Dashboard ====================
export const dashboardApi = {
  summary: () => api.get('/dashboard/summary'),
};

// ==================== Expenses ====================
export const expensesApi = {
  list:    (params?: { from?: string; to?: string; category?: string; search?: string }) =>
    api.get('/expenses', { params }),
  summary: (params?: { from?: string; to?: string }) =>
    api.get('/expenses/summary', { params }),
  get:     (id: string) => api.get(`/expenses/${id}`),
  create:  (data: any)  => api.post('/expenses', data),
  update:  (id: string, data: any) => api.patch(`/expenses/${id}`, data),
  remove:  (id: string) => api.delete(`/expenses/${id}`),
};

// ==================== Coupons ====================
export const couponsApi = {
  list: (params?: { status?: 'ALL' | 'ACTIVE' | 'INACTIVE'; search?: string }) =>
    api.get('/coupons', { params }),
  get: (id: string) => api.get(`/coupons/${id}`),
  create: (data: any) => api.post('/coupons', data),
  update: (id: string, data: any) => api.patch(`/coupons/${id}`, data),
  toggle: (id: string) => api.patch(`/coupons/${id}/toggle`),
  remove: (id: string) => api.delete(`/coupons/${id}`),
  validate: (data: { code: string; orderAmount: number }) => api.post('/coupons/validate', data),
};

// ==================== Reservations ====================
export const reservationsApi = {
  list: (params?: {
    from?: string;
    to?: string;
    status?: 'ALL' | 'PENDING' | 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
    tableId?: string;
    search?: string;
  }) => api.get('/reservations', { params }),
  summary: (params?: { from?: string; to?: string }) => api.get('/reservations/summary', { params }),
  get: (id: string) => api.get(`/reservations/${id}`),
  create: (data: any) => api.post('/reservations', data),
  update: (id: string, data: any) => api.patch(`/reservations/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/reservations/${id}/status`, { status }),
  remove: (id: string) => api.delete(`/reservations/${id}`),
};

// ==================== Attendance ====================
export const attendanceApi = {
  todayMe: () => api.get('/attendance/today/me'),
  checkIn: (data?: { note?: string }) => api.post('/attendance/check-in', data ?? {}),
  checkOut: (data?: { note?: string }) => api.post('/attendance/check-out', data ?? {}),
  list: (params?: {
    from?: string;
    to?: string;
    userId?: string;
    status?: 'ALL' | 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'LEAVE';
    search?: string;
  }) => api.get('/attendance', { params }),
  summary: (params?: { from?: string; to?: string; userId?: string }) =>
    api.get('/attendance/summary', { params }),
  manual: (data: any) => api.post('/attendance/manual', data),
  update: (id: string, data: any) => api.patch(`/attendance/${id}`, data),
  remove: (id: string) => api.delete(`/attendance/${id}`),
};

// ==================== Printer Settings ====================
export const printerSettingsApi = {
  get: () => api.get('/printer-settings'),
  update: (data: any) => api.put('/printer-settings', data),
};

export default api;
