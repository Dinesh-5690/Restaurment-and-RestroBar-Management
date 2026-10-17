import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemAddon } from './entities/order-item-addon.entity';
import { KitchenBatch } from '../kitchen/entities/kitchen-batch.entity';
import { KitchenBatchItem } from '../kitchen/entities/kitchen-batch-item.entity';
import { Coupon } from '../coupons/entities/coupon.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { MenuModule } from '../menu/menu.module';
import { TablesModule } from '../tables/tables.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderItemAddon, KitchenBatch, KitchenBatchItem, Coupon]),
    MenuModule,
    TablesModule,
    EventsModule,
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
