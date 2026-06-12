CREATE TABLE IF NOT EXISTS "achievements" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"unlocked_at" timestamp with time zone NOT NULL,
	"icon" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "doctor_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"text" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"for_question" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "doctor_visits" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"date" date NOT NULL,
	"what_doctor_said" text NOT NULL,
	"indications" jsonb NOT NULL,
	"next_appointment" date
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "emergency_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"relation" text NOT NULL,
	"is_caregiver_user" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "insights" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"pattern" text NOT NULL,
	"confidence" text NOT NULL,
	"based_on_count" integer NOT NULL,
	"text" text NOT NULL,
	"chart_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "logs" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"type" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"edited_at" timestamp with time zone,
	"source" text NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"is_offline_capture" boolean DEFAULT false NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "medications" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"name" text NOT NULL,
	"dose" text NOT NULL,
	"frequency" text NOT NULL,
	"schedule" jsonb NOT NULL,
	"adherence_log" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "persons" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"relation" text NOT NULL,
	"color" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_prefs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"prefs" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "doctor_notes" ADD CONSTRAINT "doctor_notes_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "doctor_visits" ADD CONSTRAINT "doctor_visits_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "insights" ADD CONSTRAINT "insights_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "logs" ADD CONSTRAINT "logs_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medications" ADD CONSTRAINT "medications_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "persons" ADD CONSTRAINT "persons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_prefs" ADD CONSTRAINT "user_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
