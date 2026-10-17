import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense, ExpenseCategory } from './entities/expense.entity';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';
import { Order } from '../orders/entities/order.entity';
import { SettlementStatus } from '../common/enums';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense) private readonly repo: Repository<Expense>,
    @InjectRepository(Order)   private readonly orderRepo: Repository<Order>,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────
  async create(dto: CreateExpenseDto): Promise<Expense> {
    const expense = this.repo.create({
      ...dto,
      amount:      Number(dto.amount),
      category:    dto.category   ?? ExpenseCategory.OTHER,
    });
    return this.repo.save(expense);
  }

  async findAll(params: {
    from?:     string;
    to?:       string;
    category?: string;
    search?:   string;
  }): Promise<Expense[]> {
    const { from, to, category, search } = params;
    const q = this.repo.createQueryBuilder('e').orderBy('e.expenseDate', 'DESC').addOrderBy('e.createdAt', 'DESC');

    if (from)     q.andWhere('e.expenseDate >= :from',     { from });
    if (to)       q.andWhere('e.expenseDate <= :to',       { to });
    if (category && category !== 'ALL') q.andWhere('e.category = :category', { category });
    if (search?.trim()) {
      q.andWhere('(e.title LIKE :s OR e.description LIKE :s OR e.reference LIKE :s)', {
        s: `%${search.trim()}%`,
      });
    }
    return q.getMany();
  }

  async findOne(id: string): Promise<Expense> {
    const e = await this.repo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('Expense not found');
    return e;
  }

  async update(id: string, dto: UpdateExpenseDto): Promise<Expense> {
    const e = await this.findOne(id);
    Object.assign(e, { ...dto, amount: Number(dto.amount) });
    return this.repo.save(e);
  }

  async remove(id: string): Promise<void> {
    const e = await this.findOne(id);
    await this.repo.remove(e);
  }

  // ─── Summary / Analytics ─────────────────────────────────────────
  async getSummary(params: { from?: string; to?: string }) {
    const { from, to } = params;

    // ---- expense totals by category ----
    const q = this.repo.createQueryBuilder('e')
      .select('e.category', 'category')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'total')
      .addSelect('COUNT(e.id)', 'count');
    if (from) q.andWhere('e.expenseDate >= :from', { from });
    if (to)   q.andWhere('e.expenseDate <= :to',   { to });
    q.groupBy('e.category').orderBy('SUM(e.amount)', 'DESC');

    const byCategory = await q.getRawMany<{ category: string; total: string; count: string }>();

    const totalExpenses = byCategory.reduce((s, r) => s + Number(r.total), 0);

    // ---- revenue in same window ----
    const rq = this.orderRepo.createQueryBuilder('o')
      .select('COALESCE(SUM(o.totalAmount), 0)', 'revenue')
      .where('o.settlementStatus = :s', { s: SettlementStatus.PAID });
    if (from) rq.andWhere('o.createdAt >= :fromDate', { fromDate: new Date(from) });
    if (to) {
      const toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1);
      rq.andWhere('o.createdAt < :toDate', { toDate });
    }
    const revRaw = await rq.getRawOne<{ revenue: string }>();
    const totalRevenue = Number(revRaw?.revenue ?? 0);

    // ---- daily totals for chart (group by expenseDate) ----
    const dq = this.repo.createQueryBuilder('e')
      .select('e.expenseDate', 'date')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'total');
    if (from) dq.andWhere('e.expenseDate >= :from', { from });
    if (to)   dq.andWhere('e.expenseDate <= :to',   { to });
    dq.groupBy('e.expenseDate').orderBy('e.expenseDate', 'ASC');
    const daily = await dq.getRawMany<{ date: string; total: string }>();

    return {
      summary: {
        totalExpenses:  Number(totalExpenses.toFixed(2)),
        totalRevenue:   Number(totalRevenue.toFixed(2)),
        netProfit:      Number((totalRevenue - totalExpenses).toFixed(2)),
        profitMargin:   totalRevenue > 0
          ? Number(((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1))
          : null,
      },
      byCategory: byCategory.map(r => ({
        category: r.category,
        total:    Number(Number(r.total).toFixed(2)),
        count:    Number(r.count),
        pct:      totalExpenses > 0
          ? Number((Number(r.total) / totalExpenses * 100).toFixed(1))
          : 0,
      })),
      daily: daily.map(r => ({ date: r.date, total: Number(Number(r.total).toFixed(2)) })),
    };
  }
}
