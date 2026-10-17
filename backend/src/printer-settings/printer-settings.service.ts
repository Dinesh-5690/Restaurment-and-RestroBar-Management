import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrinterSettings, ReceiptElementKey, ReceiptAlignment, ReceiptElementPosition } from './entities/printer-settings.entity';
import { UpdatePrinterSettingsDto } from './dto/update-printer-settings.dto';

@Injectable()
export class PrinterSettingsService {
  constructor(
    @InjectRepository(PrinterSettings)
    private printerSettingsRepository: Repository<PrinterSettings>,
  ) {}

  async getSettings(): Promise<PrinterSettings> {
    // There should only be one settings record
    let settings = await this.printerSettingsRepository.findOne({
      where: {},
    });

    // If no settings exist, create default ones
    if (!settings) {
      settings = await this.createDefaultSettings();
    }

    return settings;
  }

  async updateSettings(dto: UpdatePrinterSettingsDto): Promise<PrinterSettings> {
    let settings = await this.getSettings();

    // Update fields
    Object.assign(settings, dto);

    return await this.printerSettingsRepository.save(settings);
  }

  private async createDefaultSettings(): Promise<PrinterSettings> {
    const defaultSettings = this.printerSettingsRepository.create({
      name: 'Your Restaurant',
      logoUrl: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      postalCode: '',
      phone: '',
      email: '',
      receiptWidthMm: 87,
      headerHeightPx: 160,
      logoSizePx: 40,
      elementOrder: ['logo', 'name', 'address', 'contact'],
      elementAlignments: {
        logo: 'left',
        name: 'center',
        address: 'center',
        contact: 'center',
      } as Record<ReceiptElementKey, ReceiptAlignment>,
      elementPositions: {
        logo: { x: 5, y: 6 },
        name: { x: 50, y: 54 },
        address: { x: 50, y: 83 },
        contact: { x: 50, y: 115 },
      } as Record<ReceiptElementKey, ReceiptElementPosition>,
    });

    return await this.printerSettingsRepository.save(defaultSettings);
  }
}
