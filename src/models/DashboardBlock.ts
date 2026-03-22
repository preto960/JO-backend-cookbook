import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum BlockType {
  TABLE = 'table',
  CHART = 'chart',
  LIST = 'list',
  METRIC = 'metric'
}

export enum ChartType {
  LINE = 'line',
  BAR = 'bar',
  PIE = 'pie',
  DOUGHNUT = 'doughnut',
  AREA = 'area'
}

@Entity('dashboard_blocks')
export class DashboardBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({
    type: 'enum',
    enum: BlockType
  })
  type: BlockType;

  @Column({
    type: 'enum',
    enum: ChartType,
    nullable: true
  })
  chartType?: ChartType; // Only for chart blocks

  @Column()
  endpoint: string; // URL endpoint to fetch data

  @Column({ type: 'int', default: 12 })
  columns: number; // Grid columns (1-12, Bootstrap/Tailwind style)

  @Column({ type: 'int', default: 0 })
  order: number; // Display order

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'json', nullable: true })
  config?: Record<string, any>; // Additional configuration like table headers, chart options, etc.

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}









