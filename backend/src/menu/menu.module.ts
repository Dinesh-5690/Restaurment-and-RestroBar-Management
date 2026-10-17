import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuCategory } from './entities/menu-category.entity';
import { MenuItem } from './entities/menu-item.entity';
import { KitchenStation } from './entities/kitchen-station.entity';
import { ExtraAddon } from './entities/extra-addon.entity';
import { CategoryAddon } from './entities/category-addon.entity';
import { ItemAddon } from './entities/item-addon.entity';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MenuCategory, MenuItem, KitchenStation, ExtraAddon, CategoryAddon, ItemAddon])],
  providers: [MenuService],
  controllers: [MenuController],
  exports: [MenuService],
})
export class MenuModule {}
