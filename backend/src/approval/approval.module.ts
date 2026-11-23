import { Module } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { ApprovalController } from './approval.controller';
import { OrdersModule } from '../orders/orders.module';
import { BeveragesModule } from '../beverages/beverages.module';
import { KitchenModule } from '../kitchen/kitchen.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItemApprovalHistory } from './entities/order-item-approval-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OrderItemApprovalHistory]), OrdersModule, BeveragesModule, KitchenModule],
  providers: [ApprovalService],
  controllers: [ApprovalController],
  exports: [ApprovalService],
})
export class ApprovalModule {}
