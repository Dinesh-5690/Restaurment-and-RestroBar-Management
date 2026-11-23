import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AccessRights } from '../common/decorators/access-rights.decorator';
import { UserRole } from '../common/enums';
import { BottleManagementService } from './bottle-management.service';
import { TasmacVerificationService } from './tasmac-verification.service';

@Controller('bottle-management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.BEVERAGE_MANAGER)
@AccessRights('BOTTLE_MANAGEMENT')
export class BottleManagementController {
  constructor(private service: BottleManagementService, private verification: TasmacVerificationService) {}

  @Get('bottles') bottles(@Query('beverageId') beverageId?: string) { return this.service.listBottles(beverageId); }
  @Get('bottles/details/:code') details(@Param('code') code: string) { return this.service.details(decodeURIComponent(code)); }
  @Post('verify') async verify(@Body() dto: { qrIdentifier: string }, @Request() req: any) {
    const result = await this.verification.verify(dto.qrIdentifier, req.user);
    try {
      const bottle = await this.service.details(dto.qrIdentifier);
      return { ...result, bottleDetails: bottle };
    } catch {
      return { ...result, bottleDetails: null };
    }
  }
  @Post('in') stockIn(@Body() dto: { bottleCode: string; quantityMl?: number; remarks?: string; beverageId?: string; batchId?: string; bottleSizeMl?: number }, @Request() req: any) { return this.service.operate('IN', dto.bottleCode, dto.quantityMl, dto.remarks, req.user, dto); }
  @Post('out') stockOut(@Body() dto: { bottleCode: string; quantityMl?: number; remarks?: string }, @Request() req: any) { return this.service.operate('OUT', dto.bottleCode, dto.quantityMl, dto.remarks, req.user, dto); }
  @Post('scan') scan(@Body() dto: { qrIdentifier: string; operation: 'IN'|'OUT' }, @Request() req: any) { return this.service.scan(dto.qrIdentifier, dto.operation, req.user); }
  @Get('history') history(@Query('from') from?: string, @Query('to') to?: string, @Query('operationType') operationType?: string, @Query('beverageId') beverageId?: string, @Query('bottleId') bottleId?: string, @Query('performedBy') performedBy?: string) { return this.service.history({ from, to, operationType, beverageId, bottleId, performedBy }); }
}
