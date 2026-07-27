CREATE TABLE "list_item" (
	"list_id" uuid NOT NULL,
	"album_id" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "list_items_list_album_pk" PRIMARY KEY("list_id","album_id"),
	CONSTRAINT "list_items_position_nonnegative_check" CHECK ("list_item"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lists_title_length_check" CHECK (char_length("list"."title") between 1 and 100 and "list"."title" ~ '[^[:space:]]'),
	CONSTRAINT "lists_description_length_check" CHECK ("list"."description" is null
        or (char_length("list"."description") between 1 and 200 and "list"."description" ~ '[^[:space:]]'))
);
--> statement-breakpoint
ALTER TABLE "list_item" ADD CONSTRAINT "list_item_list_id_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_item" ADD CONSTRAINT "list_item_album_id_album_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."album"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list" ADD CONSTRAINT "list_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "list_items_list_position_unique_idx" ON "list_item" USING btree ("list_id","position");--> statement-breakpoint
CREATE INDEX "list_items_album_id_idx" ON "list_item" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "lists_user_created_id_idx" ON "list" USING btree ("user_id","created_at","id");