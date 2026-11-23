import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Bottle } from './entities/bottle.entity';
import { BottleQRCode } from './entities/bottle-qr-code.entity';
import { BottleMovementLog } from './entities/bottle-movement-log.entity';
import { BeverageProduct } from '../beverages/entities/beverage-product.entity';
import { BeverageInventory } from '../beverages/entities/beverage-inventory.entity';
import { BeverageStockTransaction } from '../beverages/entities/beverage-stock-transaction.entity';
import { TasmacVerificationService } from './tasmac-verification.service';

@Injectable()
export class BottleManagementService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @InjectRepository(Bottle) private bottles: Repository<Bottle>,
    @InjectRepository(BottleQRCode) private qrCodes: Repository<BottleQRCode>,
    @InjectRepository(BottleMovementLog) private movements: Repository<BottleMovementLog>,
    private tasmacVerification: TasmacVerificationService,
  ) {}

  private parseBottleCode(raw: string) {
    const text = String(raw || '').trim(); if (!text) throw new BadRequestException('Bottle ID is required');
    if (text.length > 2048) throw new BadRequestException('Invalid or unreadable bottle QR code');
    try {
      const parsed = JSON.parse(text);
      return String(parsed.bottleCode || parsed.bottleId || parsed.qrId || parsed.identifier || parsed.code || '').trim();
    } catch {
      return text;
    }
  }

  private parsedQr(raw: string) {
    try {
      const parsed = JSON.parse(String(raw || '').trim());
      return { brand: parsed.brand || parsed.brandName || null, productName: parsed.productName || parsed.product || parsed.name || null, batchId: parsed.batchId || parsed.batch || null, bottleSizeMl: Number(parsed.bottleSizeMl || parsed.sizeMl || parsed.size || 0) || null };
    } catch { return { brand: null, productName: null, batchId: null, bottleSizeMl: null }; }
  }

  async scan(raw: string, operation: 'IN'|'OUT', user: any) {
    const code = this.parseBottleCode(raw);
    if (!code) throw new BadRequestException('Invalid or unreadable bottle QR code');

    return this.dataSource.transaction(async (manager) => {
      const qr = await manager.findOne(BottleQRCode, { where: { qrCode: code } });
      let bottle = qr ? await manager.findOne(Bottle, { where: { id: qr.bottleId } }) : await manager.findOne(Bottle, { where: { bottleCode: code } });

      if (!bottle && operation === 'OUT') throw new BadRequestException('Bottle Not Registered');

      if (!bottle && operation === 'IN') {
        const parsed = this.parsedQr(raw);
        try {
          bottle = await manager.save(manager.create(Bottle, {
            bottleCode: code,
            beverageId: null,
            brand: parsed.brand || null,
            productName: parsed.productName || null,
            batchId: parsed.batchId || 'Unknown',
            bottleSizeMl: parsed.bottleSizeMl || 0,
            authorized: true,
            status: 'IN_STOCK',
            registeredBy: user?.name || user?.username || user?.id || 'UNKNOWN',
            registeredAt: new Date(),
          }));
          await manager.save(manager.create(BottleQRCode, { bottleId: bottle.id, qrCode: code, qrData: String(raw), qrImageDataUrl: '' }));
          await manager.save(manager.create(BottleMovementLog, {
            bottleId: bottle.id,
            beverageId: null,
            operationType: 'IN',
            quantityMl: bottle.bottleSizeMl || 0,
            previousStockMl: 0,
            updatedStockMl: bottle.bottleSizeMl || 0,
            previousStatus: 'UNREGISTERED',
            updatedStatus: 'IN_STOCK',
            performedBy: user?.name || user?.username || user?.id || 'UNKNOWN',
            remarks: 'Automatic Bottle IN registration',
          }));
          return { status: 'IN_STOCK', operation: 'IN', newlyRegistered: true, alreadyRegistered: false, ...(await this.findBottleInManager(manager, bottle)) };
        } catch (error) {
          if (error instanceof ConflictException || error?.code === 'SQLITE_CONSTRAINT' || String(error?.message || '').toLowerCase().includes('unique')) {
            const existingQr = await manager.findOne(BottleQRCode, { where: { qrCode: code } });
            bottle = existingQr ? await manager.findOne(Bottle, { where: { id: existingQr.bottleId } }) : await manager.findOne(Bottle, { where: { bottleCode: code } });
            if (!bottle) throw new ConflictException('Bottle could not be registered concurrently');
          } else throw error;
        }
      }

      if (!bottle.authorized || bottle.status === 'DEACTIVATED') throw new BadRequestException('Bottle is unauthorized or deactivated');

      const previousStatus = bottle.status;
      if (bottle.status === 'ISSUED_OUT') {
        throw new BadRequestException('Already scanned and registered — this bottle cannot be used again');
      }
      if (operation === 'IN') {
        if (bottle.status === 'IN_STOCK' || bottle.status === 'REGISTERED') {
          throw new BadRequestException('Bottle Already Registered — this QR code has already been used for Bottle IN');
        }
        throw new BadRequestException('Bottle IN is not allowed from the current status');
      } else {
        if (bottle.status !== 'IN_STOCK') throw new BadRequestException('Bottle Not Available');
      }

      bottle.status = 'ISSUED_OUT';
      await manager.save(bottle);
      await manager.save(manager.create(BottleMovementLog, {
        bottleId: bottle.id,
        beverageId: bottle.beverageId || null,
        operationType: operation,
        quantityMl: bottle.bottleSizeMl || 0,
        previousStockMl: 0,
        updatedStockMl: 0,
        previousStatus,
        updatedStatus: bottle.status,
        performedBy: user?.name || user?.username || user?.id || 'UNKNOWN',
        remarks: `Automatic Bottle ${operation}`,
      }));
      return { status: bottle.status, operation, newlyRegistered: false, alreadyRegistered: true, ...(await this.findBottleInManager(manager, bottle)) };
    });
  }

  private async findBottleInManager(manager: any, bottle: Bottle) {
    const product = bottle.beverageId ? await manager.findOne(BeverageProduct, { where: { id: bottle.beverageId } }) : null;
    const inventory = bottle.beverageId ? await manager.findOne(BeverageInventory, { where: { beverageId: bottle.beverageId } }) : null;
    const qr = await manager.findOne(BottleQRCode, { where: { bottleId: bottle.id } });
    return {
      ...bottle,
      brand: product?.brand || bottle.brand || 'Unknown',
      productName: product?.productName || bottle.productName || 'Unknown',
      bottleSizeMl: bottle.bottleSizeMl || 0,
      batchId: bottle.batchId || 'Unknown',
      imagePath: product?.imagePath || null,
      availableMl: inventory?.availableMl ?? 0,
      qr,
    };
  }

  async details(raw: string) {
    const code = this.parseBottleCode(raw);
    return this.findBottle(code, true);
  }

  private async findBottle(code: string, includeDetails = false) {
    let bottle = await this.bottles.findOne({ where: { bottleCode: code } });
    if (!bottle) { const qr = await this.qrCodes.findOneBy({ qrCode: code }); if (qr) bottle = await this.bottles.findOneBy({ id: qr.bottleId }); }
    if (!bottle && code.length >= 36) bottle = await this.bottles.findOne({ where: { id: code } });
    if (!bottle) throw new NotFoundException('Invalid or unregistered bottle QR code');
    if (!includeDetails) return bottle;
    const product = await this.dataSource.getRepository(BeverageProduct).findOneBy({ id: bottle.beverageId });
    const inventory = await this.dataSource.getRepository(BeverageInventory).findOneBy({ beverageId: bottle.beverageId });
    const qr = await this.qrCodes.findOneBy({ bottleId: bottle.id });
    return { ...bottle, brand: product?.brand || bottle.brand || 'Unknown', productName: product?.productName || bottle.productName || 'Unknown', imagePath: product?.imagePath || null, availableMl: inventory?.availableMl ?? 0, qr };
  }

  async operate(operation: 'IN' | 'OUT', raw: string, quantityMl: number | undefined, remarks: string | undefined, user: any, dto: any = {}) {
    const code = this.parseBottleCode(raw);
    return this.dataSource.transaction(async (manager) => {
      let bottle = await manager.findOne(Bottle, { where: { bottleCode: code } });
      if (!bottle) { const qr = await manager.findOne(BottleQRCode, { where: { qrCode: code } }); if (qr) bottle = await manager.findOne(Bottle, { where: { id: qr.bottleId } }); }
      if (!bottle && code.length >= 36) bottle = await manager.findOne(Bottle, { where: { id: code } });
      if (!bottle && operation === 'OUT') throw new BadRequestException('UNREGISTERED BOTTLE – Bottle IN registration required before Bottle OUT.');
      if (!bottle && operation === 'IN') {
        const beverageId = String(dto.beverageId || '').trim();
        if (!beverageId) throw new BadRequestException('Select a registered beverage product before registering this bottle');
        const product = await manager.findOne(BeverageProduct, { where: { id: beverageId } }); if (!product) throw new BadRequestException('Selected beverage product is invalid');
        const parsed = this.parsedQr(raw);
        const size = Number(dto.bottleSizeMl || parsed.bottleSizeMl || 750);
        const batchId = String(dto.batchId || parsed.batchId || `BATCH-${Date.now()}`).trim();
        bottle = await manager.save(manager.create(Bottle, { bottleCode: code, beverageId, batchId, bottleSizeMl: size, authorized: true, status: 'REGISTERED', registeredBy: user?.name || user?.username || user?.id || 'UNKNOWN', registeredAt: new Date() }));
        await manager.save(manager.create(BottleQRCode, { bottleId: bottle.id, qrCode: code, qrData: String(raw), qrImageDataUrl: '' }));
      }
      if (!bottle) throw new BadRequestException('Invalid or unreadable bottle QR code');
      if (!bottle.authorized || bottle.status === 'DEACTIVATED') throw new BadRequestException('Bottle is unauthorized or deactivated');
      if (bottle.status === 'ISSUED_OUT') throw new BadRequestException('Already scanned and registered — this bottle cannot be used again');
      if (operation === 'IN' && ['REGISTERED', 'IN_STOCK'].includes(bottle.status)) throw new BadRequestException('Bottle Already Registered — this QR code has already been used for Bottle IN');
      if (operation === 'OUT' && !['REGISTERED', 'IN_STOCK'].includes(bottle.status)) throw new BadRequestException('Bottle Not Available');

      const movementQuantityMl = Number(quantityMl ?? bottle.bottleSizeMl ?? 0);
      if (!Number.isFinite(movementQuantityMl) || movementQuantityMl <= 0) throw new BadRequestException('Quantity must be greater than zero');
      if (movementQuantityMl > bottle.bottleSizeMl) throw new BadRequestException(`Quantity cannot exceed the bottle size of ${bottle.bottleSizeMl}ml`);

      let inventory = await manager.findOne(BeverageInventory, { where: { beverageId: bottle.beverageId } });
      if (!inventory) inventory = await manager.save(manager.create(BeverageInventory, { beverageId: bottle.beverageId, availableMl: 0, lowStockThreshold: 0 }));
      const previousStockMl = Number(inventory.availableMl);
      const updatedStockMl = operation === 'IN' ? previousStockMl + movementQuantityMl : previousStockMl - movementQuantityMl;
      if (operation === 'OUT' && updatedStockMl < 0) throw new BadRequestException('Insufficient beverage inventory for this quantity');

      inventory.availableMl = Number(updatedStockMl.toFixed(3));
      await manager.save(inventory);
      bottle.status = operation === 'IN' ? 'IN_STOCK' : 'ISSUED_OUT';
      await manager.save(bottle);
      const product = await manager.findOne(BeverageProduct, { where: { id: bottle.beverageId } });
      await manager.save(manager.create(BeverageStockTransaction, { beverageId: bottle.beverageId, quantityMl: operation === 'IN' ? movementQuantityMl : -movementQuantityMl, transactionType: operation === 'IN' ? 'RESTOCK' : 'ADJUSTMENT', referenceId: `${operation}:${bottle.bottleCode}` }));
      await manager.save(manager.create(BottleMovementLog, { bottleId: bottle.id, beverageId: bottle.beverageId, operationType: operation, quantityMl: movementQuantityMl, previousStockMl, updatedStockMl, performedBy: user?.name || user?.username || user?.id || 'UNKNOWN', remarks }));
      return { bottle: { ...bottle, brand: product?.brand, productName: product?.productName }, inventory: { beverageId: bottle.beverageId, previousStockMl, availableMl: inventory.availableMl } };
    });
  }

  async listBottles(beverageId?: string) {
    const where: any = beverageId ? { beverageId } : {};
    const bottles = await this.bottles.find({ where, order: { createdAt: 'DESC' } });
    return Promise.all(bottles.map(async (b) => { const product = await this.dataSource.getRepository(BeverageProduct).findOneBy({ id: b.beverageId }); const qr = await this.qrCodes.findOneBy({ bottleId: b.id }); return { ...b, brand: product?.brand, productName: product?.productName, qrImageDataUrl: qr?.qrImageDataUrl }; }));
  }

  async history(filters: { from?: string; to?: string; operationType?: string; beverageId?: string; bottleId?: string; performedBy?: string } = {}) {
    const qb = this.movements.createQueryBuilder('m').orderBy('m.performedAt', 'DESC');
    if (filters.operationType) qb.andWhere('m.operationType = :operationType', { operationType: filters.operationType });
    if (filters.beverageId) qb.andWhere('m.beverageId = :beverageId', { beverageId: filters.beverageId });
    if (filters.bottleId) qb.andWhere('m.bottleId = :bottleId', { bottleId: filters.bottleId });
    if (filters.performedBy) qb.andWhere('LOWER(m.performedBy) LIKE :performedBy', { performedBy: `%${filters.performedBy.toLowerCase()}%` });
    if (filters.from) qb.andWhere('m.performedAt >= :from', { from: new Date(filters.from) });
    if (filters.to) { const end = new Date(filters.to); end.setDate(end.getDate() + 1); qb.andWhere('m.performedAt < :to', { to: end }); }
    const logs = await qb.getMany();
    return Promise.all(logs.map(async (log) => { const bottle = await this.bottles.findOneBy({ id: log.bottleId }); const product = await this.dataSource.getRepository(BeverageProduct).findOneBy({ id: log.beverageId }); return { ...log, bottleCode: bottle?.bottleCode, batchId: bottle?.batchId, bottleSizeMl: bottle?.bottleSizeMl, brand: product?.brand, productName: product?.productName }; }));
  }
}
