import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';
import { ConfigService } from '@nestjs/config';
import { Table } from './entities/table.entity';
import { CreateTableDto, UpdateTableDto } from './dto/create-table.dto';
import { TableStatus } from '../common/enums';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table)
    private readonly tableRepo: Repository<Table>,
    private readonly configService: ConfigService,
  ) {}

  private getAppUrl(providedUrl?: string): string {
    // Prioritize the environment variable, fallback to request origin, then localhost
    return this.configService.get<string>('FRONTEND_URL') || providedUrl || 'http://localhost:3000';
  }

  async create(dto: CreateTableDto, appUrl: string): Promise<Table> {
    const exists = await this.tableRepo.findOne({ where: { tableNumber: dto.tableNumber } });
    if (exists) throw new BadRequestException(`Table ${dto.tableNumber} already exists`);

    const qrCodeId = uuidv4();
    const qrUrl = `${this.getAppUrl(appUrl)}/menu/${qrCodeId}`;
    const qrImage = await QRCode.toDataURL(qrUrl);

    const table = this.tableRepo.create({
      ...dto,
      qrCodeId,
      qrCodeUrl: qrUrl,
      qrCodeImage: qrImage,
    });
    return this.tableRepo.save(table);
  }

  async findAll(): Promise<Table[]> {
    const tables = await this.tableRepo.find({ order: { tableNumber: 'ASC' } });
    const currentAppUrl = this.getAppUrl();

    // Auto-heal QR codes: If the database has a 'localhost' QR code but we are running in production, regenerate it automatically!
    let needsSave = false;
    for (const table of tables) {
      if (table.qrCodeUrl && table.qrCodeUrl.includes('localhost') && !currentAppUrl.includes('localhost')) {
        table.qrCodeUrl = `${currentAppUrl}/menu/${table.qrCodeId}`;
        table.qrCodeImage = await QRCode.toDataURL(table.qrCodeUrl);
        needsSave = true;
      }
    }
    if (needsSave) await this.tableRepo.save(tables);

    return tables;
  }

  async findOne(id: string): Promise<Table> {
    const table = await this.tableRepo.findOne({ where: { id } });
    if (!table) throw new NotFoundException('Table not found');
    return table;
  }

  async findByQrCode(qrCodeId: string): Promise<Table> {
    const table = await this.tableRepo.findOne({ where: { qrCodeId } });
    if (!table) throw new NotFoundException('QR code not linked to any table');
    return table;
  }

  async update(id: string, dto: UpdateTableDto): Promise<Table> {
    const table = await this.findOne(id);
    Object.assign(table, dto);
    return this.tableRepo.save(table);
  }

  async setOccupied(id: string, orderId: string): Promise<Table> {
    const table = await this.findOne(id);
    table.status = TableStatus.OCCUPIED;
    table.currentOrderId = orderId;
    return this.tableRepo.save(table);
  }

  async setFree(id: string): Promise<Table> {
    const table = await this.findOne(id);
    table.status = TableStatus.FREE;
    table.currentOrderId = null;
    return this.tableRepo.save(table);
  }

  async regenerateQr(id: string, appUrl: string): Promise<Table> {
    const table = await this.findOne(id);
    const qrCodeId = uuidv4();
    const qrUrl = `${this.getAppUrl(appUrl)}/menu/${qrCodeId}`;
    const qrImage = await QRCode.toDataURL(qrUrl);
    table.qrCodeId = qrCodeId;
    table.qrCodeUrl = qrUrl;
    table.qrCodeImage = qrImage;
    return this.tableRepo.save(table);
  }

  async remove(id: string): Promise<void> {
    const table = await this.findOne(id);
    await this.tableRepo.remove(table);
  }
}
