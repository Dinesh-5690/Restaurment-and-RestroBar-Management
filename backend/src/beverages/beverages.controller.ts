import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BeveragesService } from './beverages.service';

@Controller('beverages')
@UseGuards(JwtAuthGuard)
export class BeveragesController {
  constructor(private service: BeveragesService) {}
  @Get('categories') categories() { return this.service.categoriesList(); }
  @Post('categories') createCategory(@Body() dto: any) { return this.service.createCategory(dto); }
  @Patch('categories/:id') updateCategory(@Param('id') id: string, @Body() dto: any) { return this.service.updateCategory(id, dto); }
  @Delete('categories/:id') removeCategory(@Param('id') id: string) { return this.service.removeCategory(id); }
  @Get('products') products(@Query('search') search?: string) { return this.service.listProducts(search); }
  @Get('products/:id') product(@Param('id') id: string) { return this.service.getProduct(id); }
  @Post('products') createProduct(@Body() dto: any) { return this.service.createProduct(dto); }
  @Patch('products/:id') updateProduct(@Param('id') id: string, @Body() dto: any) { return this.service.updateProduct(id, dto); }
  @Delete('products/:id') removeProduct(@Param('id') id: string) { return this.service.removeProduct(id); }
  @Post('products/:id/stock-adjustment') adjust(@Param('id') id: string, @Body() dto: { quantityMl: number; referenceId?: string }) { return this.service.adjustStock(id, Number(dto.quantityMl), dto.referenceId); }
  @Get('stock/transactions') transactions(@Query('beverageId') beverageId?: string) { return this.service.transactionHistory(beverageId); }
}
