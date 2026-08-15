import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * HR Onboard Notify schema: notification_templates (generic, reused by any
 * future email-template flow) + the five onboarding_* tables.
 *
 * Hand-written rather than `migration:generate`-produced: this environment's
 * `npm run typeorm` invocation (ts-node against src/data-source.ts, which
 * imports `./config/database.config.js` for `nodenext`-mode TS compilation)
 * hits an unrelated, pre-existing ts-node/Node ESM interop failure when
 * loading that datasource — confirmed present before this feature's changes.
 * The DDL below was captured via `pg_dump --schema-only` against the local
 * dev database after `nest start --watch`'s `synchronize: true` applied
 * these exact entities, so it matches byte-for-byte what `migration:generate`
 * would have produced from the same entity definitions.
 */
export class OnboardNotify1786725719518 implements MigrationInterface {
    name = 'OnboardNotify1786725719518'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // New notification types for the flows that target internal HRMS
        // users (HR on submit, department recipients on forward). The
        // candidate-facing change-request email has no NotificationType —
        // see the comment on NotificationType in notification.entity.ts.
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'onboard_submitted'`);
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'onboard_routed'`);

        await queryRunner.query(`CREATE TABLE "notification_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying NOT NULL, "subject" character varying NOT NULL, "body" text NOT NULL, "description" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_76f0fc48b8d057d2ae7f3a2848a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8984071929794bfee03a46d203" ON "notification_templates" ("key") `);

        await queryRunner.query(`CREATE TYPE "public"."onboarding_records_employeetype_enum" AS ENUM('fresher', 'experienced')`);
        await queryRunner.query(`CREATE TYPE "public"."onboarding_records_status_enum" AS ENUM('invitation_sent', 'link_opened', 'form_in_progress', 'submitted', 'hr_review', 'changes_requested', 'approved', 'forwarded', 'completed')`);
        await queryRunner.query(`CREATE TABLE "onboarding_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "onboardingRef" character varying NOT NULL, "tempName" character varying NOT NULL, "mobile" character varying NOT NULL, "email" character varying NOT NULL, "employeeType" "public"."onboarding_records_employeetype_enum" NOT NULL, "expectedJoiningDate" date, "department" character varying, "designation" character varying, "reportingManagerId" character varying, "status" "public"."onboarding_records_status_enum" NOT NULL DEFAULT 'invitation_sent', "createdById" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_eaffd10b73f0b4d117425e465c2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ab276e6542a3900ead82dcf1f2" ON "onboarding_records" ("onboardingRef") `);
        await queryRunner.query(`CREATE INDEX "IDX_6d311b25bfb1699005142006af" ON "onboarding_records" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_69fc81dea70fd6b34f3c860adb" ON "onboarding_records" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_69da3e2a6b1fca5339b805e5fc" ON "onboarding_records" ("createdById") `);

        await queryRunner.query(`CREATE TABLE "onboarding_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "onboardingId" character varying NOT NULL, "version" integer NOT NULL DEFAULT 1, "expiresAt" TIMESTAMP NOT NULL, "usedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0d4f9cc4392b0553096d84f461a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0ad3e9a952b8cd6d980c8bb1c3" ON "onboarding_tokens" ("onboardingId") `);

        await queryRunner.query(`CREATE TABLE "onboarding_form_responses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "onboardingId" character varying NOT NULL, "personalDetails" jsonb, "contactInfo" jsonb, "emergencyContact" jsonb, "education" jsonb, "bankDetails" jsonb, "employmentHistory" jsonb, "documents" jsonb NOT NULL DEFAULT '[]', "submittedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6d3742079482ca53b541e9288d6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0913640c1d428460dfcf42b25a" ON "onboarding_form_responses" ("onboardingId") `);

        await queryRunner.query(`CREATE TYPE "public"."onboarding_reviews_decision_enum" AS ENUM('approved', 'changes_requested')`);
        await queryRunner.query(`CREATE TABLE "onboarding_reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "onboardingId" character varying NOT NULL, "reviewedById" character varying NOT NULL, "decision" "public"."onboarding_reviews_decision_enum" NOT NULL, "comments" text, "reviewedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4cb6d5741c5bde055b394518456" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_00d02ee4a471ac98138a5608a3" ON "onboarding_reviews" ("onboardingId") `);

        await queryRunner.query(`CREATE TYPE "public"."onboarding_forwards_department_enum" AS ENUM('payroll', 'it', 'admin', 'manager')`);
        await queryRunner.query(`CREATE TYPE "public"."onboarding_forwards_status_enum" AS ENUM('pending', 'sent', 'failed')`);
        await queryRunner.query(`CREATE TABLE "onboarding_forwards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "onboardingId" character varying NOT NULL, "department" "public"."onboarding_forwards_department_enum" NOT NULL, "recipientUserId" character varying NOT NULL, "fieldsShared" jsonb NOT NULL, "notificationId" uuid, "status" "public"."onboarding_forwards_status_enum" NOT NULL DEFAULT 'pending', "sentAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_aa8189f4e17c29d3378f72d665e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ade3ecb2e741f7cd81c6d55a4f" ON "onboarding_forwards" ("onboardingId") `);

        // Seed the two invite templates + the change-request template. Emails
        // stay plain text (MailService.send has no HTML path) and never carry
        // form data — only a short message and the secure link.
        await queryRunner.query(`
            INSERT INTO "notification_templates" ("key", "subject", "body", "description") VALUES
            (
                'onboarding.invite.fresher',
                'Welcome to {{company}} — Complete Your Onboarding Details',
                E'Hi {{name}},\\n\\nWelcome to {{company}}! We are excited to have you join us. To get started, please complete your onboarding details using the secure link below.\\n\\n{{link}}\\n\\nThis link is personal to you — please do not share it with anyone else.\\n\\nLooking forward to having you on the team!',
                'Sent to Fresher candidates when HR creates their onboarding record'
            ),
            (
                'onboarding.invite.experienced',
                '{{company}} — Complete Your Experienced Hire Onboarding Details',
                E'Hi {{name}},\\n\\nWelcome to {{company}}. As part of your onboarding, please complete your details using the secure link below. You will also be asked to upload a few employment documents (experience certificate, relieving letter, last 3 payslips, and proof of employment), so please have these ready.\\n\\n{{link}}\\n\\nThis link is personal to you — please do not share it with anyone else.',
                'Sent to Experienced candidates when HR creates their onboarding record'
            ),
            (
                'onboarding.changes_requested',
                'Action needed: update your {{company}} onboarding details',
                E'Hi {{name}},\\n\\nHR has reviewed your onboarding submission and requested a few changes:\\n\\n{{comments}}\\n\\nPlease use the same secure link below to update your details — it is still the one from your original invite email:\\n\\n{{link}}',
                'Sent to a candidate when HR requests changes on their submission, reusing the same onboarding link'
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_ade3ecb2e741f7cd81c6d55a4f"`);
        await queryRunner.query(`DROP TABLE "onboarding_forwards"`);
        await queryRunner.query(`DROP TYPE "public"."onboarding_forwards_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."onboarding_forwards_department_enum"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_00d02ee4a471ac98138a5608a3"`);
        await queryRunner.query(`DROP TABLE "onboarding_reviews"`);
        await queryRunner.query(`DROP TYPE "public"."onboarding_reviews_decision_enum"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_0913640c1d428460dfcf42b25a"`);
        await queryRunner.query(`DROP TABLE "onboarding_form_responses"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_0ad3e9a952b8cd6d980c8bb1c3"`);
        await queryRunner.query(`DROP TABLE "onboarding_tokens"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_69da3e2a6b1fca5339b805e5fc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_69fc81dea70fd6b34f3c860adb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6d311b25bfb1699005142006af"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ab276e6542a3900ead82dcf1f2"`);
        await queryRunner.query(`DROP TABLE "onboarding_records"`);
        await queryRunner.query(`DROP TYPE "public"."onboarding_records_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."onboarding_records_employeetype_enum"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_8984071929794bfee03a46d203"`);
        await queryRunner.query(`DROP TABLE "notification_templates"`);

        // Postgres has no DROP VALUE for enum types — 'onboard_submitted' and
        // 'onboard_routed' are left in notifications_type_enum on rollback.
        // Harmless: nothing references them once this migration is reverted.
    }
}
