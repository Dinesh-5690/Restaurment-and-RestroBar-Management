import { Injectable, BadRequestException } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus } from '../common/enums';

@Injectable()
export class ApprovalService {
  constructor(private readonly ordersService: OrdersService) {}

  async getPendingOrders() {
    return this.ordersService.findPendingApproval();
  }

  async approveOrder(orderId: string, approvedBy: string) {
    const order = await this.ordersService.findOne(orderId);
    if (order.status !== OrderStatus.APPROVAL_PENDING) {
      throw new BadRequestException('Order is not pending approval');
    }
    return this.ordersService.updateOrderStatus(orderId, OrderStatus.APPROVED, {
      approvedBy,
      approvedAt: new Date(),
    });
  }

  async rejectOrder(orderId: string, reason: string, rejectedBy: string) {
    const order = await this.ordersService.findOne(orderId);
    if (order.status !== OrderStatus.APPROVAL_PENDING) {
      throw new BadRequestException('Order is not pending approval');
    }
    return this.ordersService.updateOrderStatus(orderId, OrderStatus.CANCELLED, {
      rejectionReason: reason,
    });
  }

  async holdOrder(orderId: string) {
    // Keep in APPROVAL_PENDING, just return as-is (no status change for hold)
    return this.ordersService.findOne(orderId);
  }
}
