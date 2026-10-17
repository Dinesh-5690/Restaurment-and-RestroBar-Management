import { Body, Controller, Get, Post } from '@nestjs/common';
import { KioskService } from './kiosk.service';
import { KioskCheckoutDto } from './dto/kiosk-checkout.dto';

@Controller('kiosk')
export class KioskController {
  constructor(private readonly kioskService: KioskService) {}

  @Get('menu')
  getMenu() {
    return this.kioskService.getMenu();
  }

  @Get('tables')
  getTables() {
    return this.kioskService.getTables();
  }

  @Post('checkout')
  checkout(@Body() dto: KioskCheckoutDto) {
    return this.kioskService.checkout(dto);
  }
}
