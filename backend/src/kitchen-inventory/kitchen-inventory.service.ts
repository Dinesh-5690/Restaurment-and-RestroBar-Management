import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RawMaterial } from './entities/raw-material.entity';
import { MaterialStock } from './entities/material-stock.entity';
import { KitchenStockTransaction } from './entities/stock-transaction.entity';
import { InventoryAlert } from './entities/inventory-alert.entity';
import { MaterialBatch } from './entities/material-batch.entity';
import { MaterialCategory } from './entities/material-category.entity';
import { Supplier } from './entities/supplier.entity';
import { MaterialSuggestion } from './entities/material-suggestion.entity';

@Injectable()
export class KitchenInventoryService {
  constructor(
    @InjectDataSource() private ds: DataSource,
    @InjectRepository(RawMaterial) private materials: Repository<RawMaterial>,
    @InjectRepository(MaterialStock) private stock: Repository<MaterialStock>,
    @InjectRepository(KitchenStockTransaction) private transactions: Repository<KitchenStockTransaction>,
    @InjectRepository(InventoryAlert) private alerts: Repository<InventoryAlert>,
    @InjectRepository(MaterialBatch) private batchRepo: Repository<MaterialBatch>,
    @InjectRepository(MaterialCategory) private categories: Repository<MaterialCategory>,
    @InjectRepository(Supplier) private suppliers: Repository<Supplier>,
    @InjectRepository(MaterialSuggestion) private suggestions: Repository<MaterialSuggestion>,
  ) {}

  async seedCategories() {
    const names = ['Vegetables','Meat','Poultry','Seafood','Groceries','Dairy','Spices & Masalas','Other Ingredients'];
    for (const name of names) if (!await this.categories.findOneBy({ name })) await this.categories.save(this.categories.create({ name }));
  }

  private predefinedSuggestions: Record<string, string[]> = {
    Vegetables: ['Tomato','Onion','Potato','Carrot','Cabbage','Beans','Brinjal','Garlic','Ginger','Green Chilli'],
    Poultry: ['Chicken','Eggs','Duck'],
    Meat: ['Mutton','Beef','Pork','Lamb'],
    Seafood: ['Fish','Prawns','Crab','Squid'],
    Dairy: ['Milk','Butter','Cheese','Curd','Cream','Paneer'],
    Groceries: ['Rice','Wheat','Sugar','Salt','Flour','Oil','Dal'],
    'Spices & Masalas': ['Turmeric','Chilli Powder','Pepper','Cumin','Coriander Powder','Garam Masala'],
    'Other Ingredients': ['Bread','Noodles','Pasta','Vinegar','Sauces'],
  };

  async seedSuggestions() {
    await this.seedCategories();
    const categories = await this.categories.find({ where: { active: true } });
    for (const category of categories) {
      for (const name of this.predefinedSuggestions[category.name] || []) {
        const existing = await this.suggestions.findOne({ where: { categoryId: category.id } });
        const all = await this.suggestions.find({ where: { categoryId: category.id } });
        if (!all.some(s => s.name.toLowerCase() === name.toLowerCase())) {
          await this.suggestions.save(this.suggestions.create({ categoryId: category.id, categoryName: category.name, name, predefined: true }));
        }
      }
    }
  }

  async suggestionsList(categoryId?: string, search?: string) {
    await this.seedSuggestions();
    if (!categoryId) return [];
    const category = await this.categories.findOneBy({ id: categoryId });
    if (!category) return [];
    const rows = await this.suggestions.find({ where: { categoryId }, order: { name: 'ASC' } });
    const customMaterials = await this.materials.find({ where: { categoryId } });
    const merged = new Map<string, any>();
    for (const row of rows) merged.set(row.name.toLowerCase(), { id: row.id, name: row.name, predefined: row.predefined });
    for (const material of customMaterials) if (material.name?.trim()) merged.set(material.name.trim().toLowerCase(), { id: material.id, name: material.name.trim(), predefined: false });
    let result = Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
    if (search?.trim()) {
      const query = search.trim().toLowerCase();
      result = result.filter(item => item.name.toLowerCase().includes(query));
    }
    return result;
  }

