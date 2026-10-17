import { Controller, Get, Param } from '@nestjs/common';
import { QrService } from './qr.service';

@Controller('qr')
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Get(':qrCodeId')
  getTableInfo(@Param('qrCodeId') qrCodeId: string) {
    return this.qrService.getTableByQrCode(qrCodeId);
  }

  @Get(':qrCodeId/menu')
  getMenuForTable(@Param('qrCodeId') qrCodeId: string) {
    return this.qrService.getMenuForTable(qrCodeId);
  }
}
