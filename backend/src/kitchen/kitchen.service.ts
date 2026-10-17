import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { KitchenBatch } from './entities/kitchen-batch.entity';
import { KitchenBatchItem } from './entities/kitchen-batch-item.entity';
import { OrdersService } from '../orders/orders.service';
import { EventsService } from '../events/events.service';
import { FireItemsDto } from './dto/fire-items.dto';
import { KitchenBatchStatus, OrderItemStatus, OrderStatus, SocketEvent } from '../common/enums';
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

    if (![OrderStatus.CREATED, OrderStatus.APPROVED, OrderStatus.COOKING].includes(order.status)) {
      throw new BadRequestException('Order must be CREATED, APPROVED or COOKING to fire items');
    }

    // Validate all item IDs belong to the order
    const orderItemMap = new Map(order.items.map((i) => [i.id, i]));
    for (const itemId of dto.orderItemIds) {
      if (!orderItemMap.has(itemId)) {
        throw new BadRequestException(`Item ${itemId} does not belong to this order`);
      }
      const item = orderItemMap.get(itemId);
      if (item.status !== OrderItemStatus.PENDING) {
        throw new BadRequestException(`Item "${item.menuItemName}" is already queued or cooking`);
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

    const saved = await this.batchRepo.save(batch);

    // Update order items to QUEUED
    for (const itemId of dto.orderItemIds) {
      await this.ordersService.updateItemStatus(itemId, OrderItemStatus.QUEUED);
    }

    // Update order status to COOKING
    await this.ordersService.updateOrderStatus(dto.orderId, OrderStatus.COOKING);

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
    // Return all FIRED batches (active kitchen work)
    const batches = await this.batchRepo.find({
      where: { status: KitchenBatchStatus.FIRED },
      order: { firedAt: 'ASC' },
    });

    if (batches.length === 0) return [];

    const orderItemIds = batches.flatMap((b) => b.batchItems.map((i) => i.orderItemId));
    const orderItems = await this.orderItemRepo.find({ where: { id: In(orderItemIds) } });
    const statusMap = new Map(orderItems.map((item) => [item.id, item.status]));

    // Attach live order item status and hide served items from kitchen queue
    const withStatus = batches.map((batch) => ({
      ...batch,
      batchItems: batch.batchItems
        .map((item) => ({
          ...item,
          orderItemStatus: statusMap.get(item.orderItemId) || OrderItemStatus.PENDING,
        }))
        .filter((item: any) => item.orderItemStatus !== OrderItemStatus.SERVED),
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
      });

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
