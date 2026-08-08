import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToOne } from 'typeorm';
import { Exclude } from 'class-transformer';

export enum UserRole {
  ADMIN = 'admin',
  HR = 'hr',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.EMPLOYEE })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  fcmToken: string;

  // Password reset (bcrypt hash of a one-time token + its expiry)
  @Column({ nullable: true })
  @Exclude()
  resetTokenHash: string;

  @Column({ type: 'timestamp', nullable: true })
  @Exclude()
  resetTokenExpires: Date;

  /** Wrong OTP guesses against the current reset token; burns it at the cap. */
  @Column({ type: 'int', default: 0 })
  @Exclude()
  resetAttempts: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Required by `UsersService.remove`, which soft-deletes. Without this column
  // TypeORM's softDelete throws MissingDeleteDateColumnError, so every attempt
  // to remove a user 500s and the account stays active. Its presence also makes
  // every ordinary find() exclude removed users automatically — including the
  // login lookup — which is the intended behaviour.
  @DeleteDateColumn()
  @Exclude()
  deletedAt: Date | null;
}
