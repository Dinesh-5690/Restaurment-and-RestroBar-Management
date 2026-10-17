import { Injectable } from '@nestjs/common';
import { TablesService } from '../tables/tables.service';
import { MenuService } from '../menu/menu.service';

@Injectable()
export class QrService {
  constructor(
    private readonly tablesService: TablesService,
    private readonly menuService: MenuService,
  ) {}

  async getTableByQrCode(qrCodeId: string) {
    return this.tablesService.findByQrCode(qrCodeId);
  }

  async getMenuForTable(qrCodeId: string) {
    const table = await this.tablesService.findByQrCode(qrCodeId);
    const menu = await this.menuService.getFullMenu();
    return {
      table: {
        id: table.id,
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        location: table.location,
      },
      menu,
    };
  }
}
