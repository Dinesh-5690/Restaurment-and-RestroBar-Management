import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RawMaterial } from './entities/raw-material.entity';
import { MaterialStock } from './entities/material-stock.entity';
import { KitchenStockTransaction } from './entities/stock-transaction.entity';
import { InventoryAlert } from './entities/inventory-alert.entity';
import { MaterialBatch } from './entities/material-batch.entity';
import { MaterialCategory } from './entities/material-category.entity';
import { Supplier } from './entities/supplier.entity';
import { MaterialSuggestion } from './entities/material-suggestion.entity';
import { KitchenInventoryService } from './kitchen-inventory.service';
import { KitchenInventoryController } from './kitchen-inventory.controller';
@Module({ imports:[TypeOrmModule.forFeature([RawMaterial,MaterialStock,KitchenStockTransaction,InventoryAlert,MaterialBatch,MaterialCategory,Supplier,MaterialSuggestion])], providers:[KitchenInventoryService], controllers:[KitchenInventoryController], exports:[KitchenInventoryService] })
export class KitchenInventoryModule {}
