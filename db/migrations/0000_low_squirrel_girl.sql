CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"stream_id" text,
	"source_type" text NOT NULL,
	"source_id" text,
	"rule_code" text NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "capas" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"linked_defect_code" text,
	"status" text DEFAULT 'open' NOT NULL,
	"owner" text,
	"due_date" timestamp with time zone,
	"root_cause" text,
	"corrective_action" text,
	"preventive_action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_points" (
	"id" text PRIMARY KEY NOT NULL,
	"stream_id" text NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL,
	"computed" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"run_id" text,
	"gate_key" text NOT NULL,
	"question" text NOT NULL,
	"suggested" jsonb NOT NULL,
	"chosen" text NOT NULL,
	"rationale" text,
	"decided_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fmea_items" (
	"id" text PRIMARY KEY NOT NULL,
	"fmea_id" text NOT NULL,
	"process_step" text NOT NULL,
	"failure_mode" text NOT NULL,
	"effect" text,
	"cause" text,
	"severity" integer DEFAULT 1 NOT NULL,
	"occurrence" integer DEFAULT 1 NOT NULL,
	"detection" integer DEFAULT 1 NOT NULL,
	"rpn" integer DEFAULT 1 NOT NULL,
	"recommended_action" text,
	"action_status" text DEFAULT 'none' NOT NULL,
	"linked_defect_code" text
);
--> statement-breakpoint
CREATE TABLE "fmeas" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'PFMEA' NOT NULL,
	"rpn_action" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "non_conformances" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"defect_code" text NOT NULL,
	"process_area" text NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"severity" text DEFAULT 'minor' NOT NULL,
	"description" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playbook_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"playbook_key" text NOT NULL,
	"step_index" integer DEFAULT 0 NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"workspace_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"recurrence" text NOT NULL,
	"next_due" timestamp with time zone NOT NULL,
	"last_completed" timestamp with time zone,
	"assignee" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streams" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"unit" text,
	"subgroup_size" integer DEFAULT 1 NOT NULL,
	"spec_low" double precision,
	"spec_high" double precision,
	"target" double precision,
	"cpk_threshold" double precision DEFAULT 1.33 NOT NULL,
	"cadence" text DEFAULT 'daily' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_studies" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"personal_pct" double precision DEFAULT 5 NOT NULL,
	"fatigue_pct" double precision DEFAULT 4 NOT NULL,
	"delay_pct" double precision DEFAULT 3 NOT NULL,
	"learning_curve_pct" double precision DEFAULT 90 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_study_elements" (
	"id" text PRIMARY KEY NOT NULL,
	"study_id" text NOT NULL,
	"seq" integer NOT NULL,
	"description" text NOT NULL,
	"observations" jsonb NOT NULL,
	"rating" double precision DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"industry" text DEFAULT 'general' NOT NULL,
	"process_type" text DEFAULT 'discrete' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capas" ADD CONSTRAINT "capas_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_points" ADD CONSTRAINT "data_points_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_run_id_playbook_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."playbook_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fmea_items" ADD CONSTRAINT "fmea_items_fmea_id_fmeas_id_fk" FOREIGN KEY ("fmea_id") REFERENCES "public"."fmeas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fmeas" ADD CONSTRAINT "fmeas_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_conformances" ADD CONSTRAINT "non_conformances_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbook_runs" ADD CONSTRAINT "playbook_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streams" ADD CONSTRAINT "streams_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_studies" ADD CONSTRAINT "time_studies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_study_elements" ADD CONSTRAINT "time_study_elements_study_id_time_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."time_studies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_project_status" ON "alerts" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "dp_stream_ts" ON "data_points" USING btree ("stream_id","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_user_ws" ON "memberships" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE INDEX "nc_code" ON "non_conformances" USING btree ("project_id","defect_code","process_area");