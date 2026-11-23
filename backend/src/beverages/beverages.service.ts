import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BeverageCategory } from './entities/beverage-category.entity';
import { BeverageProduct } from './entities/beverage-product.entity';
import { BeverageInventory } from './entities/beverage-inventory.entity';
import { BeverageStockTransaction } from './entities/beverage-stock-transaction.entity';

@Injectable()
export class BeveragesService {
  constructor(
    @InjectRepository(BeverageCategory) private categories: Repository<BeverageCategory>,
    @InjectRepository(BeverageProduct) private products: Repository<BeverageProduct>,
    @InjectRepository(BeverageInventory) private inventory: Repository<BeverageInventory>,
    @InjectRepository(BeverageStockTransaction) private transactions: Repository<BeverageStockTransaction>,
  ) {}

  categoriesList() { return this.categories.find({ order: { name: 'ASC' } }); }
  async createCategory(dto: Partial<BeverageCategory>) { return this.categories.save(this.categories.create({ ...dto, active: dto.active ?? true })); }
  async updateCategory(id: string, dto: Partial<BeverageCategory>) { const x = await this.categories.findOneBy({ id }); if (!x) throw new NotFoundException('Category not found'); Object.assign(x, dto); return this.categories.save(x); }
  async removeCategory(id: string) { const x = await this.categories.findOneBy({ id }); if (!x) throw new NotFoundException('Category not found'); await this.categories.remove(x); }

  async listProducts(search?: string) {
    const qb = this.products.createQueryBuilder('p');
    if (search?.trim()) qb.where('(p.brand LIKE :s OR p.productName LIKE :s)', { s: `%${search.trim()}%` });
    qb.orderBy('p.brand', 'ASC');
    const products = await qb.getMany();
    return Promise.all(products.map(async (product) => ({
      ...product,
      inventory: await this.inventory.findOneBy({ beverageId: product.id }),
    })));
  }
  async getProduct(id: string) { const x = await this.products.findOneBy({ id }); if (!x) throw new NotFoundException('Beverage not found'); return { ...x, inventory: await this.inventory.findOneBy({ beverageId: id }) }; }
  async createProduct(dto: any) {
    if (!dto.categoryId) throw new BadRequestException('Category is required');
    if (!String(dto.brand ?? '').trim()) throw new BadRequestException('Brand name is required');
    if (![180, 375, 750].includes(Number(dto.bottleSize))) throw new BadRequestException('Bottle size must be 180ml, 375ml, or 750ml');
    if (!Number.isFinite(Number(dto.bottlePrice)) || Number(dto.bottlePrice) <= 0) throw new BadRequestException('Bottle selling price must be greater than zero');
    const created = this.products.create({ ...dto, brand: dto.brand.trim(), productName: String(dto.productName ?? '').trim(), bottleSize: Number(dto.bottleSize), bottlePrice: Number(dto.bottlePrice), active: dto.active ?? true } as any) as unknown as BeverageProduct;
    const x = await this.products.save(created as any) as unknown as BeverageProduct;
    const initialStock = Math.max(0, Number(dto.availableMl ?? 0) || 0);
    await this.inventory.save(this.inventory.create({ beverageId: x.id, availableMl: initialStock, lowStockThreshold: dto.lowStockThreshold ?? 0 }));
    if (initialStock > 0) await this.transactions.save(this.transactions.create({ beverageId: x.id, quantityMl: initialStock, transactionType: 'RESTOCK', referenceId: 'INITIAL_STOCK' }));
    return this.getProduct(x.id);
  }
  async updateProduct(id: string, dto: any) { const x = await this.products.findOneBy({ id }); if (!x) throw new NotFoundException('Beverage not found'); if (dto.brand != null && !String(dto.brand).trim()) throw new BadRequestException('Brand is required'); if (dto.bottleSize != null && ![180, 375, 750].includes(Number(dto.bottleSize))) throw new BadRequestException('Bottle size must be 180ml, 375ml, or 750ml'); if (dto.bottlePrice != null && (!Number.isFinite(Number(dto.bottlePrice)) || Number(dto.bottlePrice) <= 0)) throw new BadRequestException('Bottle selling price must be greater than zero'); Object.assign(x, dto); await this.products.save(x); return this.getProduct(id); }
  async removeProduct(id: string) { const x = await this.products.findOneBy({ id }); if (!x) throw new NotFoundException('Beverage not found'); await this.products.remove(x); await this.inventory.delete({ beverageId: id }); }

