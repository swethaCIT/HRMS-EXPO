import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Replaces the signed-link token access model (onboarding_tokens) with real
 * login credentials on OnboardingRecord itself (loginId/passwordHash/
 * mustChangePassword/lastLoginAt), and adds per-section correction detail to
 * onboarding_reviews. Hand-written for the same pre-existing ts-node/Node ESM
 * CLI issue noted in 1786725719518-OnboardNotify.ts; verified the same way
 * (executed for real against a database, not just diffed).
 */
export class OnboardNotifyLoginAuth1786946952215 implements MigrationInterface {
    name = 'OnboardNotifyLoginAuth1786946952215'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Records created against the old token-link flow have no
        // loginId/passwordHash and are incompatible with the NOT NULL
        // columns below — this table only ever held pre-hire, non-final
        // data, so clearing it is safe.
        await queryRunner.query(`DELETE FROM "onboarding_forwards"`);
        await queryRunner.query(`DELETE FROM "onboarding_reviews"`);
        await queryRunner.query(`DELETE FROM "onboarding_form_responses"`);
        await queryRunner.query(`DELETE FROM "onboarding_tokens"`);
        await queryRunner.query(`DELETE FROM "onboarding_records"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_0ad3e9a952b8cd6d980c8bb1c3"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "onboarding_tokens"`);

        await queryRunner.query(`ALTER TABLE "onboarding_records" ADD "loginId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "onboarding_records" ADD "passwordHash" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "onboarding_records" ADD "mustChangePassword" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "onboarding_records" ADD "lastLoginAt" TIMESTAMP`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_onboarding_records_loginId" ON "onboarding_records" ("loginId")`);

        await queryRunner.query(`ALTER TABLE "onboarding_reviews" ADD "correctionSections" jsonb`);

        // Existing seed rows (1786725719518-OnboardNotify.ts) predate the
        // credential fields — update them in place rather than re-inserting,
        // since "key" is unique.
        await queryRunner.query(`
            UPDATE "notification_templates" SET
              "subject" = 'Welcome to {{company}} — Complete Your Onboarding Details',
              "body" = E'Hi {{name}},\\n\\nWelcome to {{company}}! You have been invited to complete your onboarding.\\n\\nOnboarding Type: Fresher\\n\\nPortal: {{link}}\\nLogin ID: {{loginId}}\\nTemporary Password: {{tempPassword}}\\n\\nPlease log in, set a new password, and complete your onboarding information.\\n\\nThis is personal to you — please do not share it with anyone else.'
            WHERE "key" = 'onboarding.invite.fresher'
        `);
        await queryRunner.query(`
            UPDATE "notification_templates" SET
              "subject" = '{{company}} — Complete Your Experienced Hire Onboarding Details',
              "body" = E'Hi {{name}},\\n\\nWelcome to {{company}}. As part of your onboarding you will be asked to provide previous employment details and upload a few employment documents (experience certificate, relieving letter, last 3 payslips, employment proof), so please have these ready.\\n\\nOnboarding Type: Experienced\\n\\nPortal: {{link}}\\nLogin ID: {{loginId}}\\nTemporary Password: {{tempPassword}}\\n\\nPlease log in, set a new password, and complete your onboarding information.\\n\\nThis is personal to you — please do not share it with anyone else.'
            WHERE "key" = 'onboarding.invite.experienced'
        `);
        await queryRunner.query(`
            UPDATE "notification_templates" SET
              "subject" = 'Action needed: update your {{company}} onboarding details',
              "body" = E'Hi {{name}},\\n\\nHR has reviewed your onboarding submission and requested corrections:\\n\\n{{comments}}\\n\\nPlease log back in to the same onboarding portal with your existing Login ID to make the correction:\\n\\nPortal: {{link}}\\nLogin ID: {{loginId}}'
            WHERE "key" = 'onboarding.changes_requested'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "onboarding_reviews" DROP COLUMN "correctionSections"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_onboarding_records_loginId"`);
        await queryRunner.query(`ALTER TABLE "onboarding_records" DROP COLUMN "lastLoginAt"`);
        await queryRunner.query(`ALTER TABLE "onboarding_records" DROP COLUMN "mustChangePassword"`);
        await queryRunner.query(`ALTER TABLE "onboarding_records" DROP COLUMN "passwordHash"`);
        await queryRunner.query(`ALTER TABLE "onboarding_records" DROP COLUMN "loginId"`);

        await queryRunner.query(`CREATE TABLE "onboarding_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "onboardingId" character varying NOT NULL, "version" integer NOT NULL DEFAULT 1, "expiresAt" TIMESTAMP NOT NULL, "usedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0d4f9cc4392b0553096d84f461a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0ad3e9a952b8cd6d980c8bb1c3" ON "onboarding_tokens" ("onboardingId")`);

        // Template text reverts are not attempted — restoring the exact
        // pre-credential fresher/experienced/changes-requested wording would
        // need to be done by hand if this migration is ever rolled back.
    }
}
