import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdersService } from '../orders/orders.service';
import { OrderItemApprovalStatus, OrderItemStatus, OrderStatus, SettlementStatus } from '../common/enums';
import { BeveragesService } from '../beverages/beverages.service';
import { KitchenService } from '../kitchen/kitchen.service';
import { OrderItemApprovalHistory } from './entities/order-item-approval-history.entity';
import { UpdateApprovalItemDto } from '../orders/dto/update-approval-item.dto';
import { Order } from '../orders/entities/order.entity';

@Injectable()
export class ApprovalService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly beveragesService: BeveragesService,
    private readonly kitchenService: KitchenService,
    @InjectRepository(OrderItemApprovalHistory)
    private readonly historyRepo: Repository<OrderItemApprovalHistory>,
  ) {}

  async getPendingOrders() {
    return this.ordersService.findPendingApproval();
  }

  async approveOrder(orderId: string, approvedBy: string) {
    const order = await this.ordersService.findOne(orderId);
    if (order.status !== OrderStatus.APPROVAL_PENDING) {
      throw new BadRequestException('Order is not pending approval');
    }
    const pendingItems = (order.items ?? []).filter(
      (item) =>
        item.status === OrderItemStatus.PENDING &&
        (item.approvalStatus ?? OrderItemApprovalStatus.PENDING) === OrderItemApprovalStatus.PENDING,
    );
    if (pendingItems.length === 0) throw new BadRequestException('No pending items to approve');
    const kitchenItemIds: string[] = [];
    const beforeByItem = new Map<string, object>();
    for (const item of pendingItems) {
      const { before, item: approvedItem } = await this.ordersService.setItemApprovalStatus(
        orderId,
        item.id,
        OrderItemApprovalStatus.APPROVED,
      );
      if (approvedItem.beverageId || approvedItem.routingDestination === 'BILLING') {
        await this.ordersService.updateItemStatus(item.id, OrderItemStatus.READY);
      } else {
        kitchenItemIds.push(item.id);
      }
      beforeByItem.set(item.id, before);
    }

    await this.ordersService.updateOrderStatus(orderId, OrderStatus.APPROVED, {
      approvedBy,
      approvedAt: new Date(),
    });
    if (kitchenItemIds.length > 0) {
      await this.kitchenService.fireItems({ orderId, orderItemIds: kitchenItemIds }, approvedBy);
    }
    const finalOrder = await this.ordersService.findOne(orderId);
    for (const item of pendingItems) {
      const finalItem = finalOrder.items.find((candidate) => candidate.id === item.id);
      await this.recordHistory(orderId, item.id, 'APPROVE', approvedBy, beforeByItem.get(item.id), finalItem ?? item);
    }
    return finalOrder;
  }

  async rejectOrder(orderId: string, reason: string, rejectedBy: string) {
    const order = await this.ordersService.findOne(orderId);
    if (order.status !== OrderStatus.APPROVAL_PENDING) {
      throw new BadRequestException('Order is not pending approval');
    }
    const pendingItems = (order.items ?? []).filter(
      (item) =>
        item.status === OrderItemStatus.PENDING &&
        (item.approvalStatus ?? OrderItemApprovalStatus.PENDING) === OrderItemApprovalStatus.PENDING,
    );
    for (const item of pendingItems) {
      const { before, item: rejectedItem } = await this.ordersService.setItemApprovalStatus(
        orderId,
        item.id,
        OrderItemApprovalStatus.REJECTED,
        reason,
      );
      if (item.beverageId) await this.beveragesService.restoreForOrderItem(item.id, 'REJECTION_RESTORE');
      await this.recordHistory(orderId, item.id, 'REJECT', rejectedBy, before, rejectedItem, reason);
    }
    const updatedOrder = await this.ordersService.recalculateOrderTotals(orderId);
    return this.resolveApprovalIfFinished(updatedOrder, rejectedBy, reason);
  }

  async editItem(orderId: string, itemId: string, dto: UpdateApprovalItemDto, actorUserId: string) {
    const result = await this.ordersService.editPendingApprovalItem(orderId, itemId, dto);
    await this.recordHistory(orderId, itemId, 'EDIT', actorUserId, result.before, result.item);
    return result.order;
  }

  async removeItem(orderId: string, itemId: string, reason: string, actorUserId: string) {
    const { before, item, order } = await this.ordersService.setItemApprovalStatus(
      orderId,
      itemId,
      OrderItemApprovalStatus.REMOVED,
      reason,
    );
    if (item.beverageId) await this.beveragesService.restoreForOrderItem(item.id, 'CANCELLATION_RESTORE');
    const resolvedOrder = await this.resolveApprovalIfFinished(order, actorUserId, reason);
    const finalItem = resolvedOrder.items.find((candidate) => candidate.id === itemId) ?? item;
    await this.recordHistory(orderId, itemId, 'REMOVE', actorUserId, before, finalItem, reason);
    return resolvedOrder;
  }

  async approveItem(orderId: string, itemId: string, actorUserId: string) {
    const { before, item } = await this.ordersService.setItemApprovalStatus(
      orderId,
      itemId,
      OrderItemApprovalStatus.APPROVED,
    );
    const isBeverage = !!item.beverageId || item.routingDestination === 'BILLING';

    let order = await this.ordersService.findOne(orderId);
    const hasPending = order.items.some(
      (candidate) =>
        candidate.status === OrderItemStatus.PENDING &&
        (candidate.approvalStatus ?? OrderItemApprovalStatus.PENDING) === OrderItemApprovalStatus.PENDING,
    );
    try {
      if (isBeverage) {
        await this.ordersService.updateItemStatus(item.id, OrderItemStatus.READY);
      } else {
        await this.kitchenService.fireItems({ orderId, orderItemIds: [itemId] }, actorUserId);
      }
    } catch (error) {
      if (!isBeverage) await this.ordersService.resetItemToPendingApproval(orderId, itemId);
      throw error;
    }

    if (!hasPending) {
      const hasApprovedFood = order.items.some(
        (candidate) =>
          candidate.approvalStatus === OrderItemApprovalStatus.APPROVED &&
          !candidate.beverageId &&
          candidate.routingDestination !== 'BILLING',
      );
      const kitchenWorkInProgress = order.items.some(
        (candidate) =>
          candidate.approvalStatus === OrderItemApprovalStatus.APPROVED &&
          !candidate.beverageId &&
          candidate.routingDestination !== 'BILLING' &&
          [OrderItemStatus.PENDING, OrderItemStatus.QUEUED, OrderItemStatus.COOKING].includes(candidate.status),
      );
      order = await this.ordersService.updateOrderStatus(
        orderId,
        hasApprovedFood
          ? kitchenWorkInProgress ? OrderStatus.COOKING : OrderStatus.READY
          : OrderStatus.APPROVED,
        { approvedBy: actorUserId, approvedAt: new Date() },
      );
    }

    const finalOrder = await this.ordersService.findOne(orderId);
    if (hasPending) this.ordersService.notifyOrderUpdated(finalOrder);
    const finalItem = finalOrder.items.find((candidate) => candidate.id === itemId) ?? item;
    await this.recordHistory(orderId, itemId, 'APPROVE', actorUserId, before, finalItem);
    return finalOrder;
  }

  async rejectItem(orderId: string, itemId: string, reason: string, actorUserId: string) {
    const { before, item } = await this.ordersService.setItemApprovalStatus(
      orderId,
      itemId,
      OrderItemApprovalStatus.REJECTED,
      reason,
    );
    if (item.beverageId) await this.beveragesService.restoreForOrderItem(item.id, 'REJECTION_RESTORE');
    const order = await this.ordersService.recalculateOrderTotals(orderId);
    const finalOrder = await this.resolveApprovalIfFinished(order, actorUserId, reason);
    const finalItem = finalOrder.items.find((candidate) => candidate.id === itemId) ?? item;
    await this.recordHistory(orderId, itemId, 'REJECT', actorUserId, before, finalItem, reason);
    return finalOrder;
  }

  private async resolveApprovalIfFinished(order: Order, actorUserId: string, reason?: string): Promise<Order> {
    const hasPending = order.items.some(
      (item) =>
        item.status === OrderItemStatus.PENDING &&
        (item.approvalStatus ?? OrderItemApprovalStatus.PENDING) === OrderItemApprovalStatus.PENDING,
    );
    if (hasPending) return order;

    const acceptedItems = order.items.filter(
      (item) =>
        item.approvalStatus === OrderItemApprovalStatus.APPROVED &&
        ![OrderItemStatus.REJECTED, OrderItemStatus.REMOVED].includes(item.status),
    );
    if (acceptedItems.length === 0) {
      return this.ordersService.updateOrderStatus(order.id, OrderStatus.CANCELLED, {
        settlementStatus: SettlementStatus.CANCELLED,
        rejectionReason: reason,
      });
    }

    const acceptedFood = acceptedItems.filter(
      (item) => !item.beverageId && item.routingDestination !== 'BILLING',
    );
    const nextStatus = acceptedFood.length === 0
      ? OrderStatus.APPROVED
      : acceptedFood.some((item) =>
        [OrderItemStatus.PENDING, OrderItemStatus.QUEUED, OrderItemStatus.COOKING].includes(item.status),
      )
        ? OrderStatus.COOKING
        : OrderStatus.READY;
    return this.ordersService.updateOrderStatus(
      order.id,
      nextStatus,
      { approvedBy: actorUserId, approvedAt: new Date() },
    );
  }

  async itemHistory(orderId: string) {
    await this.ordersService.findOne(orderId);
    return this.historyRepo.find({ where: { orderId }, order: { createdAt: 'DESC' } });
  }

  private async recordHistory(
    orderId: string,
    itemId: string,
    action: string,
    actorUserId: string,
    before: object,
    after: object,
    reason?: string,
  ) {
    return this.historyRepo.save(this.historyRepo.create({
      orderId,
      orderItemId: itemId,
      action,
      actorUserId,
      reason: reason?.trim() || undefined,
      beforeSnapshot: JSON.stringify(before),
      afterSnapshot: JSON.stringify(after),
    }));
  }

  async holdOrder(orderId: string) {
    // Keep in APPROVAL_PENDING, just return as-is (no status change for hold)
    return this.ordersService.findOne(orderId);
  }
}