  servingMl(product: BeverageProduct, servingSize?: string, bottleOrder = false, bottleSizeMl?: number) {
    if (bottleOrder) return Number(bottleSizeMl ?? product.bottleSize);
    if (servingSize === '30ML') return 30; if (servingSize === '60ML') return 60; if (servingSize === '90ML') return 90;
    throw new BadRequestException('Serving size must be 30ML, 60ML, 90ML, or BOTTLE');
  }
  async deductForOrder(orderItemId: string, beverageId: string, servingSize?: string, bottleOrder = false, quantity = 1, bottleSizeMl?: number) {
    const duplicate = await this.transactions.findOne({ where: { referenceId: orderItemId, transactionType: 'SALE_DEDUCTION', beverageId } });
    if (duplicate) return duplicate;
    const product = await this.products.findOneBy({ id: beverageId });
    if (!product || !product.active) throw new BadRequestException('Beverage is unavailable');

    const inv = await this.inventory.findOneBy({ beverageId });
    if (!inv) {
      // Inventory records may be absent for legacy data. Ordering still succeeds;
      // this does not create stock or change it from unknown to zero.
      return null;
    }

    const requestedAmount = this.servingMl(product, servingSize, bottleOrder, bottleSizeMl) * Math.max(0, Number(quantity) || 0);
    const availableAmount = Math.max(0, Number(inv.availableMl) || 0);
    const actualDeduction = Math.min(availableAmount, requestedAmount);

    if (actualDeduction > 0) {
      inv.availableMl = Number((availableAmount - actualDeduction).toFixed(3));
      if (inv.availableMl < 0) inv.availableMl = 0;
      await this.inventory.save(inv);
      return this.transactions.save(this.transactions.create({ beverageId, quantityMl: -actualDeduction, transactionType: 'SALE_DEDUCTION', referenceId: orderItemId }));
    }

    return null;
  }
  async adjustStock(beverageId: string, quantityMl: number, referenceId?: string) {
    const inv = await this.inventory.findOneBy({ beverageId }); if (!inv) throw new NotFoundException('Beverage inventory not found');
    inv.availableMl = Number((inv.availableMl + quantityMl).toFixed(3)); if (inv.availableMl < 0) throw new BadRequestException('Stock cannot be negative'); await this.inventory.save(inv);
    return this.transactions.save(this.transactions.create({ beverageId, quantityMl, transactionType: quantityMl >= 0 ? 'RESTOCK' : 'ADJUSTMENT', referenceId: referenceId ?? 'MANUAL_ADJUSTMENT' }));
  }
  async restoreForOrderItem(orderItemId: string, reason: 'REJECTION_RESTORE' | 'CANCELLATION_RESTORE') {
    const alreadyRestored = await this.transactions.findOne({ where: { referenceId: orderItemId, transactionType: reason } });
    if (alreadyRestored) return alreadyRestored;
    const deductions = await this.transactions.find({ where: { referenceId: orderItemId, transactionType: 'SALE_DEDUCTION' } });
    for (const deduction of deductions) { const inv = await this.inventory.findOneBy({ beverageId: deduction.beverageId }); if (inv) { inv.availableMl = Number((inv.availableMl + Math.abs(deduction.quantityMl)).toFixed(3)); await this.inventory.save(inv); await this.transactions.save(this.transactions.create({ beverageId: deduction.beverageId, quantityMl: Math.abs(deduction.quantityMl), transactionType: reason, referenceId: orderItemId })); } }
  }
  async transactionHistory(beverageId?: string) { const where = beverageId ? { beverageId } : {}; return this.transactions.find({ where, order: { createdAt: 'DESC' } }); }

}
