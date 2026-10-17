import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { TablesService } from './tables.service';
import { CreateTableDto, UpdateTableDto } from './dto/create-table.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { ConfigService } from '@nestjs/config';

@Controller('tables')
@UseGuards(JwtAuthGuard)
export class TablesController {
  constructor(
    private readonly tablesService: TablesService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  findAll() {
    return this.tablesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tablesService.findOne(id);
  }

  @Get('qr/:qrCodeId')
  findByQr(@Param('qrCodeId') qrCodeId: string) {
    return this.tablesService.findByQrCode(qrCodeId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() dto: CreateTableDto, @Req() req: Request) {
    const appUrl = req.get('origin') || this.configService.get('APP_URL', 'http://localhost:3000');
    return this.tablesService.create(dto, appUrl);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateTableDto) {
    return this.tablesService.update(id, dto);
  }

  @Post(':id/regenerate-qr')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  regenerateQr(@Param('id') id: string, @Req() req: Request) {
    const appUrl = req.get('origin') || this.configService.get('APP_URL', 'http://localhost:3000');
    return this.tablesService.regenerateQr(id, appUrl);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.tablesService.remove(id);
  }
}
