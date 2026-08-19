UPDATE "PhysicalSample"
SET "rack_number" = "location_rak",
    "box_number" = "container_box"
WHERE "rack_number" IS NULL OR "box_number" IS NULL;
