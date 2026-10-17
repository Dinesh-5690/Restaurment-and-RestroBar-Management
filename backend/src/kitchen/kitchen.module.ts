import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenBatch } from './entities/kitchen-batch.entity';
import { KitchenBatchItem } from './entities/kitchen-batch-item.entity';
import { KitchenService } from './kitchen.service';
import { KitchenController } from './kitchen.controller';
import { OrdersModule } from '../orders/orders.module';
import { EventsModule } from '../events/events.module';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Table } from '../tables/entities/table.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KitchenBatch, KitchenBatchItem, OrderItem, Table]), OrdersModule, EventsModule],
  providers: [KitchenService],
  controllers: [KitchenController],
  exports: [KitchenService],
})
export class KitchenModule {}