  private async rememberSuggestion(categoryId: string | null, categoryName: string | null, name: string) {
    if (!categoryId || !categoryName || !name?.trim()) return;
    const all = await this.suggestions.find({ where: { categoryId } });
    if (!all.some(s => s.name.toLowerCase() === name.trim().toLowerCase())) {
      await this.suggestions.save(this.suggestions.create({ categoryId, categoryName, name: name.trim(), predefined: false }));
    }
  }

  async dashboard() {
    await this.seedCategories();
    await this.refreshAlerts();
    const materials = await this.listMaterials();
    const unresolvedAlerts = (await this.alerts.find({ where: { resolved: false }, order: { createdAt: 'DESC' } }))
      .filter(alert => alert.alertType === 'LOW_STOCK' || alert.alertType === 'OUT_OF_STOCK');
    const availableStock = materials.reduce((sum, m) => sum + Number(m.currentStock || 0), 0);
    const available = materials.filter(m => m.stockStatus === 'AVAILABLE').length;
    const low = materials.filter(m => m.stockStatus === 'LOW_STOCK').length;
    const out = materials.filter(m => m.stockStatus === 'OUT_OF_STOCK').length;
    return { totalMaterials: materials.length, availableStock: available, availableStockItems: available, lowStockItems: low, outOfStockItems: out, unresolvedAlerts };
  }

  async listMaterials(search?: string, categoryId?: string, status?: string) {
    const qb = this.materials.createQueryBuilder('m').orderBy('m.name', 'ASC');
    if (search) qb.andWhere('LOWER(m.name) LIKE :search', { search: `%${search.toLowerCase()}%` });
    if (categoryId) qb.andWhere('m.categoryId = :categoryId', { categoryId });
    if (status === 'ACTIVE') qb.andWhere('m.active = :active', { active: true });
    if (status === 'INACTIVE') qb.andWhere('m.active = :active', { active: false });
    const rows = await qb.getMany();
    const materials = await Promise.all(rows.map(async m => this.materialWithStock(m)));
    if (status && ['AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK'].includes(status)) {
      return materials.filter(m => m.stockStatus === status);
    }
    return materials;
  }

  private async materialWithStock(m: RawMaterial) {
    const stock = await this.stock.findOneBy({ materialId: m.id });
    const currentStock = Number(stock?.availableQuantity ?? m.currentStock ?? 0);
    const minimum = Number(m.minimumStockLevel || 0);
    const stockStatus = currentStock <= 0 ? 'OUT_OF_STOCK' : currentStock <= minimum ? 'LOW_STOCK' : 'AVAILABLE';
    return { ...m, currentStock, stockStatus };
  }

  async get(id: string) { const m = await this.materials.findOneBy({ id }); if (!m) throw new NotFoundException('Raw material not found'); return this.materialWithStock(m); }

