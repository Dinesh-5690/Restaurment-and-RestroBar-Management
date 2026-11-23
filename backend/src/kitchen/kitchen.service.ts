import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { KitchenBatch } from './entities/kitchen-batch.entity';
import { KitchenBatchItem } from './entities/kitchen-batch-item.entity';
import { OrdersService } from '../orders/orders.service';
import { EventsService } from '../events/events.service';
import { FireItemsDto } from './dto/fire-items.dto';
import { KitchenBatchStatus, OrderItemApprovalStatus, OrderItemStatus, OrderStatus, OrderType, SocketEvent } from '../common/enums';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Table } from '../tables/entities/table.entity';

@Injectable()
export class KitchenService {
  constructor(
    @InjectRepository(KitchenBatch)
    private readonly batchRepo: Repository<KitchenBatch>,
    @InjectRepository(KitchenBatchItem)
    private readonly batchItemRepo: Repository<KitchenBatchItem>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Table)
    private readonly tableRepo: Repository<Table>,
    private readonly ordersService: OrdersService,
    private readonly eventsService: EventsService,
  ) {}

  private async resolveTableNumber(order: any): Promise<string | undefined> {
    if (order?.tableNumber != null) {
      return String(order.tableNumber);
    }

    if (!order?.tableId) {
      return undefined;
    }

    const table = await this.tableRepo.findOne({ where: { id: order.tableId } });
    return table?.tableNumber;
  }

  /**
   * Core: Fire selected items to kitchen (partial fire support)
   * Creates a new batch for the selected order items.
   */
  async fireItems(dto: FireItemsDto, firedBy: string): Promise<KitchenBatch> {
    const order = await this.ordersService.findOne(dto.orderId);
    const resolvedTableNumber = await this.resolveTableNumber(order);

    if (![OrderStatus.CREATED, OrderStatus.APPROVAL_PENDING, OrderStatus.APPROVED, OrderStatus.COOKING, OrderStatus.READY].includes(order.status)) {
      throw new BadRequestException('Order must be CREATED, APPROVED, COOKING or READY to fire items');
    }
    const requiresItemApproval =
      order.status === OrderStatus.APPROVAL_PENDING || order.orderType === OrderType.QR;

    // Validate all item IDs belong to the order
    const orderItemMap = new Map(order.items.map((i) => [i.id, i]));
    if (!dto.orderItemIds?.length) {
      throw new BadRequestException('Select at least one food item to fire');
    }
    if (new Set(dto.orderItemIds).size !== dto.orderItemIds.length) {
      throw new BadRequestException('The same item cannot be fired more than once');
    }
    for (const itemId of dto.orderItemIds) {
      if (!orderItemMap.has(itemId)) {
        throw new BadRequestException(`Item ${itemId} does not belong to this order`);
      }
      const item = orderItemMap.get(itemId);
      if (item.beverageId || item.routingDestination === 'BILLING') {
        throw new BadRequestException('Alcoholic beverage items must be sent directly to Billing, not Kitchen KDS');
      }
      if (item.status !== OrderItemStatus.PENDING) {
        throw new BadRequestException(`Item "${item.menuItemName}" is already queued or cooking`);
      }
      if (requiresItemApproval && item.approvalStatus !== OrderItemApprovalStatus.APPROVED) {
        throw new BadRequestException(`Item "${item.menuItemName}" must be individually approved before firing`);
      }
      const alreadyQueued = await this.batchItemRepo.findOne({ where: { orderItemId: itemId } });
      if (alreadyQueued) {
        throw new BadRequestException(`Item "${item.menuItemName}" has already been sent to the kitchen`);
      }
    }

    // Get next batch number for this order
    const existingBatches = await this.batchRepo.count({ where: { orderId: dto.orderId } });
    const batchNumber = existingBatches + 1;

    // Build batch items
    const batchItems: Partial<KitchenBatchItem>[] = dto.orderItemIds.map((itemId) => {
      const item = orderItemMap.get(itemId);
      return {
        orderItemId: itemId,
        menuItemName: item.menuItemName,
        quantity: item.quantity,
        kitchenStation: item.kitchenStation,
        notes: item.notes,
        addonSummary: item.addonSummary,
        addOns: item.addOns,
      };
    });

    const batch = this.batchRepo.create({
      orderId: dto.orderId,
      orderBillNo: order.billNo,
      orderType: order.orderType,
      tableNumber: resolvedTableNumber,
      batchNumber,
      status: KitchenBatchStatus.FIRED,
      firedBy,
      firedAt: new Date(),
      batchItems: batchItems as KitchenBatchItem[],
    });

    const claimedItemIds: string[] = [];
    let saved: KitchenBatch;
    try {
      for (const itemId of dto.orderItemIds) {
        const criteria: Partial<OrderItem> = {
          id: itemId,
          orderId: dto.orderId,
          status: OrderItemStatus.PENDING,
        };
        if (requiresItemApproval) {
          criteria.approvalStatus = OrderItemApprovalStatus.APPROVED;
        }
        const claim = await this.orderItemRepo.update(criteria, { status: OrderItemStatus.QUEUED });
        if (claim.affected !== 1) {
          const item = orderItemMap.get(itemId);
          throw new BadRequestException(`Item "${item?.menuItemName ?? itemId}" has already been processed`);
        }
        claimedItemIds.push(itemId);
      }
      saved = await this.batchRepo.save(batch);
    } catch (error) {
      for (const itemId of claimedItemIds) {
        await this.orderItemRepo.update(
          { id: itemId, status: OrderItemStatus.QUEUED },
          { status: OrderItemStatus.PENDING },
        );
      }
      throw error;
    }

    // Keep partially reviewed orders in the Approval Hub until every item is resolved.
    if (order.status !== OrderStatus.APPROVAL_PENDING) {
      await this.ordersService.updateOrderStatus(dto.orderId, OrderStatus.COOKING);
    }

    // Emit batch fired event to kitchen stations
    this.eventsService.emit(SocketEvent.ORDER_FIRED, saved);
    this.eventsService.emitToRoom('pos:all', SocketEvent.ORDER_FIRED, saved);
    const stations = new Set(batchItems.map((i) => i.kitchenStation).filter(Boolean));
    stations.forEach((station) => {
      this.eventsService.emitToStation(station, SocketEvent.ORDER_FIRED, saved);
    });

    return saved;
  }

  async getBatchesForOrder(orderId: string): Promise<KitchenBatch[]> {
    return this.batchRepo.find({
      where: { orderId },
      order: { batchNumber: 'ASC' },
    });
  }

  async getKitchenQueue(station?: string): Promise<KitchenBatch[]> {
    // Recover QR orders approved before approval began dispatching kitchen items
    // server-side. An APPROVED QR order has not been fired yet; food items still
    // pending here are safe to dispatch, while beverages remain billing-only.
    const approvedQrOrders = await this.ordersService.findApprovedQrOrders();
    for (const order of approvedQrOrders) {
      const pendingKitchenItems = (order.items ?? []).filter(
        (item) =>
          item.status === OrderItemStatus.PENDING &&
          item.approvalStatus === OrderItemApprovalStatus.APPROVED &&
          !item.beverageId &&
          item.routingDestination !== 'BILLING',
      );
      if (pendingKitchenItems.length > 0) {
        await this.fireItems(
          { orderId: order.id, orderItemIds: pendingKitchenItems.map((item) => item.id) },
          order.approvedBy || 'approval-recovery',
        );
      }
    }

    // Return all FIRED batches (active kitchen work)
    const batches = await this.batchRepo.find({
      where: { status: KitchenBatchStatus.FIRED },
      order: { firedAt: 'ASC' },
    });

    if (batches.length === 0) return [];

    const orderItemIds = batches.flatMap((b) => b.batchItems.map((i) => i.orderItemId));
    const orderItems = await this.orderItemRepo.find({ where: { id: In(orderItemIds) } });
    const statusMap = new Map(orderItems.map((item) => [item.id, item.status]));
    const routingMap = new Map(orderItems.map((item) => [item.id, item.routingDestination]));
    const beverageMap = new Map(orderItems.map((item) => [item.id, item.beverageId]));

    // Attach live order item status and hide served and beverage items from kitchen queue
    const withStatus = batches.map((batch) => ({
      ...batch,
      batchItems: batch.batchItems
        .map((item) => ({
          ...item,
          orderItemStatus: statusMap.get(item.orderItemId) || OrderItemStatus.PENDING,
        }))
        .filter((item: any) => item.orderItemStatus !== OrderItemStatus.SERVED)
        .filter((item: any) => routingMap.get(item.orderItemId) !== 'BILLING')
        .filter((item: any) => !beverageMap.get(item.orderItemId)),
    })) as KitchenBatch[];

    const activeBatches = withStatus.filter((b) => b.batchItems.length > 0);

    // Safety fallback:
    // if an item is QUEUED/COOKING/READY but not present in any active FIRED batch,
    // surface it in a synthetic batch so kitchen screens don't silently drop it.
    const linkedOrderItemIds = new Set(
      activeBatches.flatMap((batch) => batch.batchItems.map((item: any) => item.orderItemId)),
    );

    const orphanItemsQuery = this.orderItemRepo
      .createQueryBuilder('item')
      .where('item.status IN (:...statuses)', {
        statuses: [OrderItemStatus.QUEUED, OrderItemStatus.COOKING, OrderItemStatus.READY],
      })
      .andWhere('item.beverageId IS NULL')
      .andWhere('(item.routingDestination IS NULL OR item.routingDestination != :billing)', { billing: 'BILLING' });

    if (linkedOrderItemIds.size > 0) {
      orphanItemsQuery.andWhere('item.id NOT IN (:...linkedIds)', {
        linkedIds: Array.from(linkedOrderItemIds),
      });
    }

    const orphanItems = await orphanItemsQuery.orderBy('item.createdAt', 'ASC').getMany();

    const orphanItemsByOrder = new Map<string, OrderItem[]>();
    for (const item of orphanItems) {
      const group = orphanItemsByOrder.get(item.orderId) || [];
      group.push(item);
      orphanItemsByOrder.set(item.orderId, group);
    }

    const orphanBatches: KitchenBatch[] = [];
    for (const [orderId, items] of orphanItemsByOrder.entries()) {
      let orderBillNo: string | undefined;
      let orderType: string | undefined;
      let tableNumber: string | undefined;
      try {
        const order = await this.ordersService.findOne(orderId);
        orderBillNo = order.billNo;
        orderType = order.orderType;
        tableNumber = await this.resolveTableNumber(order);
      } catch {
        orderBillNo = undefined;
        orderType = undefined;
        tableNumber = undefined;
      }

      const firedAt = items[0]?.createdAt || new Date();
      orphanBatches.push({
        id: `orphan-${orderId}`,
        orderId,
        orderBillNo,
        orderType,
        tableNumber,
        batchNumber: 0,
        status: KitchenBatchStatus.FIRED,
        firedBy: null as any,
        firedAt,
        doneAt: null as any,
        batchItems: items.map((item, index) => ({
          id: `orphan-item-${item.id}-${index}`,
          batchId: `orphan-${orderId}`,
          orderItemId: item.id,
          menuItemName: item.menuItemName,
          quantity: item.quantity,
          kitchenStation: item.kitchenStation,
          notes: item.notes,
          addonSummary: item.addonSummary,
          addOns: item.addOns,
          orderItemStatus: item.status,
        })) as any,
        createdAt: firedAt,
        updatedAt: firedAt,
      } as KitchenBatch);
    }

    const combinedBatches = [...activeBatches, ...orphanBatches].sort(
      (a, b) => new Date(a.firedAt || a.createdAt).getTime() - new Date(b.firedAt || b.createdAt).getTime(),
    );

    if (station) {
      // Filter to show only batches that have items for this station
      return combinedBatches.filter((b) =>
        b.batchItems.some(
          (item: any) => item.kitchenStation?.toUpperCase() === station.toUpperCase(),
        ),
      );
    }
    return combinedBatches;
  }

  async markItemCooking(orderItemId: string): Promise<void> {
    const item = await this.orderItemRepo.findOne({ where: { id: orderItemId } });
    if (!item) throw new NotFoundException('Order item not found');
    if (item.status !== OrderItemStatus.QUEUED) {
      throw new BadRequestException('Only queued items can move to cooking');
    }
    await this.ordersService.updateItemStatus(orderItemId, OrderItemStatus.COOKING);
  }

  async markItemReady(orderItemId: string): Promise<void> {
    const item = await this.orderItemRepo.findOne({ where: { id: orderItemId } });
    if (!item) throw new NotFoundException('Order item not found');
    if (item.status !== OrderItemStatus.COOKING) {
      throw new BadRequestException('Only cooking items can move to ready');
    }
    await this.ordersService.updateItemStatus(orderItemId, OrderItemStatus.READY);
  }

  async markItemServed(orderItemId: string): Promise<void> {
    const item = await this.orderItemRepo.findOne({ where: { id: orderItemId } });
    if (!item) throw new NotFoundException('Order item not found');
    if (item.status !== OrderItemStatus.READY) {
      throw new BadRequestException('Only ready items can move to served');
    }
    await this.ordersService.updateItemStatus(orderItemId, OrderItemStatus.SERVED);
    await this.checkAndAutoCompleteBatch(orderItemId);
    await this.markOrderReadyWhenKitchenIsDone(item.orderId);
  }

  private async markOrderReadyWhenKitchenIsDone(orderId: string): Promise<void> {
    const order = await this.ordersService.findOne(orderId);
    const kitchenItems = (order.items ?? []).filter(
      (item) =>
        !item.beverageId &&
        item.routingDestination !== 'BILLING' &&
        ![OrderItemStatus.REJECTED, OrderItemStatus.REMOVED].includes(item.status),
    );
    if (
      kitchenItems.length > 0 &&
      kitchenItems.every((item) => item.status === OrderItemStatus.SERVED) &&
      [OrderStatus.CREATED, OrderStatus.APPROVED, OrderStatus.COOKING].includes(order.status)
    ) {
      await this.ordersService.updateOrderStatus(orderId, OrderStatus.READY);
    }
  }

  private async checkAndAutoCompleteBatch(orderItemId: string): Promise<void> {
    const batchItem = await this.batchItemRepo.findOne({ where: { orderItemId } });
    if (!batchItem) return;

    const batch = await this.batchRepo.findOne({ where: { id: batchItem.batchId } });
    if (!batch) return;

    const order = await this.ordersService.findOne(batch.orderId);
    const firedItemIds = new Set(batch.batchItems.map((bi) => bi.orderItemId));
    const firedItems = order.items.filter((i) => firedItemIds.has(i.id));

    const allServed = firedItems.every((i) => i.status === OrderItemStatus.SERVED);

    if (allServed && batch.status !== KitchenBatchStatus.DONE) {
      batch.status = KitchenBatchStatus.DONE;
      batch.doneAt = new Date();
      await this.batchRepo.save(batch);
    }
  }

  async getBatch(batchId: string): Promise<KitchenBatch> {
    const batch = await this.batchRepo.findOne({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }
}
