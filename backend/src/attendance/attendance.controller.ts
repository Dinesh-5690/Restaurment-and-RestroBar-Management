import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import {
  CheckInDto,
  CheckOutDto,
  ManualAttendanceDto,
  UpdateAttendanceDto,
} from './dto/attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AttendanceStatus } from './entities/attendance.entity';
import { UserRole } from '../common/enums';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  checkIn(@Request() req, @Body() dto: CheckInDto) {
    return this.attendanceService.checkIn(req.user, dto.note);
  }

  @Post('check-out')
  checkOut(@Request() req, @Body() dto: CheckOutDto) {
    return this.attendanceService.checkOut(req.user, dto.note);
  }

  @Get('today/me')
  myToday(@Request() req) {
    return this.attendanceService.getMyToday(req.user);
  }

  @Get('summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  summary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
  ) {
    return this.attendanceService.summary({ from, to, userId });
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: AttendanceStatus | 'ALL',
    @Query('search') search?: string,
  ) {
    return this.attendanceService.list({ from, to, userId, status, search });
  }

  @Post('manual')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  createManual(@Body() dto: ManualAttendanceDto, @Request() req) {
    return this.attendanceService.createManual(dto, req.user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateAttendanceDto, @Request() req) {
    return this.attendanceService.update(id, dto, req.user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string) {
    return this.attendanceService.remove(id);
  }
}
