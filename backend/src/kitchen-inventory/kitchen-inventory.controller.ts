import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AccessRights } from '../common/decorators/access-rights.decorator';
import { UserRole } from '../common/enums';
import { KitchenInventoryService } from './kitchen-inventory.service';

@Controller('kitchen-inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN)
@AccessRights('KITCHEN_INVENTORY')
export class KitchenInventoryController {
  constructor(private service: KitchenInventoryService) {}
  @Get('dashboard') dashboard() { return this.service.dashboard(); }
  @Get('materials') list(@Query('search') search?: string,@Query('categoryId') categoryId?: string,@Query('status') status?: string) { return this.service.listMaterials(search,categoryId,status); }
  @Get('materials/:id') get(@Param('id') id: string) { return this.service.get(id); }
  @Post('materials') create(@Body() dto: any,@Request() req: any) { return this.service.create(dto,req.user); }
  @Patch('materials/:id') update(@Param('id') id: string,@Body() dto: any) { return this.service.update(id,dto); }
  @Delete('materials/:id') remove(@Param('id') id: string) { return this.service.remove(id); }
  @Post('materials/:id/in') stockIn(@Param('id') id:string,@Body() dto:any,@Request() req:any) { return this.service.operate(id,'IN',dto,req.user); }
  @Post('materials/:id/out') stockOut(@Param('id') id:string,@Body() dto:any,@Request() req:any) { return this.service.operate(id,'OUT',dto,req.user); }
  @Get('transactions') history(@Query() filters:any) { return this.service.history(filters); }
  @Get('batches') batches(@Query('materialId') materialId?:string) { return this.service.batches(materialId); }
  @Get('categories') categories() { return this.service.categoriesList(); }
  @Get('suggestions') suggestions(@Query('categoryId') categoryId?: string,@Query('search') search?: string) { return this.service.suggestionsList(categoryId, search); }
  @Get('suppliers') suppliers() { return this.service.suppliersList(); }
  @Get('alerts') alerts(@Query('resolved') resolved?:string) { return this.service.alertsList(resolved === 'true'); }
  @Patch('alerts/:id/resolve') resolveAlert(@Param('id') id:string,@Request() req:any) { return this.service.resolveAlert(id,req.user); }
}
