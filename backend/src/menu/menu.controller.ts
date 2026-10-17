import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Put } from '@nestjs/common';
import { MenuService } from './menu.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';
import { CreateItemDto, UpdateItemDto } from './dto/create-item.dto';
import { CreateStationDto, UpdateStationDto } from './dto/create-station.dto';
import { CreateAddonDto, SaveAddonMappingDto, UpdateAddonDto } from './dto/addon.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // ---- Public (for QR menu) ----
  @Get()
  getFullMenu() {
    return this.menuService.getFullMenu();
  }

  @Get('categories')
  listCategories() {
    return this.menuService.findAllCategories();
  }

  @Get('stations')
  listStations() {
    return this.menuService.findAllStations();
  }

  @Get('items')
  listItems(@Query('categoryId') categoryId?: string) {
    return this.menuService.findAllItems(categoryId);
  }

  @Get('items/:id')
  getItem(@Param('id') id: string) {
    return this.menuService.findItem(id);
  }

  @Get('items/:id/available-addons')
  listAvailableAddOns(@Param('id') id: string) {
    return this.menuService.getAvailableAddOnsForItem(id);
  }

  @Get('addons')
  listAddons() {
    return this.menuService.findAllAddons();
  }

  // ---- Admin / Manager only ----
  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.menuService.createCategory(dto);
  }

  @Patch('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.menuService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  removeCategory(@Param('id') id: string) {
    return this.menuService.removeCategory(id);
  }

  @Get('categories/:id/addons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  getCategoryAddons(@Param('id') id: string) {
    return this.menuService.getCategoryAddonIds(id).then((addonIds) => ({ addonIds }));
  }

  @Put('categories/:id/addons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  setCategoryAddons(@Param('id') id: string, @Body() dto: SaveAddonMappingDto) {
    return this.menuService.setCategoryAddons(id, dto.addonIds ?? []).then((addonIds) => ({ addonIds }));
  }

  @Post('stations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  createStation(@Body() dto: CreateStationDto) {
    return this.menuService.createStation(dto);
  }

  @Patch('stations/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  updateStation(@Param('id') id: string, @Body() dto: UpdateStationDto) {
    return this.menuService.updateStation(id, dto);
  }

  @Delete('stations/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  removeStation(@Param('id') id: string) {
    return this.menuService.removeStation(id);
  }

  @Post('items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  createItem(@Body() dto: CreateItemDto) {
    return this.menuService.createItem(dto);
  }

  @Patch('items/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  updateItem(@Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.menuService.updateItem(id, dto);
  }

  @Patch('items/:id/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  toggleItem(@Param('id') id: string) {
    return this.menuService.toggleAvailability(id);
  }

  @Delete('items/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  removeItem(@Param('id') id: string) {
    return this.menuService.removeItem(id);
  }

  @Get('items/:id/addons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  getItemAddons(@Param('id') id: string) {
    return this.menuService.getItemAddonIds(id).then((addonIds) => ({ addonIds }));
  }

  @Put('items/:id/addons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  setItemAddons(@Param('id') id: string, @Body() dto: SaveAddonMappingDto) {
    return this.menuService.setItemAddons(id, dto.addonIds ?? []).then((addonIds) => ({ addonIds }));
  }

  @Post('addons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  createAddon(@Body() dto: CreateAddonDto) {
    return this.menuService.createAddon(dto);
  }

  @Patch('addons/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  updateAddon(@Param('id') id: string, @Body() dto: UpdateAddonDto) {
    return this.menuService.updateAddon(id, dto);
  }

  @Delete('addons/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  removeAddon(@Param('id') id: string) {
    return this.menuService.removeAddon(id);
  }
}
