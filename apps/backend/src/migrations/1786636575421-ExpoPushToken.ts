import { MigrationInterface, QueryRunner } from "typeorm";

export class ExpoPushToken1786636575421 implements MigrationInterface {
    name = 'ExpoPushToken1786636575421'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "fcmToken" TO "expoPushToken"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "expoPushToken" TO "fcmToken"`);
    }

}
