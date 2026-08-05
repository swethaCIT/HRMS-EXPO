import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ResponseStatus {
  PENDING = 'Pending',
  ACCEPTED = 'Accepted',
  DECLINED = 'Declined',
  TENTATIVE = 'Tentative',
}

@Entity('event_participants')
@Index(['eventId', 'employeeId'], { unique: true })
export class EventParticipant {
  @PrimaryGeneratedColumn('uuid')
  participantId: string;

  @Index()
  @Column({ type: 'uuid' })
  eventId: string;

  @Index()
  @Column({ type: 'uuid' })
  employeeId: string;

  @Column({
    type: 'enum',
    enum: ResponseStatus,
    default: ResponseStatus.PENDING,
  })
  responseStatus: ResponseStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date | null;
}