  async create(dto: any, user: any) {
    if (!dto.name?.trim()) throw new BadRequestException({ field: 'name', message: 'Material Name is required' });
    if (!dto.unit?.trim()) throw new BadRequestException({ field: 'unit', message: 'Unit is required' });
    const initialStock = Number(dto.currentStock ?? 0);
    const minimumStock = Number(dto.minimumStockLevel ?? 0);
    const purchasePrice = Number(dto.purchasePrice ?? 0);
    if (!Number.isFinite(initialStock) || initialStock < 0) throw new BadRequestException({ field: 'currentStock', message: 'Initial Stock must be zero or greater' });
    if (!Number.isFinite(minimumStock) || minimumStock < 0) throw new BadRequestException({ field: 'minimumStockLevel', message: 'Minimum Stock Level must be zero or greater' });
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) throw new BadRequestException({ field: 'purchasePrice', message: 'Purchase Price must be zero or greater' });
    const category = dto.categoryId ? await this.categories.findOneBy({ id: dto.categoryId }) : null;
    if (dto.supplierName?.trim()) await this.upsertSupplier(dto.supplierName.trim());
    const m = await this.materials.save(this.materials.create({ ...dto, name: dto.name.trim(), sku: null, unit: dto.unit.trim(), minimumStockLevel: minimumStock, purchasePrice, categoryName: category?.name || dto.categoryName || null, currentStock: initialStock })) as unknown as RawMaterial;
    await this.rememberSuggestion(category?.id || dto.categoryId || null, category?.name || dto.categoryName || null, dto.name.trim());
    await this.stock.save(this.stock.create({ materialId: m.id, availableQuantity: initialStock }));
    if (initialStock > 0) await this.transactions.save(this.transactions.create({ materialId: m.id, operationType: 'IN', quantity: initialStock, previousStock: 0, updatedStock: initialStock, purchasePrice: Number(dto.purchasePrice || 0), supplierName: dto.supplierName || null, remarks: 'Opening stock', performedBy: user?.name || user?.username || 'UNKNOWN' }));
    await this.refreshAlerts();
    return this.materialWithStock(m);
  }

  async update(id: string, dto: any) {
    const m = await this.materials.findOneBy({ id }); if (!m) throw new NotFoundException('Raw material not found');
    const category = dto.categoryId ? await this.categories.findOneBy({ id: dto.categoryId }) : null;
    const allowed = ['name','categoryId','categoryName','imagePath','unit','minimumStockLevel','purchasePrice','supplierName','storageLocation','active'];
    for (const key of allowed) if (dto[key] !== undefined) (m as any)[key] = dto[key];
    if (category) m.categoryName = category.name;
    if (dto.supplierName?.trim()) await this.upsertSupplier(dto.supplierName.trim());
    await this.materials.save(m); await this.rememberSuggestion(category?.id || dto.categoryId || m.categoryId, category?.name || m.categoryName, m.name); await this.refreshAlerts(); return this.get(id);
  }
  async remove(id: string) {
    const m = await this.materials.findOneBy({ id }); if (!m) throw new NotFoundException('Raw material not found');
    await this.transactions.delete({ materialId: id }); await this.batchRepo.delete({ materialId: id }); await this.materials.remove(m); await this.stock.delete({ materialId: id }); await this.alerts.delete({ materialId: id });
    return { success: true };
  }

  async operate(id: string, operation: 'IN'|'OUT', dto: any, user: any) {
    if (!dto.idempotencyKey?.trim()) throw new BadRequestException('Transaction reference is required');
    if (await this.transactions.findOneBy({ idempotencyKey: dto.idempotencyKey.trim() })) throw new ConflictException('Duplicate transaction rejected');
    const quantity = Number(dto.quantity); if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException('Quantity must be greater than zero');
    if (operation === 'OUT' && !dto.reason?.trim()) throw new BadRequestException('Stock OUT reason is required');
    return this.ds.transaction(async manager => {
      const m = await manager.findOne(RawMaterial, { where: { id } }); if (!m) throw new NotFoundException('Raw material not found');
      let s = await manager.findOne(MaterialStock, { where: { materialId: id } }); if (!s) s = await manager.save(manager.create(MaterialStock, { materialId: id, availableQuantity: 0 }));
      const previous = Number(s.availableQuantity || 0); const updated = operation === 'IN' ? previous + quantity : previous - quantity;
      if (operation === 'OUT' && updated < 0) throw new BadRequestException('Insufficient stock: operation would create negative inventory');
      s.availableQuantity = Number(updated.toFixed(3)); await manager.save(s); m.currentStock = Number(updated.toFixed(3)); await manager.save(m);
      if (dto.supplierName?.trim()) await this.upsertSupplier(dto.supplierName.trim());
      await manager.save(manager.create(KitchenStockTransaction, { materialId: id, operationType: operation, quantity, previousStock: previous, updatedStock: updated, purchasePrice: operation === 'IN' ? Number(dto.purchasePrice || m.purchasePrice || 0) : 0, supplierName: operation === 'IN' ? dto.supplierName || m.supplierName || null : null, reason: operation === 'OUT' ? dto.reason || null : null, remarks: dto.remarks || null, idempotencyKey: dto.idempotencyKey.trim(), performedBy: user?.name || user?.username || user?.id || 'UNKNOWN' }));
      if (operation === 'IN' && dto.batchCode) await manager.save(manager.create(MaterialBatch, { materialId: id, batchCode: dto.batchCode, quantity, supplierName: dto.supplierName || m.supplierName || null }));
    }).then(async () => { await this.refreshAlerts(); return this.get(id); });
  }

  async refreshAlerts() {
    await this.alerts.update({ alertType: 'EXPIRING_SOON' }, { resolved: true });
    await this.alerts.update({ alertType: 'EXPIRED' }, { resolved: true });
    const list = await this.listMaterials();
    for (const m of list) {
      const alertType = m.stockStatus === 'OUT_OF_STOCK' ? 'OUT_OF_STOCK' : m.stockStatus === 'LOW_STOCK' ? 'LOW_STOCK' : null;
      if (!alertType) { await this.alerts.update({ materialId: m.id, resolved: false }, { resolved: true }); continue; }
      await this.alerts.update({ materialId: m.id, alertType: alertType === 'OUT_OF_STOCK' ? 'LOW_STOCK' : 'OUT_OF_STOCK', resolved: false }, { resolved: true });
      const unresolved = await this.alerts.findOneBy({ materialId: m.id, alertType, resolved: false });
      if (!unresolved) await this.alerts.save(this.alerts.create({ materialId: m.id, materialName: m.name, alertType, availableQuantity: Number(m.currentStock), minimumStockLevel: Number(m.minimumStockLevel), resolved: false }));
      else { unresolved.availableQuantity = Number(m.currentStock); unresolved.minimumStockLevel = Number(m.minimumStockLevel); await this.alerts.save(unresolved); }
    }
  }

  async alertsList(resolved = false) { return this.alerts.find({ where: { resolved }, order: { createdAt: 'DESC' } }); }
  async resolveAlert(id: string, user: any) { const alert = await this.alerts.findOneBy({ id }); if (!alert) throw new NotFoundException('Alert not found'); alert.resolved = true; alert.resolvedBy = user?.username || user?.name || 'UNKNOWN'; await this.alerts.save(alert); return alert; }
  async history(filters: any = {}) { const qb = this.transactions.createQueryBuilder('t').leftJoinAndMapOne('t.materialRelation','raw_materials','m','m.id = t.materialId').orderBy('t.performedAt','DESC'); if (filters.operationType) qb.andWhere('t.operationType = :operationType',{operationType:filters.operationType}); if (filters.materialId) qb.andWhere('t.materialId = :materialId',{materialId:filters.materialId}); if (filters.user) qb.andWhere('LOWER(t.performedBy) LIKE :user',{user:`%${String(filters.user).toLowerCase()}%`}); if (filters.search) qb.andWhere('(LOWER(COALESCE(t.reason, \'\')) LIKE :search OR LOWER(COALESCE(t.remarks, \'\')) LIKE :search OR LOWER(COALESCE(t.supplierName, \'\')) LIKE :search)',{search:`%${String(filters.search).toLowerCase()}%`}); if (filters.from) qb.andWhere('t.performedAt >= :from',{from:new Date(filters.from)}); if (filters.to){const end=new Date(filters.to);end.setDate(end.getDate()+1);qb.andWhere('t.performedAt < :to',{to:end});} const rows=await qb.getMany(); return Promise.all(rows.map(async r=>({ ...r, material: await this.materials.findOneBy({id:r.materialId}) }))); }
  async batches(materialId?: string) { const where:any=materialId?{materialId}:{}; return this.batchRepo.find({where,order:{receivedAt:'DESC'}}); }
  async categoriesList() { await this.seedCategories(); return this.categories.find({where:{active:true},order:{name:'ASC'}}); }
  async suppliersList() { return this.suppliers.find({order:{name:'ASC'}}); }
  private async upsertSupplier(name:string){ if (!await this.suppliers.findOneBy({name})) await this.suppliers.save(this.suppliers.create({name})); }
}
