CREATE TABLE "audit_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"standard" text DEFAULT 'IATF 16949' NOT NULL,
	"responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capacity_studies" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_line_balance_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "changeovers" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"line" text NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_plan_items" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"characteristic" text NOT NULL,
	"specification" text,
	"control_method" text NOT NULL,
	"frequency" text NOT NULL,
	"reaction_plan" text,
	"linked_stream_id" text,
	"linked_fmea_item_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cpm_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"tasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doe_studies" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"design_type" text DEFAULT 'full' NOT NULL,
	"response_name" text DEFAULT 'Response' NOT NULL,
	"factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"runs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eight_ds" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"current_step" integer DEFAULT 1 NOT NULL,
	"disciplines" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"linked_capa_id" text,
	"linked_defect_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gage_studies" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"parts" integer DEFAULT 10 NOT NULL,
	"operators" integer DEFAULT 3 NOT NULL,
	"trials" integer DEFAULT 3 NOT NULL,
	"tolerance" double precision,
	"data" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_balances" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"available_time" double precision NOT NULL,
	"required_output" double precision NOT NULL,
	"stations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sampling_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"lot_size" integer NOT NULL,
	"aql" double precision NOT NULL,
	"sample_size" integer NOT NULL,
	"accept_num" integer NOT NULL,
	"defects_found" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skus" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"annual_demand" double precision NOT NULL,
	"order_cost" double precision NOT NULL,
	"holding_cost" double precision NOT NULL,
	"unit_cost" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_studies" ADD CONSTRAINT "capacity_studies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_studies" ADD CONSTRAINT "capacity_studies_source_line_balance_id_line_balances_id_fk" FOREIGN KEY ("source_line_balance_id") REFERENCES "public"."line_balances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changeovers" ADD CONSTRAINT "changeovers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_plan_items" ADD CONSTRAINT "control_plan_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_plan_items" ADD CONSTRAINT "control_plan_items_linked_stream_id_streams_id_fk" FOREIGN KEY ("linked_stream_id") REFERENCES "public"."streams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_plan_items" ADD CONSTRAINT "control_plan_items_linked_fmea_item_id_fmea_items_id_fk" FOREIGN KEY ("linked_fmea_item_id") REFERENCES "public"."fmea_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cpm_plans" ADD CONSTRAINT "cpm_plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doe_studies" ADD CONSTRAINT "doe_studies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eight_ds" ADD CONSTRAINT "eight_ds_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eight_ds" ADD CONSTRAINT "eight_ds_linked_capa_id_capas_id_fk" FOREIGN KEY ("linked_capa_id") REFERENCES "public"."capas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gage_studies" ADD CONSTRAINT "gage_studies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_balances" ADD CONSTRAINT "line_balances_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sampling_plans" ADD CONSTRAINT "sampling_plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skus" ADD CONSTRAINT "skus_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;