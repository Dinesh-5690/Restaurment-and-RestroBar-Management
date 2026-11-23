import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TablesModule } from './tables/tables.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { ApprovalModule } from './approval/approval.module';
import { QrModule } from './qr/qr.module';
import { EventsModule } from './events/events.module';
import { KioskModule } from './kiosk/kiosk.module';
import { PrinterSettingsModule } from './printer-settings/printer-settings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ExpensesModule } from './expenses/expenses.module';
import { CouponsModule } from './coupons/coupons.module';
import { ReservationsModule } from './reservations/reservations.module';
import { AttendanceModule } from './attendance/attendance.module';
import { Expense } from './expenses/entities/expense.entity';
import { Coupon } from './coupons/entities/coupon.entity';
import { Reservation } from './reservations/entities/reservation.entity';
import { Attendance } from './attendance/entities/attendance.entity';
import { BeverageCategory } from './beverages/entities/beverage-category.entity';
import { BeverageProduct } from './beverages/entities/beverage-product.entity';
import { BeverageInventory } from './beverages/entities/beverage-inventory.entity';
import { BeverageStockTransaction } from './beverages/entities/beverage-stock-transaction.entity';
import { BeveragesModule } from './beverages/beverages.module';
import { BottleManagementModule } from './bottle-management/bottle-management.module';
import { Bottle } from './bottle-management/entities/bottle.entity';
import { BottleQRCode } from './bottle-management/entities/bottle-qr-code.entity';
import { BottleMovementLog } from './bottle-management/entities/bottle-movement-log.entity';
import { TasmacVerificationLog } from './bottle-management/entities/tasmac-verification-log.entity';
import { KitchenInventoryModule } from './kitchen-inventory/kitchen-inventory.module';
import { RawMaterial } from './kitchen-inventory/entities/raw-material.entity';
import { MaterialStock } from './kitchen-inventory/entities/material-stock.entity';
import { KitchenStockTransaction } from './kitchen-inventory/entities/stock-transaction.entity';
import { InventoryAlert } from './kitchen-inventory/entities/inventory-alert.entity';
import { MaterialBatch } from './kitchen-inventory/entities/material-batch.entity';
import { MaterialCategory } from './kitchen-inventory/entities/material-category.entity';
import { Supplier } from './kitchen-inventory/entities/supplier.entity';
import { MaterialSuggestion } from './kitchen-inventory/entities/material-suggestion.entity';

