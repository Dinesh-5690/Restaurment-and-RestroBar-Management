import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tasmac_verification_logs')
export class TasmacVerificationLog {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() scannedIdentifier: string;

  @Column({ type: 'varchar' }) result: 'VERIFIED' | 'INVALID' | 'UNVERIFIED' | 'PENDING';

  @Column({ nullable: true }) apiReference: string;

  @Column({ nullable: true }) performedBy: string;

  @Column({ nullable: true }) bottleMovementReference: string;

  @Column({ type: 'text', nullable: true }) responseSummary: string;

  @CreateDateColumn() verifiedAt: Date;
}
