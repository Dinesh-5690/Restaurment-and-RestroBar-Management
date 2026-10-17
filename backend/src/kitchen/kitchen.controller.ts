import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { KitchenService } from './kitchen.service';
import { FireItemsDto } from './dto/fire-items.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('kitchen')
@UseGuards(JwtAuthGuard)
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Post('fire')
  fireItems(@Body() dto: FireItemsDto, @Request() req) {
    return this.kitchenService.fireItems(dto, req.user.id);
  }

  @Get('queue')
  getQueue(@Query('station') station?: string) {
    return this.kitchenService.getKitchenQueue(station);
  }

  @Get('batches/:orderId')
  getBatchesForOrder(@Param('orderId') orderId: string) {
    return this.kitchenService.getBatchesForOrder(orderId);
  }

  @Patch('items/:orderItemId/cooking')
  markCooking(@Param('orderItemId') orderItemId: string) {
    return this.kitchenService.markItemCooking(orderItemId);
  }

  @Patch('items/:orderItemId/ready')
  markReady(@Param('orderItemId') orderItemId: string) {
    return this.kitchenService.markItemReady(orderItemId);
  }

  @Patch('items/:orderItemId/served')
  markServed(@Param('orderItemId') orderItemId: string) {
    return this.kitchenService.markItemServed(orderItemId);
  }
}
