CREATE TABLE "profile_pinned_review" (
	"user_id" text NOT NULL,
	"review_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profile_pinned_review_user_review_pk" PRIMARY KEY("user_id","review_id")
);
--> statement-breakpoint
ALTER TABLE "profile_pinned_review" ADD CONSTRAINT "profile_pinned_review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_pinned_review" ADD CONSTRAINT "profile_pinned_review_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;