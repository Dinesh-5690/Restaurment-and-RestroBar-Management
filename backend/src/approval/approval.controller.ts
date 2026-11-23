import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { ApproveOrderDto, ItemReasonDto, RejectOrderDto } from './dto/approve-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { AccessRights } from '../common/decorators/access-rights.decorator';
import { UpdateApprovalItemDto } from '../orders/dto/update-approval-item.dto';

@Controller('approval')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER)
@AccessRights('APPROVAL')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get('pending')
  getPending() {
    return this.approvalService.getPendingOrders();
  }

  @Get(':orderId/history')
  itemHistory(@Param('orderId') orderId: string) {
    return this.approvalService.itemHistory(orderId);
  }

  @Patch(':orderId/items/:itemId')
  editItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateApprovalItemDto,
    @Request() req,
  ) {
    return this.approvalService.editItem(orderId, itemId, dto, req.user.id);
  }

  @Post(':orderId/items/:itemId/approve')
  approveItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Request() req,
  ) {
    return this.approvalService.approveItem(orderId, itemId, req.user.id);
  }

  @Post(':orderId/items/:itemId/reject')
  rejectItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: RejectOrderDto,
    @Request() req,
  ) {
    return this.approvalService.rejectItem(orderId, itemId, dto.reason, req.user.id);
  }

  @Delete(':orderId/items/:itemId')
  removeItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: ItemReasonDto,
    @Request() req,
  ) {
    return this.approvalService.removeItem(orderId, itemId, dto.reason, req.user.id);
  }

  @Post(':orderId/approve')
  approve(@Param('orderId') orderId: string, @Body() dto: ApproveOrderDto, @Request() req) {
    return this.approvalService.approveOrder(orderId, req.user.id);
  }

  @Post(':orderId/reject')
  reject(@Param('orderId') orderId: string, @Body() dto: RejectOrderDto, @Request() req) {
    return this.approvalService.rejectOrder(orderId, dto.reason, req.user.id);
  }

  @Post(':orderId/hold')
  hold(@Param('orderId') orderId: string) {
    return this.approvalService.holdOrder(orderId);
  }
}
