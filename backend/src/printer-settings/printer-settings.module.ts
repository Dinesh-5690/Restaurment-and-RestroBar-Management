import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrinterSettings } from './entities/printer-settings.entity';
import { PrinterSettingsService } from './printer-settings.service';
import { PrinterSettingsController } from './printer-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PrinterSettings])],
  controllers: [PrinterSettingsController],
  providers: [PrinterSettingsService],
  exports: [PrinterSettingsService],
})
export class PrinterSettingsModule {}
