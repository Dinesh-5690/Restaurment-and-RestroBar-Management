import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, CreateOrderItemDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, OrderItemStatus, PaymentMethod, SettlementStatus, OrderType } from '../common/enums';
import { IsString, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateItemStatusDto {
  @IsEnum(OrderItemStatus)
  status: OrderItemStatus;
}

class CancelOrderDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

class CompleteOrderDto {
  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsString()
  @IsOptional()
  couponCode?: string;
}

class RefundOrderDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

class AddOrderItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

class MergeOrdersDto {
  @IsString()
  sourceOrderId: string;

  @IsString()
  destinationOrderId: string;
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // PUBLIC ROUTE - So customers scanning the QR code can place an order without logging in!
  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query('status') status?: string, @Query('type') orderType?: string) {
    return this.ordersService.findAll(status, orderType);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  findActive() {
    return this.ordersService.findActive();
  }

  @Get('active-by-table')
  @UseGuards(JwtAuthGuard)
  findActiveByTable() {
    return this.ordersService.findActiveByTable();
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  transactions(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('settlement') settlement?: SettlementStatus | 'ALL',
    @Query('orderType') orderType?: OrderType | 'ALL',
    @Query('method') method?: PaymentMethod | 'ALL',
    @Query('search') search?: string,
  ) {
    return this.ordersService.getTransactions({ from, to, settlement, orderType, method, search });
  }

  @Get('item-performance')
  @UseGuards(JwtAuthGuard)
  itemPerformance(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orderType') orderType?: OrderType | 'ALL',
    @Query('search') search?: string,
  ) {
    return this.ordersService.getItemPerformance({ from, to, orderType, search });
  }

  @Get('pending-approval')
  @UseGuards(JwtAuthGuard)
  findPendingApproval() {
    return this.ordersService.findPendingApproval();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER)
  complete(@Param('id') id: string, @Body() dto: CompleteOrderDto) {
    return this.ordersService.completeOrder(id, dto.paymentMethod, dto.couponCode);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  cancel(@Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.ordersService.cancelOrder(id, dto.reason);
  }

  @Patch(':id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  refund(@Param('id') id: string, @Body() dto: RefundOrderDto) {
    return this.ordersService.refundOrder(id, dto.reason);
  }

  @Patch('items/:itemId/status')
  @UseGuards(JwtAuthGuard)
  updateItemStatus(@Param('itemId') itemId: string, @Body() dto: UpdateItemStatusDto) {
    return this.ordersService.updateItemStatus(itemId, dto.status);
  }

  @Delete('items/:itemId')
  @UseGuards(JwtAuthGuard)
  deleteItem(@Param('itemId') itemId: string) {
    return this.ordersService.deleteItem(itemId);
  }

  @Post(':id/items')
  @UseGuards(JwtAuthGuard)
  addItems(@Param('id') id: string, @Body() dto: AddOrderItemsDto) {
    return this.ordersService.addItems(id, dto.items);
  }

  @Post('transfer')
  @UseGuards(JwtAuthGuard)
  transferOrder(@Body() dto: { orderId: string; toTableId: string }) {
    return this.ordersService.transferOrder(dto.orderId, dto.toTableId);
  }

  @Post('merge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER)
  mergeOrders(@Body() dto: MergeOrdersDto) {
    return this.ordersService.mergeOrderIntoOrder(dto.sourceOrderId, dto.destinationOrderId);
  }
}
