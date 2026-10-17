import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { PrinterSettingsService } from './printer-settings.service';
import { PrinterSettings } from './entities/printer-settings.entity';
import { UpdatePrinterSettingsDto } from './dto/update-printer-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@Controller('printer-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrinterSettingsController {
  constructor(private printerSettingsService: PrinterSettingsService) {}

  @Get()
  async getSettings(): Promise<PrinterSettings> {
    return await this.printerSettingsService.getSettings();
  }

  @Put()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateSettings(
    @Body() dto: UpdatePrinterSettingsDto,
  ): Promise<PrinterSettings> {
    return await this.printerSettingsService.updateSettings(dto);
  }
}
