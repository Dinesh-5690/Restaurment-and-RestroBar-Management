import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { OrderStatus, SettlementStatus } from '../common/enums';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly itemRepo: Repository<OrderItem>,
  ) {}

  private getRanges() {
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth();
    const d = now.getDate();

    const todayStart = new Date(y, mo, d);
    const todayEnd   = new Date(y, mo, d + 1);
    const yStart     = new Date(y, mo, d - 1);
    const yEnd       = new Date(y, mo, d);

    const dow       = todayStart.getDay();
    const weekStart = new Date(y, mo, d - (dow === 0 ? 6 : dow - 1));
    const monthStart = new Date(y, mo, 1);

    return { todayStart, todayEnd, yStart, yEnd, weekStart, monthStart };
  }

  private async revenueAndOrders(start: Date, end: Date) {
    const raw = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.totalAmount), 0)', 'revenue')
      .addSelect('COUNT(o.id)', 'orders')
      .where('o.settlementStatus = :s', { s: SettlementStatus.PAID })
      .andWhere('o.createdAt >= :start', { start })
      .andWhere('o.createdAt < :end', { end })
      .getRawOne<{ revenue: string; orders: string }>();
    return {
      revenue: Number(raw?.revenue ?? 0),
      orders:  Number(raw?.orders  ?? 0),
    };
  }

  async getSummary() {
    const { todayStart, todayEnd, yStart, yEnd, weekStart, monthStart } = this.getRanges();

    const [today, yesterday, week, month] = await Promise.all([
      this.revenueAndOrders(todayStart, todayEnd),
      this.revenueAndOrders(yStart,     yEnd),
      this.revenueAndOrders(weekStart,  todayEnd),
      this.revenueAndOrders(monthStart, todayEnd),
    ]);

    const avgOrderValue = today.orders > 0
      ? Number((today.revenue / today.orders).toFixed(2))
      : 0;

    // cancelled count today
    const cancelRaw = await this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(o.id)', 'cnt')
      .where('o.status = :s', { s: OrderStatus.CANCELLED })
      .andWhere('o.createdAt >= :start', { start: todayStart })
      .andWhere('o.createdAt < :end', { end: todayEnd })
      .getRawOne<{ cnt: string }>();
    const cancelledToday = Number(cancelRaw?.cnt ?? 0);

    // growth vs yesterday
    const revenueGrowth = yesterday.revenue > 0
      ? Number(((today.revenue - yesterday.revenue) / yesterday.revenue * 100).toFixed(1))
      : null;
    const ordersGrowth = yesterday.orders > 0
      ? Number(((today.orders - yesterday.orders) / yesterday.orders * 100).toFixed(1))
      : null;

    // hourly breakdown — load all today orders, bucket in JS
    const todayOrders = await this.orderRepo
      .createQueryBuilder('o')
      .select(['o.id', 'o.createdAt', 'o.totalAmount', 'o.settlementStatus'])
      .where('o.createdAt >= :start', { start: todayStart })
      .andWhere('o.createdAt < :end', { end: todayEnd })
      .getMany();

    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, revenue: 0 }));
    for (const o of todayOrders) {
      const h = new Date(o.createdAt).getHours();
      hourly[h].orders++;
      if (o.settlementStatus === SettlementStatus.PAID) {
        hourly[h].revenue = Number((hourly[h].revenue + Number(o.totalAmount)).toFixed(2));
      }
    }

    // order type breakdown — all orders today
    const typesRaw = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.orderType', 'type')
      .addSelect('COUNT(o.id)', 'count')
      .addSelect('COALESCE(SUM(o.totalAmount), 0)', 'revenue')
      .where('o.createdAt >= :start', { start: todayStart })
      .andWhere('o.createdAt < :end', { end: todayEnd })
      .groupBy('o.orderType')
      .getRawMany<{ type: string; count: string; revenue: string }>();

    const totalTypeCnt = typesRaw.reduce((s, r) => s + Number(r.count), 0);
    const orderTypeBreakdown = typesRaw
      .map(r => ({
        type:    r.type,
        count:   Number(r.count),
        revenue: Number(Number(r.revenue).toFixed(2)),
        pct:     totalTypeCnt > 0
          ? Number(((Number(r.count) / totalTypeCnt) * 100).toFixed(1))
          : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // top 5 items today
    const topTodayRaw = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.order', 'o')
      .select('item.menuItemId', 'id')
      .addSelect('item.menuItemName', 'name')
      .addSelect('SUM(item.quantity)', 'qty')
      .addSelect('SUM(item.lineTotal)', 'revenue')
      .where('o.settlementStatus = :s', { s: SettlementStatus.PAID })
      .andWhere('o.createdAt >= :start', { start: todayStart })
      .andWhere('o.createdAt < :end', { end: todayEnd })
      .groupBy('item.menuItemId')
      .addGroupBy('item.menuItemName')
      .orderBy('SUM(item.quantity)', 'DESC')
      .limit(5)
      .getRawMany<{ id: string; name: string; qty: string; revenue: string }>();

    // top 5 items this week
    const topWeekRaw = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.order', 'o')
      .select('item.menuItemId', 'id')
      .addSelect('item.menuItemName', 'name')
      .addSelect('SUM(item.quantity)', 'qty')
      .addSelect('SUM(item.lineTotal)', 'revenue')
      .where('o.settlementStatus = :s', { s: SettlementStatus.PAID })
      .andWhere('o.createdAt >= :start', { start: weekStart })
      .andWhere('o.createdAt < :end', { end: todayEnd })
      .groupBy('item.menuItemId')
      .addGroupBy('item.menuItemName')
      .orderBy('SUM(item.quantity)', 'DESC')
      .limit(5)
      .getRawMany<{ id: string; name: string; qty: string; revenue: string }>();

    // recent 10 paid orders
    const recentRaw = await this.orderRepo
      .createQueryBuilder('o')
      .select([
        'o.id', 'o.billNo', 'o.orderType', 'o.tableNumber',
        'o.totalAmount', 'o.status', 'o.settlementStatus',
        'o.paymentMethod', 'o.createdAt',
      ])
      .where('o.settlementStatus = :s', { s: SettlementStatus.PAID })
      .orderBy('o.createdAt', 'DESC')
      .limit(10)
      .getMany();

    return {
      today:     { ...today, avgOrderValue, cancelledToday },
      yesterday,
      week,
      month,
      growth: { revenue: revenueGrowth, orders: ordersGrowth },
      hourly,
      orderTypeBreakdown,
      topItemsToday: topTodayRaw.map((r, i) => ({
        rank:    i + 1,
        id:      r.id,
        name:    r.name,
        qty:     Number(r.qty    ?? 0),
        revenue: Number(Number(r.revenue ?? 0).toFixed(2)),
      })),
      topItemsWeek: topWeekRaw.map((r, i) => ({
        rank:    i + 1,
        id:      r.id,
        name:    r.name,
        qty:     Number(r.qty    ?? 0),
        revenue: Number(Number(r.revenue ?? 0).toFixed(2)),
      })),
      recentOrders: recentRaw.map(o => ({
        id:               o.id,
        billNo:           o.billNo ?? `BILL-${o.id.slice(0, 8).toUpperCase()}`,
        orderType:        o.orderType,
        tableNumber:      o.tableNumber ?? null,
        totalAmount:      Number(o.totalAmount),
        status:           o.status,
        settlementStatus: o.settlementStatus,
        paymentMethod:    o.paymentMethod,
        createdAt:        o.createdAt,
      })),
    };
  }
}
