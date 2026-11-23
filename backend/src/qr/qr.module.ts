import { Module } from '@nestjs/common';
import { QrService } from './qr.service';
import { QrController } from './qr.controller';
import { TablesModule } from '../tables/tables.module';
import { MenuModule } from '../menu/menu.module';
import { BeveragesModule } from '../beverages/beverages.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [TablesModule, MenuModule, BeveragesModule, OrdersModule],
  providers: [QrService],
  controllers: [QrController],
  exports: [QrService],
})
export class QrModule {}
