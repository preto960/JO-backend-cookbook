import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum CardDataType {
  NUMBER = 'number',
  PERCENTAGE = 'percentage',
  CURRENCY = 'currency'
}

@Entity('dashboard_cards')
export class DashboardCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  icon: string; // Lucide icon name

  @Column()
  endpoint: string; // Primary URL endpoint to fetch data

  @Column({ nullable: true })
  secondaryTitle?: string; // Secondary title for 6-column cards

  @Column({ nullable: true })
  secondaryIcon?: string; // Secondary icon for 6-column cards

  @Column({ nullable: true })
  secondaryEndpoint?: string; // Secondary endpoint for 6-column cards

  @Column({
    type: 'enum',
    enum: CardDataType,
    nullable: true
  })
  secondaryDataType?: CardDataType; // Secondary data type for 6-column cards

  @Column({
    type: 'enum',
    enum: CardDataType,
    default: CardDataType.NUMBER
  })
  dataType: CardDataType;

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 1,
    default: 3.0
  })
  columns: number; // Column span: 1.5, 3, or 6

  @Column({ type: 'int', default: 0 })
  order: number; // Display order

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'json', nullable: true })
  config?: Record<string, any>; // Additional configuration like colors, prefixes, etc.

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}





