import { BadRequestException, Injectable } from '@nestjs/common';
import { MenuService } from '../menu/menu.service';
import { OrdersService } from '../orders/orders.service';
import { KitchenService } from '../kitchen/kitchen.service';
import { TablesService } from '../tables/tables.service';
import { OrderStatus, OrderType } from '../common/enums';
import {
  KioskCheckoutDto,
  KioskOrderType,
  KioskPaymentMethod,
} from './dto/kiosk-checkout.dto';

@Injectable()
export class KioskService {
  constructor(
    private readonly menuService: MenuService,
    private readonly tablesService: TablesService,
    private readonly ordersService: OrdersService,
    private readonly kitchenService: KitchenService,
  ) {}

  async getMenu() {
    return this.menuService.getFullMenu();
  }

  async getTables() {
    return this.tablesService.findAll();
  }

  async checkout(dto: KioskCheckoutDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required');
    }

    // Validate table if provided (but not required for dine-in in kiosk)
    if (dto.tableId) {
      await this.tablesService.findOne(dto.tableId);
    }

    // All kiosk orders are treated as TAKE_AWAY regardless of selection
    const created = await this.ordersService.create({
      orderType: OrderType.TAKE_AWAY,
      tableId: dto.tableId,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      notes: [dto.notes, `Payment: ${dto.paymentMethod}`].filter(Boolean).join(' | '),
      items: dto.items,
    });

    const approved = await this.ordersService.updateOrderStatus(created.id, OrderStatus.APPROVED, {
      approvedBy: 'KIOSK',
      approvedAt: new Date(),
    });

    const orderItemIds = approved.items.map((item) => item.id);
    if (orderItemIds.length > 0) {
      await this.kitchenService.fireItems(
        {
          orderId: approved.id,
          orderItemIds,
        },
        'kiosk-system',
      );
    }

    const latest = await this.ordersService.findOne(approved.id);

    return {
      success: true,
      paymentMethod: dto.paymentMethod,
      order: latest,
      billNo: latest.billNo,
      printable: dto.paymentMethod === KioskPaymentMethod.COUNTER,
    };
  }
}
