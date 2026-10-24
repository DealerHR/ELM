/*
  # Course completion is decided by the database

  Until now the browser worked out whether a course was complete and wrote the
  course-level progress row and the assignment status itself. Two things went
  wrong in practice: a course could end up with two course-level rows (one from
  "Start", one from the first module), and the stale row won on reload; and a
  course with every module done could stay "in progress" forever.

  From here on:
  - learning_progress has one course-level row per (assignment, course) and one
    module-level row per (assignment, module). Duplicates are merged.
  - Whenever a module row is inserted or updated, refresh_course_progress()
    recomputes the course row: percentage, status, completed_at. A course is
    complete when every mandatory module is done, or every module if none is
    mandatory (the same rule the player uses).
  - The assignment status follows: a course assignment completes with its
    course; a learning-path assignment completes when every course in the path
    has a completed course row (or an L&D certification) for that assignment.
  - Existing data is backfilled through the same function.
*/

-- 1. Merge duplicate rows -------------------------------------------------------

-- Course-level duplicates: keep the "best" row (completed first, then latest), delete the rest.
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY assignment_id, course_id
    ORDER BY (status = 'completed') DESC, progress_percentage DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC
  ) AS rn
  FROM learning_progress WHERE module_id IS NULL AND course_id IS NOT NULL
)
DELETE FROM learning_progress WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Module-level duplicates: same idea.
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY assignment_id, module_id
    ORDER BY (status = 'completed') DESC, completed_at DESC NULLS LAST, created_at DESC
  ) AS rn
  FROM learning_progress WHERE module_id IS NOT NULL
)
DELETE FROM learning_progress WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_progress_course_row
  ON learning_progress(assignment_id, course_id) WHERE module_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_progress_module_row
  ON learning_progress(assignment_id, module_id) WHERE module_id IS NOT NULL;

-- Module rows should always carry their course; fill any that do not.
UPDATE learning_progress lp SET course_id = m.course_id
FROM learning_modules m WHERE lp.module_id = m.id AND lp.course_id IS NULL;

-- 2. The recompute -------------------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_course_progress(p_assignment uuid, p_course uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid;
  v_path uuid;
  v_total integer;
  v_required integer;
  v_required_done integer;
  v_done integer;
  v_complete boolean;
  v_pct integer;
  v_existing uuid;
  v_already_completed_at timestamptz;
BEGIN
  SELECT employee_id, learning_path_id INTO v_emp, v_path FROM employee_learning_assignments WHERE id = p_assignment;
  IF v_emp IS NULL OR p_course IS NULL THEN RETURN; END IF;

  SELECT count(*), count(*) FILTER (WHERE is_mandatory) INTO v_total, v_required FROM learning_modules WHERE course_id = p_course;

  SELECT count(*),
         count(*) FILTER (WHERE m.is_mandatory)
    INTO v_done, v_required_done
  FROM learning_progress lp JOIN learning_modules m ON m.id = lp.module_id
  WHERE lp.assignment_id = p_assignment AND m.course_id = p_course AND lp.status = 'completed';

  -- Same rule as the player: all mandatory modules, or all modules if none is mandatory.
  v_complete := v_total > 0 AND (
    (v_required > 0 AND v_required_done >= v_required) OR (v_required = 0 AND v_done >= v_total)
  );
  v_pct := CASE WHEN v_complete THEN 100 WHEN v_total = 0 THEN 0 ELSE LEAST(99, round(100.0 * v_done / v_total)) END;

  SELECT id, completed_at INTO v_existing, v_already_completed_at
  FROM learning_progress WHERE assignment_id = p_assignment AND course_id = p_course AND module_id IS NULL;

  IF v_existing IS NULL THEN
    IF v_done = 0 THEN RETURN; END IF; -- nothing has happened yet; "Start" creates the row itself
    INSERT INTO learning_progress (assignment_id, employee_id, course_id, module_id, started_at, progress_percentage, status, completed_at, attempts)
    VALUES (p_assignment, v_emp, p_course, NULL, now(), v_pct, CASE WHEN v_complete THEN 'completed' ELSE 'in_progress' END, CASE WHEN v_complete THEN now() END, 1);
  ELSE
    -- Never downgrade a course that L&D or an earlier rule already completed.
    UPDATE learning_progress
    SET progress_percentage = GREATEST(progress_percentage, v_pct),
        status = CASE WHEN v_complete OR status = 'completed' THEN 'completed' ELSE 'in_progress' END,
        completed_at = CASE WHEN v_complete OR status = 'completed' THEN COALESCE(v_already_completed_at, now()) ELSE completed_at END
    WHERE id = v_existing;
  END IF;

  -- Assignment status follows.
  IF v_path IS NULL THEN
    IF v_complete THEN
      UPDATE employee_learning_assignments SET status = 'completed' WHERE id = p_assignment AND status <> 'completed';
    ELSE
      UPDATE employee_learning_assignments SET status = 'in_progress' WHERE id = p_assignment AND status = 'assigned';
    END IF;
  ELSE
    UPDATE employee_learning_assignments SET status = 'in_progress' WHERE id = p_assignment AND status = 'assigned';
    IF NOT EXISTS (
      SELECT 1 FROM learning_path_items pi
      WHERE pi.path_id = v_path
        AND NOT EXISTS (SELECT 1 FROM learning_progress lp WHERE lp.assignment_id = p_assignment AND lp.course_id = pi.course_id AND lp.module_id IS NULL AND lp.status = 'completed')
        AND NOT EXISTS (SELECT 1 FROM ld_certifications c WHERE c.employee_id = v_emp AND c.course_id = pi.course_id)
    ) THEN
      UPDATE employee_learning_assignments SET status = 'completed' WHERE id = p_assignment AND status <> 'completed';
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION trg_refresh_course_progress()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_course uuid;
BEGIN
  IF NEW.module_id IS NULL THEN RETURN NULL; END IF;
  v_course := NEW.course_id;
  IF v_course IS NULL THEN SELECT course_id INTO v_course FROM learning_modules WHERE id = NEW.module_id; END IF;
  PERFORM refresh_course_progress(NEW.assignment_id, v_course);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_learning_progress_course ON learning_progress;
CREATE TRIGGER trg_learning_progress_course
  AFTER INSERT OR UPDATE OF status ON learning_progress
  FOR EACH ROW EXECUTE FUNCTION trg_refresh_course_progress();

-- An L&D certification can finish a path too.
CREATE OR REPLACE FUNCTION trg_cert_refresh_course_progress()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_course_progress(NEW.assignment_id, NEW.course_id);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_ld_certifications_progress ON ld_certifications;
CREATE TRIGGER trg_ld_certifications_progress
  AFTER INSERT ON ld_certifications
  FOR EACH ROW EXECUTE FUNCTION trg_cert_refresh_course_progress();

-- 3. Backfill every (assignment, course) that has module progress -----------------

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT lp.assignment_id, COALESCE(lp.course_id, m.course_id) AS course_id
    FROM learning_progress lp LEFT JOIN learning_modules m ON m.id = lp.module_id
    WHERE lp.module_id IS NOT NULL
  LOOP
    PERFORM refresh_course_progress(r.assignment_id, r.course_id);
  END LOOP;
END $$;
