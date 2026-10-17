import { create } from 'zustand';
import { CartItem, SelectedAddon, Table, MenuItem } from '../types';

interface POSState {
  selectedTable: Table | null;
  selectedOrderId: string | null;
  selectedOrderBillNo: string | null;
  cart: CartItem[];
  orderType: 'DINE_IN' | 'ONLINE' | 'QR';

  setSelectedTable: (table: Table | null) => void;
  setSelectedOrderId: (orderId: string | null) => void;
  setSelectedOrderBillNo: (billNo: string | null) => void;
  setOrderType: (type: 'DINE_IN' | 'ONLINE' | 'QR') => void;
  addToCart: (item: MenuItem, addons?: SelectedAddon[]) => void;
  removeFromCart: (cartLineId: string) => void;
  updateQuantity: (cartLineId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: () => number;
  cartSubtotal: () => number;
}

export const usePOSStore = create<POSState>((set, get) => ({
  selectedTable: null,
  selectedOrderId: null,
  selectedOrderBillNo: null,
  cart: [],
  orderType: 'DINE_IN',

  setSelectedTable: (table) => set({ selectedTable: table }),
  setSelectedOrderId: (orderId) => set({ selectedOrderId: orderId }),
  setSelectedOrderBillNo: (billNo) => set({ selectedOrderBillNo: billNo }),
  setOrderType: (orderType) => set({ orderType }),

  addToCart: (item: MenuItem, addons: SelectedAddon[] = []) => {
    const cart = get().cart;
    if (addons.length === 0) {
      const existing = cart.find((c) => c.menuItemId === item.id && (!c.selectedAddOns || c.selectedAddOns.length === 0));
      if (existing && existing.cartLineId) {
        set({ cart: cart.map((c) => c.cartLineId === existing.cartLineId ? { ...c, quantity: c.quantity + 1 } : c) });
        return;
      }
    }
    const cartLineId = `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set({
      cart: [
        ...cart,
        {
          cartLineId,
          menuItemId: item.id,
          menuItemName: item.name,
          unitPrice: item.price,
          quantity: 1,
          categoryName: item.category?.name,
          kitchenStation: item.category?.kitchenStation,
          selectedAddOns: addons,
        },
      ],
    });
  },

  removeFromCart: (cartLineId: string) => {
    set({ cart: get().cart.filter((c) => c.cartLineId !== cartLineId) });
  },

  updateQuantity: (cartLineId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeFromCart(cartLineId);
      return;
    }
    set({
      cart: get().cart.map((c) =>
        c.cartLineId === cartLineId ? { ...c, quantity } : c,
      ),
    });
  },

  clearCart: () => set({ cart: [], selectedTable: null, selectedOrderId: null, selectedOrderBillNo: null }),

  cartSubtotal: () => get().cart.reduce((sum, c) => {
    const addonTotal = (c.selectedAddOns || []).reduce((s, a) => s + (a.unitPrice * (a.quantity ?? 1)), 0);
    return sum + (c.unitPrice + addonTotal) * c.quantity;
  }, 0),

  cartTotal: () => get().cartSubtotal(),
}));
