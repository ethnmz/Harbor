CREATE TABLE "agent_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"template_id" uuid NOT NULL,
	"config" jsonb NOT NULL,
	"created_from_patch" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heal_patches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"from_version" integer NOT NULL,
	"to_version" integer,
	"status" text DEFAULT 'proposed' NOT NULL,
	"source" text NOT NULL,
	"iteration" integer DEFAULT 1 NOT NULL,
	"parent_patch_id" uuid,
	"redteam_run_id" uuid,
	"patch" jsonb NOT NULL,
	"verification" jsonb,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redteam_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"category" text NOT NULL,
	"attack_subject" text NOT NULL,
	"attack_text" text NOT NULL,
	"expectation" text DEFAULT '' NOT NULL,
	"result" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"evidence" jsonb,
	"ticket_id" text,
	"agent_run_id" uuid,
	"origin_case_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redteam_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"agent_version" integer NOT NULL,
	"status" text DEFAULT 'generating' NOT NULL,
	"source" text DEFAULT 'generated' NOT NULL,
	"purpose" text DEFAULT 'manual' NOT NULL,
	"heal_patch_id" uuid,
	"score" integer,
	"total" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "agent_version" integer;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "sandbox" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heal_patches" ADD CONSTRAINT "heal_patches_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redteam_cases" ADD CONSTRAINT "redteam_cases_run_id_redteam_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."redteam_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redteam_runs" ADD CONSTRAINT "redteam_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_versions_agent_version_idx" ON "agent_versions" USING btree ("agent_id","version");--> statement-breakpoint
CREATE INDEX "redteam_cases_run_idx" ON "redteam_cases" USING btree ("run_id","seq");--> statement-breakpoint
CREATE INDEX "redteam_runs_agent_idx" ON "redteam_runs" USING btree ("agent_id","created_at");