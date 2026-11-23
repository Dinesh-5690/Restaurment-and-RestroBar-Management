import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BeverageCategory } from './entities/beverage-category.entity';
import { BeverageProduct } from './entities/beverage-product.entity';
import { BeverageInventory } from './entities/beverage-inventory.entity';
import { BeverageStockTransaction } from './entities/beverage-stock-transaction.entity';
import { BeveragesService } from './beverages.service';
import { BeveragesController } from './beverages.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BeverageCategory, BeverageProduct, BeverageInventory, BeverageStockTransaction])],
  providers: [BeveragesService],
  controllers: [BeveragesController],
  exports: [BeveragesService],
})
export class BeveragesModule {}
