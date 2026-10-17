import { Module } from '@nestjs/common';
import { QrService } from './qr.service';
import { QrController } from './qr.controller';
import { TablesModule } from '../tables/tables.module';
import { MenuModule } from '../menu/menu.module';

@Module({
  imports: [TablesModule, MenuModule],
  providers: [QrService],
  controllers: [QrController],
  exports: [QrService],
})
export class QrModule {}
