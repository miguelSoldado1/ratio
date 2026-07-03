DO $$
DECLARE
	review_row record;
	code text;
	bytes bytea;
	byte_index integer;
	byte_value integer;
	alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
BEGIN
	FOR review_row IN SELECT "id" FROM "review" WHERE "share_code" IS NULL LOOP
		LOOP
			code := '';

			WHILE length(code) < 10 LOOP
				bytes := gen_random_bytes(10);

				FOR byte_index IN 0..(length(bytes) - 1) LOOP
					byte_value := get_byte(bytes, byte_index);

					IF byte_value < 232 THEN
						code := code || substr(alphabet, (byte_value % length(alphabet)) + 1, 1);

						IF length(code) = 10 THEN
							EXIT;
						END IF;
					END IF;
				END LOOP;
			END LOOP;

			IF NOT EXISTS (SELECT 1 FROM "review" WHERE "share_code" = code) THEN
				UPDATE "review" SET "share_code" = code WHERE "id" = review_row."id";
				EXIT;
			END IF;
		END LOOP;
	END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "review" ALTER COLUMN "share_code" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_share_code_unique_idx" ON "review" USING btree ("share_code");