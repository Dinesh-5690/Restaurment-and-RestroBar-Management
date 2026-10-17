import { Module } from '@nestjs/common';
import { KioskController } from './kiosk.controller';
import { KioskService } from './kiosk.service';
import { MenuModule } from '../menu/menu.module';
import { TablesModule } from '../tables/tables.module';
import { OrdersModule } from '../orders/orders.module';
import { KitchenModule } from '../kitchen/kitchen.module';

@Module({
  imports: [MenuModule, TablesModule, OrdersModule, KitchenModule],
  controllers: [KioskController],
  providers: [KioskService],
})
export class KioskModule {}
