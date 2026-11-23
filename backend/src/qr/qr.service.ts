import { Injectable } from '@nestjs/common';
import { TablesService } from '../tables/tables.service';
import { MenuService } from '../menu/menu.service';
import { BeveragesService } from '../beverages/beverages.service';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class QrService {
  constructor(
    private readonly tablesService: TablesService,
    private readonly menuService: MenuService,
    private readonly beveragesService: BeveragesService,
    private readonly ordersService: OrdersService,
  ) {}

  async getTableByQrCode(qrCodeId: string) {
    return this.tablesService.findByQrCode(qrCodeId);
  }

  async getMenuForTable(qrCodeId: string) {
    const table = await this.tablesService.findByQrCode(qrCodeId);
    const [menu, categories, products] = await Promise.all([
      this.menuService.getFullMenu(),
      this.beveragesService.categoriesList(),
      this.beveragesService.listProducts(),
    ]);
    const activeCategories = categories.filter((category) => category.active);
    const activeCategoryIds = new Set(activeCategories.map((category) => category.id));
    const beverages = products
      .filter((product) => product.active && activeCategoryIds.has(product.categoryId))
      .map((product) => ({
        id: product.id,
        categoryId: product.categoryId,
        brand: product.brand,
        productName: product.productName,
        bottleSize: product.bottleSize,
        bottlePrice: product.bottlePrice,
        price30ml: product.price30ml,
        price60ml: product.price60ml,
        price90ml: product.price90ml,
      }));
    return {
      table: {
        id: table.id,
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        location: table.location,
      },
      menu,
      beverageCategories: activeCategories.map(({ id, name }) => ({ id, name })),
      beverages,
    };
  }

  async getActiveOrderForTable(qrCodeId: string) {
    const table = await this.tablesService.findByQrCode(qrCodeId);
    const order = await this.ordersService.findActiveQrForTable(table.id);
    if (!order) return null;

    // Expose only the QR customer's own table order and omit staff/customer PII.
    return {
      id: order.id,
      billNo: order.billNo,
      orderType: order.orderType,
      status: order.status,
      settlementStatus: order.settlementStatus,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      items: (order.items ?? []).map((item) => ({
        id: item.id,
        menuItemName: item.menuItemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        status: item.status,
        beverageId: item.beverageId,
        bottleSizeMl: item.bottleSizeMl,
        servingSize: item.servingSize,
        bottleOrderFlag: item.bottleOrderFlag,
        routingDestination: item.routingDestination,
      })),
    };
  }

  async getSessionForTable(qrCodeId: string) {
    const table = await this.tablesService.findByQrCode(qrCodeId);
    const session = await this.ordersService.findQrSessionForTable(table.id);
    if (!session) return null;

    const orders = session.orders.map((order) => ({
      id: order.id,
      sessionId: order.sessionId ?? session.sessionId,
      billNo: order.billNo,
      orderType: order.orderType,
      status: order.status,
      settlementStatus: order.settlementStatus,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      items: (order.items ?? []).map((item) => ({
        id: item.id,
        menuItemName: item.menuItemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        status: item.status,
        beverageId: item.beverageId,
        bottleSizeMl: item.bottleSizeMl,
        servingSize: item.servingSize,
        bottleOrderFlag: item.bottleOrderFlag,
        routingDestination: item.routingDestination,
      })),
    }));
    const billableOrders = orders.filter(
      (order) => order.settlementStatus === 'UNPAID' && order.status !== 'CANCELLED',
    );

    return {
      sessionId: session.sessionId,
      tableId: table.id,
      tableNumber: table.tableNumber,
      orders,
      summary: {
        orderCount: orders.length,
        totalQuantity: orders.reduce(
          (total, order) => total + (order.status === 'CANCELLED'
            ? 0
            : order.items.reduce((quantity, item) => quantity + item.quantity, 0)),
          0,
        ),
        pendingBillAmount: Number(
          billableOrders.reduce((total, order) => total + Number(order.totalAmount), 0).toFixed(2),
        ),
      },
    };
  }
}
