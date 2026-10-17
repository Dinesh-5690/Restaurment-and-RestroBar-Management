import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MenuCategory } from './entities/menu-category.entity';
import { MenuItem } from './entities/menu-item.entity';
import { KitchenStation } from './entities/kitchen-station.entity';
import { ExtraAddon } from './entities/extra-addon.entity';
import { CategoryAddon } from './entities/category-addon.entity';
import { ItemAddon } from './entities/item-addon.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';
import { CreateItemDto, UpdateItemDto } from './dto/create-item.dto';
import { CreateStationDto, UpdateStationDto } from './dto/create-station.dto';
import { CreateAddonDto, UpdateAddonDto } from './dto/addon.dto';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuCategory)
    private readonly categoryRepo: Repository<MenuCategory>,
    @InjectRepository(MenuItem)
    private readonly itemRepo: Repository<MenuItem>,
    @InjectRepository(KitchenStation)
    private readonly stationRepo: Repository<KitchenStation>,
    @InjectRepository(ExtraAddon)
    private readonly addonRepo: Repository<ExtraAddon>,
    @InjectRepository(CategoryAddon)
    private readonly categoryAddonRepo: Repository<CategoryAddon>,
    @InjectRepository(ItemAddon)
    private readonly itemAddonRepo: Repository<ItemAddon>,
  ) {}

  // ---------- Stations ----------
  async createStation(dto: CreateStationDto): Promise<KitchenStation> {
    const station = this.stationRepo.create({
      ...dto,
      name: dto.name.trim().toUpperCase(),
    });
    return this.stationRepo.save(station);
  }

  async findAllStations(): Promise<KitchenStation[]> {
    // Load kitchen stations from the database only.
    return this.stationRepo.find({ order: { sequence: 'ASC', name: 'ASC' } });
  }

  async findStation(id: string): Promise<KitchenStation> {
    const station = await this.stationRepo.findOne({ where: { id } });
    if (!station) throw new NotFoundException('Station not found');
    return station;
  }

  async updateStation(id: string, dto: UpdateStationDto): Promise<KitchenStation> {
    const station = await this.findStation(id);
    Object.assign(station, {
      ...dto,
      name: dto.name ? dto.name.trim().toUpperCase() : station.name,
    });
    return this.stationRepo.save(station);
  }

  async removeStation(id: string): Promise<void> {
    const station = await this.findStation(id);
    const inUse = await this.categoryRepo.count({ where: { kitchenStation: station.name } });
    if (inUse > 0) {
      throw new BadRequestException('Station is used by one or more categories');
    }
    await this.stationRepo.remove(station);
  }

  // ---------- Add-ons ----------
  async createAddon(dto: CreateAddonDto): Promise<ExtraAddon> {
    const addon = this.addonRepo.create({
      ...dto,
      name: dto.name.trim(),
    });
    return this.addonRepo.save(addon);
  }

  async findAllAddons(): Promise<ExtraAddon[]> {
    return this.addonRepo.find({ order: { name: 'ASC' } });
  }

  async findAddon(id: string): Promise<ExtraAddon> {
    const addon = await this.addonRepo.findOne({ where: { id } });
    if (!addon) throw new NotFoundException('Add-on not found');
    return addon;
  }

  async updateAddon(id: string, dto: UpdateAddonDto): Promise<ExtraAddon> {
    const addon = await this.findAddon(id);
    Object.assign(addon, {
      ...dto,
      name: dto.name ? dto.name.trim() : addon.name,
    });
    return this.addonRepo.save(addon);
  }

  async removeAddon(id: string): Promise<void> {
    const addon = await this.findAddon(id);
    await this.categoryAddonRepo.delete({ addonId: id });
    await this.itemAddonRepo.delete({ addonId: id });
    await this.addonRepo.remove(addon);
  }

  async getCategoryAddonIds(categoryId: string): Promise<string[]> {
    await this.findCategory(categoryId);
    const mappings = await this.categoryAddonRepo.find({ where: { categoryId } });
    return mappings.map((mapping) => mapping.addonId);
  }

  async setCategoryAddons(categoryId: string, addonIds: string[]): Promise<string[]> {
    await this.findCategory(categoryId);
    const dedupedIds = [...new Set(addonIds || [])];

    if (dedupedIds.length > 0) {
      const addons = await this.addonRepo.find({ where: { id: In(dedupedIds) } });
      if (addons.length !== dedupedIds.length) {
        throw new BadRequestException('One or more add-ons are invalid');
      }
    }

    await this.categoryAddonRepo.delete({ categoryId });
    if (dedupedIds.length === 0) return [];

    const rows = dedupedIds.map((addonId) => this.categoryAddonRepo.create({ categoryId, addonId }));
    await this.categoryAddonRepo.save(rows);
    return dedupedIds;
  }

  async getItemAddonIds(itemId: string): Promise<string[]> {
    await this.findItem(itemId);
    const mappings = await this.itemAddonRepo.find({ where: { itemId } });
    return mappings.map((mapping) => mapping.addonId);
  }

  async setItemAddons(itemId: string, addonIds: string[]): Promise<string[]> {
    await this.findItem(itemId);
    const dedupedIds = [...new Set(addonIds || [])];

    if (dedupedIds.length > 0) {
      const addons = await this.addonRepo.find({ where: { id: In(dedupedIds) } });
      if (addons.length !== dedupedIds.length) {
        throw new BadRequestException('One or more add-ons are invalid');
      }
    }

    await this.itemAddonRepo.delete({ itemId });
    if (dedupedIds.length === 0) return [];

    const rows = dedupedIds.map((addonId) => this.itemAddonRepo.create({ itemId, addonId }));
    await this.itemAddonRepo.save(rows);
    return dedupedIds;
  }

  async getAvailableAddOnsForItem(itemId: string): Promise<ExtraAddon[]> {
    const item = await this.findItem(itemId);
    const [categoryMappings, itemMappings] = await Promise.all([
      this.categoryAddonRepo.find({ where: { categoryId: item.categoryId } }),
      this.itemAddonRepo.find({ where: { itemId } }),
    ]);

    const addonIds = [...new Set([
      ...categoryMappings.map((mapping) => mapping.addonId),
      ...itemMappings.map((mapping) => mapping.addonId),
    ])];

    if (addonIds.length === 0) return [];
    return this.addonRepo.find({
      where: { id: In(addonIds), isActive: true },
      order: { name: 'ASC' },
    });
  }

  // ---------- Categories ----------
  async createCategory(dto: CreateCategoryDto): Promise<MenuCategory> {
    const cat = this.categoryRepo.create(dto);
    return this.categoryRepo.save(cat);
  }

  async findAllCategories(): Promise<MenuCategory[]> {
    return this.categoryRepo.find({ order: { sequence: 'ASC', name: 'ASC' } });
  }

  async findCategory(id: string): Promise<MenuCategory> {
    const cat = await this.categoryRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<MenuCategory> {
    const cat = await this.findCategory(id);
    Object.assign(cat, dto);
    return this.categoryRepo.save(cat);
  }

  async removeCategory(id: string): Promise<void> {
    const cat = await this.findCategory(id);
    await this.categoryRepo.remove(cat);
  }

  // ---------- Items ----------
  async createItem(dto: CreateItemDto): Promise<MenuItem> {
    await this.findCategory(dto.categoryId);
    const item = this.itemRepo.create(dto);
    return this.itemRepo.save(item);
  }

  async findAllItems(categoryId?: string): Promise<MenuItem[]> {
    const where = categoryId ? { categoryId } : {};
    return this.itemRepo.find({ where, order: { name: 'ASC' } });
  }

  async findItem(id: string): Promise<MenuItem> {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }

  async updateItem(id: string, dto: UpdateItemDto): Promise<MenuItem> {
    const item = await this.findItem(id);
    Object.assign(item, dto);
    return this.itemRepo.save(item);
  }

  async toggleAvailability(id: string): Promise<MenuItem> {
    const item = await this.findItem(id);
    item.isAvailable = !item.isAvailable;
    return this.itemRepo.save(item);
  }

  async removeItem(id: string): Promise<void> {
    const item = await this.findItem(id);
    await this.itemRepo.remove(item);
  }

  async getFullMenu(): Promise<{ category: MenuCategory; items: MenuItem[] }[]> {
    const categories = await this.findAllCategories();
    const result = await Promise.all(
      categories.map(async (category) => {
        const categoryItems = await this.findAllItems(category.id);
        const itemsWithAddOns = await Promise.all(
          categoryItems.map(async (item) => ({
            ...item,
            availableAddOns: await this.getAvailableAddOnsForItem(item.id),
          })),
        );
        return {
          category,
          items: itemsWithAddOns as MenuItem[],
        };
      }),
    );
    return result.filter((r) => r.items.length > 0 || true);
  }
}
