// ==================== Enums ====================
export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN';
export type SalaryType = 'MONTHLY' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY';
export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED';
export type OrderType = 'DINE_IN' | 'TAKE_AWAY' | 'ONLINE' | 'QR';
export type PaymentMethod = 'CASH' | 'QR' | 'CARD' | 'SPLIT' | 'UNKNOWN';
export type SettlementStatus = 'PAID' | 'UNPAID' | 'CANCELLED' | 'REFUNDED';
export type OrderStatus =
  | 'CREATED'
  | 'APPROVAL_PENDING'
  | 'APPROVED'
  | 'COOKING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';
export type OrderItemStatus = 'PENDING' | 'QUEUED' | 'COOKING' | 'READY' | 'SERVED';
export type KitchenBatchStatus = 'WAITING' | 'FIRED' | 'DONE';
export type CouponDiscountType = 'PERCENT' | 'FLAT';
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'LEAVE';

// ==================== Entities ====================
export type AccessRight = 'POS' | 'KITCHEN' | 'TABLES' | 'ADMIN';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  salaryType?: SalaryType;
  salaryAmount?: number;
  accessRights?: AccessRight[];
  basicDetails?: string;
}

export interface Table {
  id: string;
  tableNumber: number;
  qrCodeId: string;
  qrCodeUrl: string;
  qrCodeImage: string;
  status: TableStatus;
  currentOrderId?: string;
  capacity: number;
  location?: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  kitchenStation?: string;
  sequence: number;
  isActive: boolean;
  description?: string;
}

export interface KitchenStation {
  id: string;
  name: string;
  sequence: number;
  isActive: boolean;
}

export interface ExtraAddon {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  description?: string;
}

export interface SelectedAddon {
  addonId: string;
  addonName: string;
  quantity: number;
  unitPrice: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  category: MenuCategory;
  name: string;
  description?: string;
  price: number;
  taxPercent: number;
  prepTimeEstimate: number;
  isAvailable: boolean;
  imageUrl?: string;
  tags?: string;
  availableAddOns?: ExtraAddon[];
}

export interface MenuSection {
  category: MenuCategory;
  items: MenuItem[];
}

export interface OrderItemAddon {
  id: string;
  orderItemId: string;
  addonId?: string;
  addonName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  addonTotal?: number;
  addonSummary?: string;
  addOns?: OrderItemAddon[];
  sourceBillNo?: string;
  status: OrderItemStatus;
  kitchenStation?: string;
  notes?: string;
  cookingStartedAt?: string;
  readyAt?: string;
  servedAt?: string;
  createdAt?: string;
}

export interface Order {
  id: string;
  billNo?: string;
  orderType: OrderType;
  tableId?: string;
  tableNumber?: number;
  status: OrderStatus;
  subtotal: number;
  taxAmount: number;
  grossAmount?: number;
  discountAmount?: number;
  discountType?: CouponDiscountType;
  discountValue?: number;
  couponCode?: string;
  couponId?: string;
  totalAmount: number;
  settlementStatus?: SettlementStatus;
  paymentMethod?: PaymentMethod;
  settledAt?: string;
  refundedAt?: string;
  refundReason?: string;
  customerName?: string;
  customerPhone?: string;
  rejectionReason?: string;
  notes?: string;
  items: OrderItem[];
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  name: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usageCount: number;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Reservation {
  id: string;
  customerName: string;
  customerPhone?: string;
  partySize: number;
  reservationDate: string;
  reservationTime: string;
  tableId?: string;
  tableNumber?: number;
  status: ReservationStatus;
  notes?: string;
  specialRequest?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  attendanceDate: string;
  checkInAt?: string;
  checkOutAt?: string;
  workedMinutes: number;
  status: AttendanceStatus;
  isManual: boolean;
  note?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItemPerformanceEntry {
  rank: number;
  menuItemId: string;
  menuItemName: string;
  totalQuantity: number;
  orderCount: number;
  grossSales: number;
}

export interface KitchenBatchItem {
  id: string;
  batchId: string;
  orderItemId: string;
  menuItemName: string;
  quantity: number;
  kitchenStation?: string;
  notes?: string;
  addonSummary?: string;
  addOns?: Array<{ id?: string; addonName: string; quantity?: number; unitPrice?: number; lineTotal?: number }>;
  orderItemStatus?: OrderItemStatus;
}

export interface KitchenBatch {
  id: string;
  orderId: string;
  orderBillNo?: string;
  orderType?: string;
  tableNumber?: number;
  batchNumber: number;
  status: KitchenBatchStatus;
  createdAt: string;
  firedAt?: string;
  batchItems: KitchenBatchItem[];
}

export interface CartItem {
  cartLineId?: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  categoryName?: string;
  kitchenStation?: string;
  notes?: string;
  selectedAddOns?: SelectedAddon[];
}
