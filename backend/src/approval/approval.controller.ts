import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { ApproveOrderDto, RejectOrderDto } from './dto/approve-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@Controller('approval')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get('pending')
  getPending() {
    return this.approvalService.getPendingOrders();
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
