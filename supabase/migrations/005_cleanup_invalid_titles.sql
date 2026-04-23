-- Remove job listings scraped with invalid/noise titles (nav links, UI elements, etc.)
DELETE FROM scraped_jobs
WHERE title ILIKE '%skip to main%'
   OR title ILIKE '%terms of use%'
   OR title ILIKE '%privacy notice%'
   OR title ILIKE '%Full-time employee%'
   OR title ILIKE '%Part-time employee%'
   OR title ILIKE '%gupy%s terms%'
   OR title ILIKE '%gupy%s privacy%'
   OR title ILIKE '%talent pool%'
   OR title ILIKE '%feedback badge%';
