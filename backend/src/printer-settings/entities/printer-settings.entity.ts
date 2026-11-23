import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ReceiptElementKey = 'logo' | 'name' | 'address' | 'contact';
export type ReceiptAlignment = 'left' | 'center' | 'right';
export type ReceiptElementPosition = { x: number; y: number };
const logoTextColumnType = process.env.DB_TYPE?.toLowerCase() === 'mysql' ? 'mediumtext' : 'text';

@Entity('printer_settings')
export class PrinterSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: logoTextColumnType, nullable: true })
  logoUrl: string;

  @Column()
  addressLine1: string;

  @Column()
  addressLine2: string;

  @Column()
  city: string;

  @Column()
  postalCode: string;

  @Column()
  phone: string;

  @Column()
  email: string;

  @Column({ type: 'float', default: 87 })
  receiptWidthMm: number;

  @Column({ type: 'int', default: 160 })
  headerHeightPx: number;

  @Column({ type: 'int', default: 40 })
  logoSizePx: number;

  @Column({ type: 'simple-json' })
  elementAlignments: Record<ReceiptElementKey, ReceiptAlignment>;

  @Column({ type: 'simple-json' })
  elementPositions: Record<ReceiptElementKey, ReceiptElementPosition>;

  @Column({ type: 'simple-json' })
  elementOrder: ReceiptElementKey[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