import { User } from './users/entities/user.entity';
import { Table } from './tables/entities/table.entity';
import { MenuCategory } from './menu/entities/menu-category.entity';
import { MenuItem } from './menu/entities/menu-item.entity';
import { KitchenStation } from './menu/entities/kitchen-station.entity';
import { ExtraAddon } from './menu/entities/extra-addon.entity';
import { CategoryAddon } from './menu/entities/category-addon.entity';
import { ItemAddon } from './menu/entities/item-addon.entity';
import { Order } from './orders/entities/order.entity';
import { OrderItem } from './orders/entities/order-item.entity';
import { OrderItemAddon } from './orders/entities/order-item-addon.entity';
import { KitchenBatch } from './kitchen/entities/kitchen-batch.entity';
import { KitchenBatchItem } from './kitchen/entities/kitchen-batch-item.entity';
import { PrinterSettings } from './printer-settings/entities/printer-settings.entity';
import { OrderItemApprovalHistory } from './approval/entities/order-item-approval-history.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const dbType = cfg.get('DB_TYPE', 'sqljs');

        if (dbType === 'mysql') {
          return {
            type: 'mysql',
            host: cfg.get('DB_HOST', 'localhost'),
            port: cfg.get<number>('DB_PORT', 3306),
            username: cfg.get('DB_USER', 'root'),
            password: cfg.get('DB_PASS', ''),
            database: cfg.get('DB_NAME', 'restaurant_db'),
            entities: [
              User, Table, MenuCategory, MenuItem, KitchenStation,
              ExtraAddon, CategoryAddon, ItemAddon, OrderItemApprovalHistory,
              Order, OrderItem, OrderItemAddon, KitchenBatch, KitchenBatchItem,
              PrinterSettings, Expense, Coupon, Reservation, Attendance,
              BeverageCategory, BeverageProduct, BeverageInventory, BeverageStockTransaction,
              Bottle, BottleQRCode, BottleMovementLog, TasmacVerificationLog, RawMaterial, MaterialStock, KitchenStockTransaction, InventoryAlert, MaterialBatch, MaterialCategory, Supplier, MaterialSuggestion,
            ],
            synchronize: true,   // auto-creates/updates tables
            logging: false,
            charset: 'utf8mb4',
          } as any;
        }

        if (dbType === 'postgres') {
          const databaseUrl = cfg.get<string>('DATABASE_URL');
          const dbSynchronize = cfg.get<string>('DB_SYNCHRONIZE') === undefined
            ? cfg.get('NODE_ENV', 'development') !== 'production'
            : cfg.get<string>('DB_SYNCHRONIZE') === 'true';
          return {
            type: 'postgres',
            ...(databaseUrl
              ? { url: databaseUrl }
              : {
                  host: cfg.get('DB_HOST', 'localhost'),
                  port: cfg.get<number>('DB_PORT', 5432),
                  username: cfg.get('DB_USER', 'postgres'),
                  password: cfg.get('DB_PASS', 'postgres'),
                  database: cfg.get('DB_NAME', 'restaurant_db'),
                }),
            ssl: cfg.get<string>('DB_SSL') === 'true' ? true : undefined,
            entities: [
              User, Table, MenuCategory, MenuItem, KitchenStation,
              ExtraAddon, CategoryAddon, ItemAddon, OrderItemApprovalHistory,
              Order, OrderItem, OrderItemAddon, KitchenBatch, KitchenBatchItem,
              PrinterSettings, Expense, Coupon, Reservation, Attendance,
              BeverageCategory, BeverageProduct, BeverageInventory, BeverageStockTransaction,
              Bottle, BottleQRCode, BottleMovementLog, TasmacVerificationLog, RawMaterial, MaterialStock, KitchenStockTransaction, InventoryAlert, MaterialBatch, MaterialCategory, Supplier, MaterialSuggestion,
            ],
            synchronize: dbSynchronize,
            logging: false,
          } as any;
        }

        // Default: sql.js (pure WASM SQLite, works without native build tools)
        return {
          type: 'sqljs',
          location: cfg.get('SQLITE_PATH', 'restaurant.db'),
          autoSave: true,
          synchronize: true,
          logging: false,
          entities: [
            User, Table, MenuCategory, MenuItem, KitchenStation,
            ExtraAddon, CategoryAddon, ItemAddon, OrderItemApprovalHistory,
            Order, OrderItem, OrderItemAddon, KitchenBatch, KitchenBatchItem,
            PrinterSettings, Expense, Coupon, Reservation, Attendance,
            BeverageCategory, BeverageProduct, BeverageInventory, BeverageStockTransaction,
            Bottle, BottleQRCode, BottleMovementLog, TasmacVerificationLog, RawMaterial, MaterialStock, KitchenStockTransaction, InventoryAlert, MaterialBatch, MaterialCategory, Supplier, MaterialSuggestion,
          ],
        } as any;
      },
    }),

    AuthModule,
    UsersModule,
    TablesModule,
    MenuModule,
    OrdersModule,
    KitchenModule,
    ApprovalModule,
    QrModule,
    EventsModule,
    KioskModule,
    PrinterSettingsModule,
    DashboardModule,
    ExpensesModule,
    CouponsModule,
    ReservationsModule,
    AttendanceModule,
    BeveragesModule,
    BottleManagementModule,
    KitchenInventoryModule,
  ],
})
export class AppModule {}
