import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bottle } from './entities/bottle.entity';
import { BottleQRCode } from './entities/bottle-qr-code.entity';
import { BottleMovementLog } from './entities/bottle-movement-log.entity';
import { BottleManagementService } from './bottle-management.service';
import { BottleManagementController } from './bottle-management.controller';
import { BeverageProduct } from '../beverages/entities/beverage-product.entity';
import { BeverageInventory } from '../beverages/entities/beverage-inventory.entity';
import { BeverageStockTransaction } from '../beverages/entities/beverage-stock-transaction.entity';
import { TasmacVerificationLog } from './entities/tasmac-verification-log.entity';
import { TasmacVerificationService } from './tasmac-verification.service';

@Module({
  imports: [TypeOrmModule.forFeature([Bottle, BottleQRCode, BottleMovementLog, BeverageProduct, BeverageInventory, BeverageStockTransaction, TasmacVerificationLog])],
  providers: [BottleManagementService, TasmacVerificationService],
  controllers: [BottleManagementController],
  exports: [BottleManagementService],
})
export class BottleManagementModule {}
