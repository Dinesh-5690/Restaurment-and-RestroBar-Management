import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto, CreateOrderItemDto, SelectedOrderItemAddonDto } from './dto/create-order.dto';
import { MenuService } from '../menu/menu.service';
import { TablesService } from '../tables/tables.service';
import { EventsService } from '../events/events.service';
import {
  OrderStatus,
  OrderType,
  OrderItemStatus,
  OrderItemApprovalStatus,
  SocketEvent,
  PaymentMethod,
  SettlementStatus,
} from '../common/enums';
import { KitchenBatch } from '../kitchen/entities/kitchen-batch.entity';
import { KitchenBatchItem } from '../kitchen/entities/kitchen-batch-item.entity';
import { Coupon } from '../coupons/entities/coupon.entity';
import { CouponDiscountType } from '../coupons/entities/coupon.entity';
import { BeveragesService } from '../beverages/beverages.service';
import { v4 as uuidv4 } from 'uuid';
import { UpdateApprovalItemDto } from './dto/update-approval-item.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(KitchenBatch)
    private readonly batchRepo: Repository<KitchenBatch>,
    @InjectRepository(KitchenBatchItem)
    private readonly batchItemRepo: Repository<KitchenBatchItem>,
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
    private readonly menuService: MenuService,
    private readonly tablesService: TablesService,
    private readonly eventsService: EventsService,
    private readonly beveragesService: BeveragesService,
  ) {}

  private computeDiscount(coupon: Coupon, grossAmount: number): number {
    let discount = 0;
    if (coupon.discountType === CouponDiscountType.PERCENT) {
      discount = grossAmount * (coupon.discountValue / 100);
      if (coupon.maxDiscountAmount != null) {
        discount = Math.min(discount, coupon.maxDiscountAmount);
      }
    } else {
      discount = coupon.discountValue;
    }

    return Number(Math.min(discount, grossAmount).toFixed(2));
  }

  private async validateCouponForCompletion(couponCode: string, grossAmount: number): Promise<Coupon> {
    const code = couponCode.trim().toUpperCase();
    const coupon = await this.couponRepo.findOne({ where: { code } });
    if (!coupon) {
      throw new BadRequestException('Invalid coupon code');
    }

    const now = new Date();
    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is inactive');
    }
    if (coupon.startsAt && now < coupon.startsAt) {
      throw new BadRequestException('Coupon is not active yet');
    }
    if (coupon.endsAt && now > coupon.endsAt) {
      throw new BadRequestException('Coupon has expired');
    }
    if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    if (grossAmount < coupon.minOrderAmount) {
      throw new BadRequestException(`Minimum order amount is ${coupon.minOrderAmount.toFixed(2)}`);
    }

    return coupon;
  }

  private formatBillNoPrefix(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private async generateBillNo(): Promise<string> {
    const prefix = this.formatBillNoPrefix();
    const latestOrder = await this.orderRepo
      .createQueryBuilder('order')
      .where('order.billNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('order.billNo', 'DESC')
      .limit(1)
      .getOne();

    const suffix = latestOrder?.billNo ? Number(latestOrder.billNo.slice(-3)) + 1 : 1;
    const nextSuffix = String(isNaN(suffix) ? 1 : suffix).padStart(3, '0');
    return `${prefix}${nextSuffix}`;
  }

  private async buildOrderItemData(
    itemDto: CreateOrderItemDto,
    sourceBillNo?: string,
    orderId?: string,
  ): Promise<{ item: Partial<OrderItem>; subtotal: number; tax: number }> {
    if (itemDto.beverageId) {
      const beverage = await this.beveragesService.getProduct(itemDto.beverageId);
      const bottle = itemDto.bottleOrderFlag === true;
      const servingSize = itemDto.servingSize?.toUpperCase() ?? '30ML';
      const unitPrice = bottle ? Number(beverage.bottlePrice)
        : servingSize === '60ML' ? Number(beverage.price60ml)
        : servingSize === '90ML' ? Number(beverage.price90ml)
        : Number(beverage.price30ml);
      const lineTotal = Number((unitPrice * itemDto.quantity).toFixed(2));
      return {
        item: {
          orderId,
          menuItemId: beverage.id,
          menuItemName: `${beverage.brand}${beverage.productName ? ` ${beverage.productName}` : ''} · ${bottle ? (Number(beverage.bottleSize) === 180 ? 'Quarter - 180ml' : Number(beverage.bottleSize) === 375 ? 'Half - 375ml' : 'Full - 750ml') : servingSize}`,
          quantity: itemDto.quantity,
          unitPrice,
          lineTotal,
          addonTotal: 0,
          sourceBillNo,
          routingDestination: 'BILLING',
          beverageId: beverage.id,
          bottleSizeMl: bottle ? Number(beverage.bottleSize) : undefined,
          servingSize: bottle ? 'BOTTLE' : servingSize,
          bottleOrderFlag: bottle,
          notes: itemDto.notes,
          status: OrderItemStatus.PENDING,
        },
        subtotal: lineTotal,
        tax: 0,
      };
    }

    const menuItem = await this.menuService.findItem(itemDto.menuItemId!);
    if (!menuItem.isAvailable) {
      throw new BadRequestException(`Item "${menuItem.name}" is currently unavailable`);
    }

    const selected = itemDto.selectedAddOns ?? [];
    const normalizedSelections: SelectedOrderItemAddonDto[] = selected.map((addon) => ({
      addonId: addon.addonId,
      quantity: Math.max(1, addon.quantity ?? 1),
    }));

    const availableAddons = await this.menuService.getAvailableAddOnsForItem(menuItem.id);
    const availableById = new Map(availableAddons.map((addon) => [addon.id, addon]));

    for (const selectedAddon of normalizedSelections) {
      if (!availableById.has(selectedAddon.addonId)) {
        throw new BadRequestException(`Invalid add-on selected for item "${menuItem.name}"`);
      }
    }

    const perUnitAddonTotal = normalizedSelections.reduce((sum, selectedAddon) => {
      const addon = availableById.get(selectedAddon.addonId)!;
      return sum + Number(addon.price) * (selectedAddon.quantity ?? 1);
    }, 0);

    const baseTotal = Number(menuItem.price) * itemDto.quantity;
    const addonTotal = perUnitAddonTotal * itemDto.quantity;
    const lineTotal = Number((baseTotal + addonTotal).toFixed(2));
    const lineTax = Number((lineTotal * (Number(menuItem.taxPercent) / 100)).toFixed(2));

    const addOns = normalizedSelections.map((selectedAddon) => {
      const addon = availableById.get(selectedAddon.addonId)!;
      const qty = (selectedAddon.quantity ?? 1) * itemDto.quantity;
      return {
        addonId: addon.id,
        addonName: addon.name,
        unitPrice: Number(addon.price),
        quantity: qty,
        lineTotal: Number((Number(addon.price) * qty).toFixed(2)),
      };
    });

    return {
      item: {
        orderId,
        menuItemId: menuItem.id,
        menuItemName: menuItem.name,
        quantity: itemDto.quantity,
        unitPrice: Number(menuItem.price),
        lineTotal,
        addonTotal: Number(addonTotal.toFixed(2)),
        addonSummary: addOns.map((addon) => addon.addonName).join(', '),
        addOns: addOns as any,
        sourceBillNo,
        kitchenStation: menuItem.category?.kitchenStation,
        routingDestination: 'KITCHEN',
        notes: itemDto.notes,
        status: OrderItemStatus.PENDING,
      },
      subtotal: lineTotal,
      tax: lineTax,
    };
  }

  async create(dto: CreateOrderDto): Promise<Order> {
    if (dto.clientRequestId) {
      const duplicate = await this.orderRepo.findOne({
        where: { clientRequestId: dto.clientRequestId },
      });
      if (duplicate) {
        if (duplicate.orderType !== dto.orderType || duplicate.tableId !== dto.tableId) {
          throw new BadRequestException('This request ID has already been used for another order');
        }
        return duplicate;
      }
    }

    if (dto.sessionId && dto.orderType !== OrderType.QR) {
      throw new BadRequestException('Only QR orders can specify a table session');
    }
    if (dto.orderType === OrderType.QR && !dto.tableId) {
      throw new BadRequestException('QR orders require a table');
    }

    const table = dto.tableId ? await this.tablesService.findOne(dto.tableId) : undefined;
    const orderId = dto.orderType === OrderType.QR || (dto.orderType === OrderType.DINE_IN && table)
      ? uuidv4()
      : undefined;
    let qrSessionId: string | undefined;

    if (dto.orderType === OrderType.QR && table && orderId) {
      const currentSessionId = await this.resolveQrSessionId(table.id, table.currentOrderId);

      if (dto.sessionId && dto.sessionId !== currentSessionId) {
        throw new BadRequestException('This table session is no longer active. Refresh the QR page and try again.');
      }

      qrSessionId = currentSessionId ?? orderId;
    }

    const billNo = await this.generateBillNo();

    let subtotal = 0;
    let taxAmount = 0;
    const orderItems: Partial<OrderItem>[] = [];

    for (const itemDto of dto.items) {
      const built = await this.buildOrderItemData(itemDto, billNo);
      subtotal += built.subtotal;
      taxAmount += built.tax;
      orderItems.push(built.item);
    }

    if (dto.orderType === OrderType.QR && table && qrSessionId && orderId) {
      const expectedCurrentOrderId = table.currentOrderId || undefined;
      const claimedSessionId = await this.tablesService.claimQrSession(
        table.id,
        qrSessionId,
        expectedCurrentOrderId,
      );
      qrSessionId = await this.resolveQrSessionId(table.id, claimedSessionId) ?? claimedSessionId;
      if (dto.sessionId && qrSessionId !== dto.sessionId) {
        throw new BadRequestException('This table session is no longer active. Refresh the QR page and try again.');
      }
    }

    const initialStatus =
      dto.orderType === OrderType.ONLINE || dto.orderType === OrderType.QR
        ? OrderStatus.APPROVAL_PENDING
        : OrderStatus.CREATED;

    let tableNumber: string | undefined;
    if (table && (dto.orderType === OrderType.DINE_IN || dto.orderType === OrderType.QR)) {
      tableNumber = table.tableNumber;
    }

    const order = this.orderRepo.create({
      id: orderId,
      sessionId: qrSessionId
        ?? (dto.orderType === OrderType.DINE_IN && table ? orderId : undefined),
      clientRequestId: dto.clientRequestId,
      billNo,
      orderType: dto.orderType,
      tableId: dto.tableId,
      tableNumber,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      notes: dto.notes,
      subtotal,
      taxAmount,
      grossAmount: subtotal + taxAmount,
      totalAmount: subtotal + taxAmount,
      status: initialStatus,
      items: orderItems as OrderItem[],
    });

    let saved: Order;
    try {
      saved = await this.orderRepo.save(order);
    } catch (error) {
      if (dto.clientRequestId) {
        const duplicate = await this.orderRepo.findOne({
          where: { clientRequestId: dto.clientRequestId },
        });
        if (duplicate) {
          if (duplicate.orderType !== dto.orderType || duplicate.tableId !== dto.tableId) {
            throw new BadRequestException('This request ID has already been used for another order');
          }
          return duplicate;
        }
      }
      throw error;
    }

    for (const savedItem of saved.items ?? []) {
      if (!savedItem.beverageId && savedItem.routingDestination !== 'BILLING') {
        savedItem.routingDestination = 'KITCHEN';
        await this.itemRepo.save(savedItem);
      } else if (
        savedItem.status === OrderItemStatus.PENDING &&
        (savedItem.beverageId || savedItem.routingDestination === 'BILLING') &&
        initialStatus !== OrderStatus.APPROVAL_PENDING
      ) {
        const readyItem = await this.updateItemStatus(savedItem.id, OrderItemStatus.READY);
        savedItem.status = readyItem.status;
      }
    }

    if (saved.items?.some((item) => item.routingDestination === 'BILLING') && saved.items?.some((item) => item.routingDestination === 'KITCHEN')) {
      saved.routingDestination = 'MIXED';
      await this.orderRepo.save(saved);
    } else if (saved.items?.some((item) => item.routingDestination === 'BILLING')) {
      saved.routingDestination = 'BILLING';
      await this.orderRepo.save(saved);
    }

    if (dto.tableId && dto.orderType === OrderType.DINE_IN) {
      await this.tablesService.setOccupied(dto.tableId, saved.id);
    }

    // Emit socket events
    this.eventsService.emit(SocketEvent.ORDER_CREATED, saved);
    if (saved.sessionId) {
      this.eventsService.emitToRoom(`session:${saved.sessionId}`, SocketEvent.ORDER_CREATED, saved);
    }
    if (initialStatus === OrderStatus.APPROVAL_PENDING) {
      this.eventsService.emitToRoom('approval:hub', SocketEvent.ORDER_CREATED, saved);
    }

    return saved;
  }

  async addItems(orderId: string, itemsDto: CreateOrderItemDto[]): Promise<{ order: Order; addedItemIds: string[] }> {
    const order = await this.findOne(orderId);
    if ([OrderStatus.COMPLETED, OrderStatus.CANCELLED].includes(order.status)) {
      throw new BadRequestException('Cannot add items to a completed or cancelled order');
    }
    if (!itemsDto || itemsDto.length === 0) {
      throw new BadRequestException('No items provided');
    }

    let addedSubtotal = 0;
    let addedTax = 0;
    const orderItems: Partial<OrderItem>[] = [];

    for (const itemDto of itemsDto) {
      const built = await this.buildOrderItemData(itemDto, order.billNo, order.id);
      addedSubtotal += built.subtotal;
      addedTax += built.tax;
      orderItems.push(built.item);
    }

    const savedItems = await this.itemRepo.save(orderItems as OrderItem[]);
    for (const savedItem of savedItems) {
      if (!savedItem.beverageId && savedItem.routingDestination !== 'BILLING') {
        savedItem.routingDestination = 'KITCHEN';
        await this.itemRepo.save(savedItem);
      } else if (
        savedItem.status === OrderItemStatus.PENDING &&
        (savedItem.beverageId || savedItem.routingDestination === 'BILLING') &&
        ![OrderType.QR, OrderType.ONLINE].includes(order.orderType)
      ) {
        const readyItem = await this.updateItemStatus(savedItem.id, OrderItemStatus.READY);
        savedItem.status = readyItem.status;
      }
    }
    if (savedItems.some((item) => item.routingDestination === 'BILLING') && order.items?.some((item) => item.routingDestination === 'KITCHEN')) order.routingDestination = 'MIXED';
    else if (savedItems.some((item) => item.routingDestination === 'BILLING')) order.routingDestination = 'BILLING';
    order.items = [...order.items, ...savedItems];
    order.subtotal = Number((order.subtotal + addedSubtotal).toFixed(2));
    order.taxAmount = Number((order.taxAmount + addedTax).toFixed(2));
    order.grossAmount = Number((order.subtotal + order.taxAmount).toFixed(2));
    const adjustedDiscount = Math.min(order.discountAmount ?? 0, order.grossAmount);
    order.discountAmount = Number(adjustedDiscount.toFixed(2));
    order.totalAmount = Number((order.grossAmount - order.discountAmount).toFixed(2));
    const saved = await this.orderRepo.save(order);

    this.eventsService.emit(SocketEvent.ORDER_UPDATED, saved);
    this.eventsService.emitToOrder(saved.id, SocketEvent.ORDER_UPDATED, saved);
    this.eventsService.emitToRoom('pos:all', SocketEvent.ORDER_UPDATED, saved);
    const sessionId = this.getTableSessionId(saved);
    if (sessionId) this.eventsService.emitToRoom(`session:${sessionId}`, SocketEvent.ORDER_UPDATED, saved);
    if (saved.status === OrderStatus.APPROVAL_PENDING) {
      this.eventsService.emitToRoom('approval:hub', SocketEvent.ORDER_UPDATED, saved);
    }

    return { order: saved, addedItemIds: savedItems.map((item) => item.id) };
  }

  async findAll(status?: string, orderType?: string): Promise<Order[]> {
    const where: any = {};
    if (status) where.status = status;
    if (orderType) where.orderType = orderType;
    return this.orderRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    return this.populateTableNumber(order);
  }

  private async populateTableNumber(order: Order): Promise<Order> {
    if (order.tableId && order.tableNumber == null) {
      const table = await this.tablesService.findOne(order.tableId);
      order.tableNumber = table.tableNumber;
      await this.orderRepo.save(order);
    }
    if (order.items) {
      order.items = order.items.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    return order;
  }

  private async populateTableNumbers(orders: Order[]): Promise<Order[]> {
    return Promise.all(orders.map((order) => this.populateTableNumber(order)));
  }

  async findPendingApproval(): Promise<Order[]> {
    return this.orderRepo.find({
      where: { status: OrderStatus.APPROVAL_PENDING },
      order: { createdAt: 'ASC' },
    });
  }

  async findApprovedQrOrders(): Promise<Order[]> {
    return this.orderRepo.find({
      where: { status: OrderStatus.APPROVED, orderType: OrderType.QR },
      order: { createdAt: 'ASC' },
      take: 100,
    });
  }

  async findActiveQrForTable(tableId: string): Promise<Order | null> {
    return this.orderRepo.findOne({
      where: {
        tableId,
        orderType: OrderType.QR,
        status: In([
          OrderStatus.APPROVAL_PENDING,
          OrderStatus.APPROVED,
          OrderStatus.COOKING,
          OrderStatus.READY,
        ]),
      },
      order: { createdAt: 'DESC' },
    });
  }

  private async resolveQrSessionId(tableId: string, currentOrderId?: string): Promise<string | undefined> {
    if (currentOrderId) {
      const currentOrder = await this.orderRepo.findOne({
        where: { id: currentOrderId, tableId },
        select: ['id', 'orderType', 'sessionId'],
      });
      if (currentOrder?.orderType === OrderType.QR) {
        return currentOrder.sessionId ?? currentOrder.id;
      }
      if (!currentOrder) return currentOrderId;
    }

    const activeOrder = await this.findActiveQrForTable(tableId);
    return activeOrder?.sessionId ?? activeOrder?.id;
  }

  async findQrSessionForTable(tableId: string): Promise<{ sessionId: string; orders: Order[] } | null> {
    const table = await this.tablesService.findOne(tableId);
    const sessionId = await this.resolveQrSessionId(tableId, table.currentOrderId);
    if (!sessionId) return null;

    const orders = await this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .where('order.tableId = :tableId', { tableId })
      .andWhere('order.orderType = :orderType', { orderType: OrderType.QR })
      .andWhere('(order.id = :sessionId OR order.sessionId = :sessionId)', { sessionId })
      .orderBy('order.createdAt', 'ASC')
      .addOrderBy('item.createdAt', 'ASC')
      .getMany();

    if (orders.length === 0) return null;
    return { sessionId, orders };
  }

  private getTableSessionId(order: Pick<Order, 'id' | 'tableId' | 'sessionId'>): string | undefined {
    return order.tableId ? order.sessionId ?? order.id : undefined;
  }

  private async closeTableSessionIfSettled(order: Order): Promise<void> {
    if (!order.tableId) return;
    const sessionId = this.getTableSessionId(order);
    if (!sessionId) return;

    const sessionOrders = await this.orderRepo
      .createQueryBuilder('order')
      .where('order.tableId = :tableId', { tableId: order.tableId })
      .andWhere('(order.id = :sessionId OR order.sessionId = :sessionId)', { sessionId })
      .getMany();
    const hasOpenOrders = sessionOrders.some(
      (sessionOrder) => ![OrderStatus.COMPLETED, OrderStatus.CANCELLED].includes(sessionOrder.status),
    );
    if (hasOpenOrders) return;

    const table = await this.tablesService.findOne(order.tableId);
    if (table.currentOrderId === sessionId) {
      await this.tablesService.setFree(order.tableId);
    }
  }

  async findActive(): Promise<Order[]> {
    const orders = await this.orderRepo.find({
      where: [
        { status: OrderStatus.APPROVAL_PENDING },
        { status: OrderStatus.APPROVED },
        { status: OrderStatus.COOKING },
        { status: OrderStatus.READY },
        { status: OrderStatus.CREATED },
      ],
      order: { createdAt: 'DESC' },
    });

    // Bring existing QR bills approved before beverage-ready tracking online
    // into the same state as newly approved bills.
    for (const order of orders) {
      if (
        order.status === OrderStatus.APPROVAL_PENDING ||
        [OrderStatus.COMPLETED, OrderStatus.CANCELLED].includes(order.status)
      ) {
        continue;
      }

      for (const item of order.items ?? []) {
        if (
          item.status === OrderItemStatus.PENDING &&
          (item.beverageId || item.routingDestination === 'BILLING')
        ) {
          const updatedItem = await this.updateItemStatus(item.id, OrderItemStatus.READY);
          item.status = updatedItem.status;
        }
      }

      const kitchenItems = (order.items ?? []).filter(
        (item) =>
          !item.beverageId &&
          item.routingDestination !== 'BILLING' &&
          ![OrderItemStatus.REJECTED, OrderItemStatus.REMOVED].includes(item.status),
      );
      if (
        order.status === OrderStatus.COOKING &&
        kitchenItems.length > 0 &&
        kitchenItems.every((item) => item.status === OrderItemStatus.SERVED)
      ) {
        const readyOrder = await this.updateOrderStatus(order.id, OrderStatus.READY);
        order.status = readyOrder.status;
      }
    }

    return this.populateTableNumbers(orders);
  }

  async updateOrderStatus(id: string, status: OrderStatus, extra?: Partial<Order>): Promise<Order> {
    const order = await this.findOne(id);
    order.status = status;
    if (extra) Object.assign(order, extra);
    const saved = await this.orderRepo.save(order);

    const eventMap: Partial<Record<OrderStatus, SocketEvent>> = {
      [OrderStatus.APPROVED]: SocketEvent.ORDER_APPROVED,
      [OrderStatus.CANCELLED]: SocketEvent.ORDER_CANCELLED,
      [OrderStatus.COMPLETED]: SocketEvent.ORDER_COMPLETED,
      [OrderStatus.COOKING]: SocketEvent.ORDER_FIRED,
      [OrderStatus.READY]: SocketEvent.ORDER_UPDATED,
    };
    const event = eventMap[status];
    if (event) {
      this.eventsService.emit(event, saved);
      this.eventsService.emitToOrder(id, event, saved);
      this.eventsService.emitToRoom('approval:hub', event, saved);
      this.eventsService.emitToRoom('pos:all', event, saved);
      const sessionId = this.getTableSessionId(saved);
      if (sessionId) this.eventsService.emitToRoom(`session:${sessionId}`, event, saved);
    }
    if (status === OrderStatus.CANCELLED) {
      await this.closeTableSessionIfSettled(saved);
    }
    return saved;
  }

  async updateItemStatus(itemId: string, status: OrderItemStatus): Promise<OrderItem> {
    const item = await this.itemRepo.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Order item not found');
    const parentOrder = await this.orderRepo.findOne({ where: { id: item.orderId } });
    if (!parentOrder) throw new NotFoundException('Order not found');
    if ([OrderStatus.COMPLETED, OrderStatus.CANCELLED].includes(parentOrder.status)) {
      throw new BadRequestException('Items on completed or cancelled orders cannot be changed');
    }

    const allowedTransitions: Partial<Record<OrderItemStatus, OrderItemStatus[]>> = {
      [OrderItemStatus.PENDING]: [OrderItemStatus.QUEUED, OrderItemStatus.READY],
      [OrderItemStatus.QUEUED]: [OrderItemStatus.COOKING],
      [OrderItemStatus.COOKING]: [OrderItemStatus.READY],
      [OrderItemStatus.READY]: [OrderItemStatus.SERVED],
    };
    if (!allowedTransitions[item.status]?.includes(status)) {
      throw new BadRequestException(`Item cannot move from ${item.status} to ${status}`);
    }
    if (
      parentOrder.status === OrderStatus.APPROVAL_PENDING &&
      item.approvalStatus !== OrderItemApprovalStatus.APPROVED
    ) {
      throw new BadRequestException('Items awaiting approval cannot enter preparation or billing');
    }
    item.status = status;
    if (status === OrderItemStatus.COOKING) item.cookingStartedAt = new Date();
    if (status === OrderItemStatus.READY) item.readyAt = new Date();
    if (status === OrderItemStatus.SERVED) item.servedAt = new Date();
    const saved = await this.itemRepo.save(item);

    const itemEventMap: Partial<Record<OrderItemStatus, SocketEvent>> = {
      [OrderItemStatus.COOKING]: SocketEvent.ITEM_COOKING,
      [OrderItemStatus.READY]: SocketEvent.ITEM_READY,
      [OrderItemStatus.SERVED]: SocketEvent.ITEM_SERVED,
    };
    const itemEvent = itemEventMap[status];
    if (itemEvent) {
      const parentOrder = await this.orderRepo.findOne({
        where: { id: item.orderId },
        select: ['id', 'tableId', 'sessionId'],
      });
      const sessionId = parentOrder && this.getTableSessionId(parentOrder);
      const payload = { ...saved, orderId: item.orderId, sessionId };
      this.eventsService.emit(itemEvent, payload);
      this.eventsService.emitToOrder(item.orderId, itemEvent, payload);
      this.eventsService.emitToRoom('pos:all', itemEvent, payload);
      if (sessionId) this.eventsService.emitToRoom(`session:${sessionId}`, itemEvent, payload);
      if (item.kitchenStation) {
        this.eventsService.emitToStation(item.kitchenStation, itemEvent, payload);
      }
    }
    return saved;
  }

  notifyOrderUpdated(order: Order): void {
    this.eventsService.emit(SocketEvent.ORDER_UPDATED, order);
    this.eventsService.emitToOrder(order.id, SocketEvent.ORDER_UPDATED, order);
    this.eventsService.emitToRoom('approval:hub', SocketEvent.ORDER_UPDATED, order);
    this.eventsService.emitToRoom('pos:all', SocketEvent.ORDER_UPDATED, order);
    const sessionId = this.getTableSessionId(order);
    if (sessionId) this.eventsService.emitToRoom(`session:${sessionId}`, SocketEvent.ORDER_UPDATED, order);
  }

  async editPendingApprovalItem(
    orderId: string,
    itemId: string,
    dto: UpdateApprovalItemDto,
  ): Promise<{ before: Partial<OrderItem>; item: OrderItem; order: Order }> {
    const order = await this.findOne(orderId);
    if (order.status !== OrderStatus.APPROVAL_PENDING || order.settlementStatus === SettlementStatus.PAID) {
      throw new BadRequestException('Only unpaid orders awaiting approval can be edited; use the authorized cancel/refund workflow for fired or paid orders');
    }

    const item = order.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new NotFoundException('Order item not found');
    if (
      (item.approvalStatus ?? OrderItemApprovalStatus.PENDING) !== OrderItemApprovalStatus.PENDING ||
      item.status !== OrderItemStatus.PENDING
    ) {
      throw new BadRequestException('Only pending, unfired items can be edited');
    }
    const isBeverage = !!item.beverageId || item.routingDestination === 'BILLING';
    if (dto.category !== (isBeverage ? 'BEVERAGE' : 'FOOD')) {
      throw new BadRequestException('Item category cannot be changed because it determines inventory and routing');
    }
    if (!dto.menuItemName.trim() || !Number.isInteger(dto.quantity) || dto.quantity < 1) {
      throw new BadRequestException('Item name and a positive whole-number quantity are required');
    }
    if (!Number.isFinite(dto.unitPrice) || dto.unitPrice < 0) {
      throw new BadRequestException('Price must be a non-negative number');
    }

    const before = this.snapshotApprovalItem(item);
    const previousQuantity = item.quantity;
    item.menuItemName = dto.menuItemName.trim();
    item.quantity = dto.quantity;
    item.unitPrice = Number(dto.unitPrice);
    item.notes = dto.notes?.trim() || null;

    if (isBeverage) {
      const bottleOrderFlag = dto.bottleOrderFlag ?? item.bottleOrderFlag;
      const size = bottleOrderFlag ? Number(dto.bottleSizeMl ?? item.bottleSizeMl) : undefined;
      if (bottleOrderFlag && ![180, 375, 750].includes(size)) {
        throw new BadRequestException('Beverage bottle size must be 180ml, 375ml, or 750ml');
      }
      if (!bottleOrderFlag && !['30ML', '60ML', '90ML'].includes(String(dto.servingSize ?? item.servingSize).toUpperCase())) {
        throw new BadRequestException('Beverage serving size must be 30ML, 60ML, 90ML, or a bottle size');
      }
      item.bottleOrderFlag = bottleOrderFlag;
      item.bottleSizeMl = size;
      item.servingSize = bottleOrderFlag
        ? 'BOTTLE'
        : String(dto.servingSize ?? item.servingSize).toUpperCase();
    }

    for (const addon of item.addOns ?? []) {
      addon.quantity = Math.round((Number(addon.quantity) / previousQuantity) * item.quantity);
      addon.lineTotal = Number((Number(addon.unitPrice) * addon.quantity).toFixed(2));
    }
    item.addonTotal = Number((item.addOns ?? []).reduce((total, addon) => total + Number(addon.lineTotal), 0).toFixed(2));
    item.lineTotal = Number((item.unitPrice * item.quantity + item.addonTotal).toFixed(2));
    const savedItem = await this.itemRepo.save(item);
    const updatedOrder = await this.recalculateOrderTotals(orderId);
    return { before, item: savedItem, order: updatedOrder };
  }

  snapshotApprovalItem(item: OrderItem): Partial<OrderItem> {
    return {
      id: item.id,
      menuItemId: item.menuItemId,
      menuItemName: item.menuItemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      addonTotal: item.addonTotal,
      notes: item.notes,
      beverageId: item.beverageId,
      bottleSizeMl: item.bottleSizeMl,
      servingSize: item.servingSize,
      bottleOrderFlag: item.bottleOrderFlag,
      status: item.status,
      approvalStatus: item.approvalStatus,
      addOns: item.addOns,
    };
  }

  async setItemApprovalStatus(
    orderId: string,
    itemId: string,
    approvalStatus: OrderItemApprovalStatus,
    reason?: string,
  ): Promise<{ before: Partial<OrderItem>; item: OrderItem; order: Order }> {
    const order = await this.findOne(orderId);
    if (order.status !== OrderStatus.APPROVAL_PENDING || order.settlementStatus === SettlementStatus.PAID) {
      throw new BadRequestException('Only pending items can be changed; use the authorized cancel/refund workflow for fired or paid orders');
    }
    const item = order.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new NotFoundException('Order item not found');
    if (
      (item.approvalStatus ?? OrderItemApprovalStatus.PENDING) !== OrderItemApprovalStatus.PENDING ||
      item.status !== OrderItemStatus.PENDING
    ) {
      throw new BadRequestException('Item has already been approved, rejected, removed, or fired');
    }

    const before = this.snapshotApprovalItem(item);
    const update: Partial<OrderItem> = { approvalStatus };
    if (approvalStatus === OrderItemApprovalStatus.REJECTED) {
      update.status = OrderItemStatus.REJECTED;
      update.rejectionReason = reason;
    } else if (approvalStatus === OrderItemApprovalStatus.REMOVED) {
      update.status = OrderItemStatus.REMOVED;
      update.rejectionReason = reason;
    }
    const claim = await this.itemRepo.update(
      [
        {
          id: itemId,
          orderId,
          status: OrderItemStatus.PENDING,
          approvalStatus: OrderItemApprovalStatus.PENDING,
        },
        {
          id: itemId,
          orderId,
          status: OrderItemStatus.PENDING,
          approvalStatus: IsNull(),
        },
      ],
      update,
    );
    if (claim.affected !== 1) {
      throw new BadRequestException('Item has already been approved, rejected, removed, or fired');
    }
    const savedItem = await this.itemRepo.findOne({ where: { id: itemId, orderId } });
    if (!savedItem) throw new NotFoundException('Order item not found');
    const updatedOrder = [OrderItemApprovalStatus.REJECTED, OrderItemApprovalStatus.REMOVED].includes(approvalStatus)
      ? await this.recalculateOrderTotals(orderId)
      : await this.findOne(orderId);
    return { before, item: savedItem, order: updatedOrder };
  }

  async resetItemToPendingApproval(orderId: string, itemId: string): Promise<void> {
    const item = await this.itemRepo.findOne({ where: { id: itemId, orderId } });
    if (!item || item.status !== OrderItemStatus.PENDING) return;
    item.approvalStatus = OrderItemApprovalStatus.PENDING;
    await this.itemRepo.save(item);
  }

  async recalculateOrderTotals(orderId: string): Promise<Order> {
    const order = await this.findOne(orderId);
    const billableItems = (order.items ?? []).filter(
      (item) =>
        ![OrderItemStatus.REJECTED, OrderItemStatus.REMOVED].includes(item.status) &&
        ![OrderItemApprovalStatus.REJECTED, OrderItemApprovalStatus.REMOVED].includes(item.approvalStatus),
    );

    let subtotal = 0;
    let taxAmount = 0;
    for (const item of billableItems) {
      subtotal += Number(item.lineTotal) || 0;
      if (!item.beverageId) {
        const menuItem = await this.menuService.findItem(item.menuItemId);
        taxAmount += Number((Number(item.lineTotal) * Number(menuItem.taxPercent) / 100).toFixed(2));
      }
    }

    order.subtotal = Number(subtotal.toFixed(2));
    order.taxAmount = Number(taxAmount.toFixed(2));
    order.grossAmount = Number((order.subtotal + order.taxAmount).toFixed(2));
    if (order.discountType === 'PERCENT' && order.discountValue != null) {
      order.discountAmount = Number((order.grossAmount * Number(order.discountValue) / 100).toFixed(2));
    } else if (order.discountType === 'FLAT' && order.discountValue != null) {
      order.discountAmount = Math.min(order.grossAmount, Number(order.discountValue));
    } else {
      order.discountAmount = Math.min(Number(order.discountAmount) || 0, order.grossAmount);
    }
    order.totalAmount = Number((order.grossAmount - (order.discountAmount ?? 0)).toFixed(2));
    const saved = await this.orderRepo.save(order);
    this.eventsService.emit(SocketEvent.ORDER_UPDATED, saved);
    this.eventsService.emitToOrder(saved.id, SocketEvent.ORDER_UPDATED, saved);
    this.eventsService.emitToRoom('pos:all', SocketEvent.ORDER_UPDATED, saved);
    this.eventsService.emitToRoom('approval:hub', SocketEvent.ORDER_UPDATED, saved);
    const sessionId = this.getTableSessionId(saved);
    if (sessionId) this.eventsService.emitToRoom(`session:${sessionId}`, SocketEvent.ORDER_UPDATED, saved);
    return saved;
  }

  async deleteItem(itemId: string): Promise<Order> {
    const item = await this.itemRepo.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Order item not found');
    const order = await this.findOne(item.orderId);
    if (
      order.status !== OrderStatus.CREATED ||
      order.settlementStatus === SettlementStatus.PAID ||
      item.status !== OrderItemStatus.PENDING
    ) {
      throw new BadRequestException('Only unfired items on active POS orders can be deleted; use the authorized order cancel/refund workflow for fired or paid orders');
    }
    let lineTax = 0;
    if (item.beverageId) {
      await this.beveragesService.restoreForOrderItem(item.id, 'CANCELLATION_RESTORE');
    } else {
      const menuItem = await this.menuService.findItem(item.menuItemId);
      lineTax = item.lineTotal * (menuItem.taxPercent / 100);
    }

    const batchItems = await this.batchItemRepo.find({ where: { orderItemId: itemId } });
    if (batchItems.length > 0) {
      const batchIds = [...new Set(batchItems.map((batchItem) => batchItem.batchId))];
      await this.batchItemRepo.remove(batchItems);
      for (const batchId of batchIds) {
        const remainingBatchItems = await this.batchItemRepo.find({ where: { batchId } });
        if (remainingBatchItems.length === 0) {
          await this.batchRepo.delete(batchId);
        }
      }
    }

    await this.itemRepo.remove(item);

    const remainingItems = await this.itemRepo.find({ where: { orderId: order.id } });
    if (remainingItems.length === 0) {
      return this.cancelOrder(order.id);
    }

    order.items = remainingItems;
    order.subtotal = Number((order.subtotal - item.lineTotal).toFixed(2));
    order.taxAmount = Number((order.taxAmount - lineTax).toFixed(2));
    order.grossAmount = Number((order.subtotal + order.taxAmount).toFixed(2));
    const adjustedDiscount = Math.min(order.discountAmount ?? 0, order.grossAmount);
    order.discountAmount = Number(adjustedDiscount.toFixed(2));
    order.totalAmount = Number((order.grossAmount - order.discountAmount).toFixed(2));
    const saved = await this.orderRepo.save(order);

    this.eventsService.emit(SocketEvent.ORDER_UPDATED, saved);
    this.eventsService.emitToOrder(saved.id, SocketEvent.ORDER_UPDATED, saved);
    this.eventsService.emitToRoom('pos:all', SocketEvent.ORDER_UPDATED, saved);
    const sessionId = this.getTableSessionId(saved);
    if (sessionId) this.eventsService.emitToRoom(`session:${sessionId}`, SocketEvent.ORDER_UPDATED, saved);

    return saved;
  }

  async completeOrder(id: string, paymentMethod?: PaymentMethod, couponCode?: string): Promise<Order> {
    const order = await this.findOne(id);
    if (order.status === OrderStatus.COMPLETED || order.settlementStatus === SettlementStatus.PAID) {
      throw new BadRequestException('Order is already completed');
    }
    if (
      order.status === OrderStatus.APPROVAL_PENDING &&
      order.items.some(
        (item) =>
          item.status === OrderItemStatus.PENDING &&
          (item.approvalStatus ?? OrderItemApprovalStatus.PENDING) === OrderItemApprovalStatus.PENDING,
      )
    ) {
      throw new BadRequestException('All order items must be approved, rejected, or removed before payment');
    }

    const grossAmount = Number((order.subtotal + order.taxAmount).toFixed(2));
    order.grossAmount = grossAmount;

    if (couponCode?.trim()) {
      const coupon = await this.validateCouponForCompletion(couponCode, grossAmount);
      const discountAmount = this.computeDiscount(coupon, grossAmount);
      order.couponId = coupon.id;
      order.couponCode = coupon.code;
      order.discountType = coupon.discountType;
      order.discountValue = coupon.discountValue;
      order.discountAmount = discountAmount;
      await this.couponRepo.increment({ id: coupon.id }, 'usageCount', 1);
    } else {
      order.couponId = null;
      order.couponCode = null;
      order.discountType = null;
      order.discountValue = null;
      order.discountAmount = 0;
    }

    order.totalAmount = Number((order.grossAmount - (order.discountAmount ?? 0)).toFixed(2));

    // Beverage stock is finalized only after successful payment/billing.
    // The deduction method is idempotent and never blocks or creates negative stock.
    for (const item of order.items ?? []) {
      if (
        item.beverageId &&
        ![OrderItemStatus.REJECTED, OrderItemStatus.REMOVED].includes(item.status) &&
        ![OrderItemApprovalStatus.REJECTED, OrderItemApprovalStatus.REMOVED].includes(item.approvalStatus)
      ) {
        await this.beveragesService.deductForOrder(
          item.id,
          item.beverageId,
          item.servingSize,
          item.bottleOrderFlag,
          item.quantity,
          item.bottleSizeMl,
        );
      }
    }

    // A successful bill settlement closes billing-only beverage lines as served,
    // including older orders whose beverage items were still marked pending.
    for (const item of order.items ?? []) {
      if (
        item.status !== OrderItemStatus.SERVED &&
        ![OrderItemStatus.REJECTED, OrderItemStatus.REMOVED].includes(item.status) &&
        (item.beverageId || item.routingDestination === 'BILLING')
      ) {
        await this.updateItemStatus(item.id, OrderItemStatus.SERVED);
      }
    }

    order.status = OrderStatus.COMPLETED;
    order.settlementStatus = SettlementStatus.PAID;
    order.paymentMethod = paymentMethod ?? PaymentMethod.CASH;
    order.settledAt = new Date();
    order.completedAt = new Date();
    const saved = await this.orderRepo.save(order);
    await this.closeTableSessionIfSettled(saved);
    this.eventsService.emit(SocketEvent.ORDER_COMPLETED, saved);
    this.eventsService.emitToOrder(id, SocketEvent.ORDER_COMPLETED, saved);
    this.eventsService.emitToRoom('pos:all', SocketEvent.ORDER_COMPLETED, saved);
    const sessionId = this.getTableSessionId(saved);
    if (sessionId) this.eventsService.emitToRoom(`session:${sessionId}`, SocketEvent.ORDER_COMPLETED, saved);
    return saved;
  }

  async refundOrder(id: string, reason?: string): Promise<Order> {
    const order = await this.findOne(id);
    if (order.settlementStatus !== SettlementStatus.PAID) {
      throw new BadRequestException('Only paid orders can be refunded');
    }

    order.settlementStatus = SettlementStatus.REFUNDED;
    order.refundedAt = new Date();
    order.refundReason = reason;
    const saved = await this.orderRepo.save(order);

    this.eventsService.emit(SocketEvent.ORDER_UPDATED, saved);
    this.eventsService.emitToOrder(id, SocketEvent.ORDER_UPDATED, saved);
    this.eventsService.emitToRoom('pos:all', SocketEvent.ORDER_UPDATED, saved);
    const sessionId = this.getTableSessionId(saved);
    if (sessionId) this.eventsService.emitToRoom(`session:${sessionId}`, SocketEvent.ORDER_UPDATED, saved);

    return saved;
  }

  async cancelOrder(id: string, reason?: string): Promise<Order> {
    const order = await this.findOne(id);
    if ([OrderStatus.COMPLETED, OrderStatus.CANCELLED].includes(order.status)) {
      throw new BadRequestException('Cannot cancel a completed or already cancelled order');
    }
    for (const item of order.items ?? []) {
      if (item.beverageId) await this.beveragesService.restoreForOrderItem(item.id, 'CANCELLATION_RESTORE');
    }
    order.status = OrderStatus.CANCELLED;
    order.settlementStatus = SettlementStatus.CANCELLED;
    order.rejectionReason = reason;
    const saved = await this.orderRepo.save(order);
    await this.closeTableSessionIfSettled(saved);
    this.eventsService.emit(SocketEvent.ORDER_CANCELLED, saved);
    this.eventsService.emitToOrder(id, SocketEvent.ORDER_CANCELLED, saved);
    this.eventsService.emitToRoom('approval:hub', SocketEvent.ORDER_CANCELLED, saved);
    const sessionId = this.getTableSessionId(saved);
    if (sessionId) this.eventsService.emitToRoom(`session:${sessionId}`, SocketEvent.ORDER_CANCELLED, saved);
    return saved;
  }

  async getOrderSummary(orderId: string) {
    const order = await this.findOne(orderId);
    const activeItems = order.items.filter(
      (item) => ![OrderItemStatus.REJECTED, OrderItemStatus.REMOVED].includes(item.status),
    );
    const allServed = activeItems.length > 0 && activeItems.every((i) => i.status === OrderItemStatus.SERVED);
    const anyReady = activeItems.some((i) => i.status === OrderItemStatus.READY);
    return { order, allServed, anyReady };
  }

  /** Returns all active orders keyed by tableId for the tables overview */
  async findActiveByTable(): Promise<Order[]> {
    const orders = await this.orderRepo.find({
      where: [
        { status: OrderStatus.APPROVAL_PENDING },
        { status: OrderStatus.CREATED },
        { status: OrderStatus.APPROVED },
        { status: OrderStatus.COOKING },
        { status: OrderStatus.READY },
      ],
      order: { createdAt: 'ASC' },
    });
    return this.populateTableNumbers(orders);
  }

  async getTransactions(params: {
    from?: string;
    to?: string;
    settlement?: SettlementStatus | 'ALL';
    orderType?: OrderType | 'ALL';
    method?: PaymentMethod | 'ALL';
    search?: string;
  }) {
    const {
      from,
      to,
      settlement = 'ALL',
      orderType = 'ALL',
      method = 'ALL',
      search,
    } = params;

    const query = this.orderRepo.createQueryBuilder('order').orderBy('order.createdAt', 'DESC');

    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) {
        query.andWhere('order.createdAt >= :fromDate', { fromDate });
      }
    }

    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        const toDateEnd = new Date(toDate);
        toDateEnd.setDate(toDateEnd.getDate() + 1);
        query.andWhere('order.createdAt < :toDate', { toDate: toDateEnd });
      }
    }

    if (settlement !== 'ALL') {
      query.andWhere('order.settlementStatus = :settlement', { settlement });
    }

    if (orderType !== 'ALL') {
      query.andWhere('order.orderType = :orderType', { orderType });
    }

    if (method !== 'ALL') {
      query.andWhere('order.paymentMethod = :method', { method });
    }

    if (search?.trim()) {
      query.andWhere('(order.billNo LIKE :search OR order.id LIKE :search)', {
        search: `%${search.trim()}%`,
      });
    }

    const entries = await this.populateTableNumbers(await query.getMany());

    const paidLifetime = await this.orderRepo
      .createQueryBuilder('order')
      .select('COALESCE(SUM(order.totalAmount), 0)', 'sum')
      .where('order.settlementStatus = :status', { status: SettlementStatus.PAID })
      .getRawOne<{ sum: string }>();

    const filteredPool = entries.reduce((sum, entry) => sum + Number(entry.totalAmount), 0);

    return {
      summary: {
        lifetimeRevenue: Number(paidLifetime?.sum ?? 0),
        filteredPool: Number(filteredPool.toFixed(2)),
        entryCount: entries.length,
      },
      entries,
    };
  }

  async getItemPerformance(params: {
    from?: string;
    to?: string;
    orderType?: OrderType | 'ALL';
    search?: string;
  }) {
    const {
      from,
      to,
      orderType = 'ALL',
      search,
    } = params;

    const query = this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .select('item.menuItemId', 'menuItemId')
      .addSelect('item.menuItemName', 'menuItemName')
      .addSelect('SUM(item.quantity)', 'totalQuantity')
      .addSelect('COUNT(DISTINCT order.id)', 'orderCount')
      .addSelect('SUM(item.lineTotal)', 'grossSales')
      .where('order.settlementStatus = :settlementStatus', { settlementStatus: SettlementStatus.PAID });

    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) {
        query.andWhere('order.createdAt >= :fromDate', { fromDate });
      }
    }

    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        const toDateEnd = new Date(toDate);
        toDateEnd.setDate(toDateEnd.getDate() + 1);
        query.andWhere('order.createdAt < :toDate', { toDate: toDateEnd });
      }
    }

    if (orderType !== 'ALL') {
      query.andWhere('order.orderType = :orderType', { orderType });
    }

    if (search?.trim()) {
      query.andWhere('item.menuItemName LIKE :search', {
        search: `%${search.trim()}%`,
      });
    }

    const rows = await query
      .groupBy('item.menuItemId')
      .addGroupBy('item.menuItemName')
      .orderBy('SUM(item.quantity)', 'DESC')
      .addOrderBy('item.menuItemName', 'ASC')
      .getRawMany<{
        menuItemId: string;
        menuItemName: string;
        totalQuantity: string;
        orderCount: string;
        grossSales: string;
      }>();

    const entries = rows.map((row, index) => ({
      rank: index + 1,
      menuItemId: row.menuItemId,
      menuItemName: row.menuItemName,
      totalQuantity: Number(row.totalQuantity ?? 0),
      orderCount: Number(row.orderCount ?? 0),
      grossSales: Number(Number(row.grossSales ?? 0).toFixed(2)),
    }));

    return {
      summary: {
        totalItems: entries.length,
        totalQuantity: entries.reduce((sum, entry) => sum + entry.totalQuantity, 0),
        totalSales: Number(entries.reduce((sum, entry) => sum + entry.grossSales, 0).toFixed(2)),
      },
      entries,
    };
  }

  async transferOrder(orderId: string, toTableId: string): Promise<Order> {
    const order = await this.findOne(orderId);
    const toTable = await this.tablesService.findOne(toTableId);
    
    if (!toTable) {
      throw new NotFoundException(`Table ${toTableId} not found`);
    }

    // Store old table ID before updating
    const oldTableId = order.tableId;

    // Update order to new table
    order.tableId = toTableId;
    order.tableNumber = toTable.tableNumber;
    const saved = await this.orderRepo.save(order);

    // Update table statuses
    if (oldTableId) {
      // Check if old table has any remaining active orders (not completed or cancelled)
      const activeOrders = await this.orderRepo
        .createQueryBuilder('order')
        .where('order.tableId = :tableId', { tableId: oldTableId })
        .andWhere('order.status NOT IN (:...statuses)', {
          statuses: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        })
        .getCount();

      if (activeOrders === 0) {
        // No more active orders on old table, mark it as FREE
        await this.tablesService.setFree(oldTableId);
      }
    }

    // Mark new table as OCCUPIED with the transferred order
    if (order.orderType === OrderType.DINE_IN) {
      await this.tablesService.setOccupied(toTableId, saved.id);
    }

    // Broadcast transfer event
    this.eventsService.emit(SocketEvent.ORDER_TRANSFERRED, saved);
    this.eventsService.emitToRoom('pos:all', SocketEvent.ORDER_TRANSFERRED, saved);

    return saved;
  }

  async mergeOrderIntoOrder(sourceOrderId: string, destinationOrderId: string): Promise<Order> {
    if (sourceOrderId === destinationOrderId) {
      throw new BadRequestException('Source and destination bills must be different');
    }

    let cancelledSourceTableId: string | null = null;

    await this.orderRepo.manager.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const itemRepo = manager.getRepository(OrderItem);

      const source = await orderRepo.findOne({ where: { id: sourceOrderId } });
      const destination = await orderRepo.findOne({ where: { id: destinationOrderId } });

      if (!source) {
        throw new NotFoundException('Source order not found');
      }
      if (!destination) {
        throw new NotFoundException('Destination order not found');
      }

      const blockedStatuses = [OrderStatus.COMPLETED, OrderStatus.CANCELLED];
      if (blockedStatuses.includes(source.status)) {
        throw new BadRequestException('Source bill is already closed');
      }
      if (blockedStatuses.includes(destination.status)) {
        throw new BadRequestException('Destination bill is already closed');
      }

      const sourceItemsCount = await itemRepo.count({ where: { orderId: source.id } });
      if (sourceItemsCount === 0) {
        throw new BadRequestException('Source bill has no items to merge');
      }

      await itemRepo
        .createQueryBuilder()
        .update(OrderItem)
        .set({ orderId: destination.id })
        .where('orderId = :sourceId', { sourceId: source.id })
        .execute();

      const nextDestinationSubtotal = Number((destination.subtotal + source.subtotal).toFixed(2));
      const nextDestinationTax = Number((destination.taxAmount + source.taxAmount).toFixed(2));
      const nextDestinationTotal = Number((destination.totalAmount + source.totalAmount).toFixed(2));

      await orderRepo
        .createQueryBuilder()
        .update(Order)
        .set({
          subtotal: nextDestinationSubtotal,
          taxAmount: nextDestinationTax,
          totalAmount: nextDestinationTotal,
        })
        .where('id = :id', { id: destination.id })
        .execute();

      await orderRepo
        .createQueryBuilder()
        .update(Order)
        .set({
          subtotal: 0,
          taxAmount: 0,
          totalAmount: 0,
          status: OrderStatus.CANCELLED,
          settlementStatus: SettlementStatus.CANCELLED,
          rejectionReason: `Merged into ${destination.billNo ?? destination.id}`,
        })
        .where('id = :id', { id: source.id })
        .execute();

      cancelledSourceTableId = source.tableId ?? null;
    });

    const mergedDestination = await this.findOne(destinationOrderId);

    if (cancelledSourceTableId) {
      const activeOrders = await this.orderRepo
        .createQueryBuilder('order')
        .where('order.tableId = :tableId', { tableId: cancelledSourceTableId })
        .andWhere('order.status NOT IN (:...statuses)', {
          statuses: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        })
        .getCount();

      if (activeOrders === 0) {
        await this.tablesService.setFree(cancelledSourceTableId);
      }
    }

    if (mergedDestination.tableId && mergedDestination.orderType === OrderType.DINE_IN) {
      await this.tablesService.setOccupied(mergedDestination.tableId, mergedDestination.id);
    }

    this.eventsService.emit(SocketEvent.ORDER_UPDATED, mergedDestination);
    this.eventsService.emitToOrder(mergedDestination.id, SocketEvent.ORDER_UPDATED, mergedDestination);
    this.eventsService.emitToRoom('pos:all', SocketEvent.ORDER_UPDATED, mergedDestination);
    if (mergedDestination.status === OrderStatus.APPROVAL_PENDING) {
      this.eventsService.emitToRoom('approval:hub', SocketEvent.ORDER_UPDATED, mergedDestination);
    }

    this.eventsService.emit(SocketEvent.ORDER_CANCELLED, { id: sourceOrderId });
    this.eventsService.emitToRoom('pos:all', SocketEvent.ORDER_CANCELLED, { id: sourceOrderId });
    this.eventsService.emitToRoom('approval:hub', SocketEvent.ORDER_CANCELLED, { id: sourceOrderId });

    return this.populateTableNumber(mergedDestination);
  }
}
