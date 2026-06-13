CREATE TABLE IF NOT EXISTS "knowledge" (
	"id" text PRIMARY KEY NOT NULL,
	"topic" text NOT NULL,
	"content" text NOT NULL,
	"source" text NOT NULL,
	"source_url" text
);
