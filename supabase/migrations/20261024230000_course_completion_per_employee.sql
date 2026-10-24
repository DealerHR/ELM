/*
  # A course completed once is completed everywhere for that employee

  The same course can reach a learner twice: assigned on its own and inside a
  learning path. Module progress was counted per assignment, so finishing the
  course from inside the path left the standalone assignment "in progress"
  (dashboard: pending; My Learning: done).

  refresh_course_progress now counts an employee's module completions for a
  course across all their assignments, and when the course is complete it
  updates every assignment of theirs that contains it: the standalone ones
  directly, the learning paths by re-checking whether every course in the
  path is now complete. Existing data is re-evaluated.
*/

CREATE OR REPLACE FUNCTION refresh_course_progress(p_assignment uuid, p_course uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid;
  v_total integer;
  v_required integer;
  v_required_done integer;
  v_done integer;
  v_complete boolean;
  v_pct integer;
  r record;
BEGIN
  SELECT employee_id INTO v_emp FROM employee_learning_assignments WHERE id = p_assignment;
  IF v_emp IS NULL OR p_course IS NULL THEN RETURN; END IF;

  SELECT count(*), count(*) FILTER (WHERE is_mandatory) INTO v_total, v_required FROM learning_modules WHERE course_id = p_course;

  -- Module completions by this employee for this course, whichever assignment they were filed under.
  SELECT count(DISTINCT m.id), count(DISTINCT m.id) FILTER (WHERE m.is_mandatory)
    INTO v_done, v_required_done
  FROM learning_progress lp JOIN learning_modules m ON m.id = lp.module_id
  WHERE lp.employee_id = v_emp AND m.course_id = p_course AND lp.status = 'completed';

  v_complete := v_total > 0 AND (
    (v_required > 0 AND v_required_done >= v_required) OR (v_required = 0 AND v_done >= v_total)
  ) OR EXISTS (SELECT 1 FROM ld_certifications c WHERE c.employee_id = v_emp AND c.course_id = p_course);
  v_pct := CASE WHEN v_complete THEN 100 WHEN v_total = 0 THEN 0 ELSE LEAST(99, round(100.0 * v_done / v_total)) END;

  -- One course row per assignment that carries this course (directly or through a path).
  FOR r IN
    SELECT a.id, a.learning_path_id
    FROM employee_learning_assignments a
    WHERE a.employee_id = v_emp
      AND (a.course_id = p_course OR a.learning_path_id IN (SELECT path_id FROM learning_path_items WHERE course_id = p_course))
  LOOP
    IF EXISTS (SELECT 1 FROM learning_progress WHERE assignment_id = r.id AND course_id = p_course AND module_id IS NULL) THEN
      UPDATE learning_progress
      SET progress_percentage = GREATEST(progress_percentage, v_pct),
          status = CASE WHEN v_complete OR status = 'completed' THEN 'completed' ELSE 'in_progress' END,
          completed_at = CASE WHEN (v_complete OR status = 'completed') THEN COALESCE(completed_at, now()) ELSE completed_at END
      WHERE assignment_id = r.id AND course_id = p_course AND module_id IS NULL;
    ELSIF v_done > 0 OR v_complete THEN
      INSERT INTO learning_progress (assignment_id, employee_id, course_id, module_id, started_at, progress_percentage, status, completed_at, attempts)
      VALUES (r.id, v_emp, p_course, NULL, now(), v_pct, CASE WHEN v_complete THEN 'completed' ELSE 'in_progress' END, CASE WHEN v_complete THEN now() END, 1);
    END IF;

    IF r.learning_path_id IS NULL THEN
      IF v_complete THEN
        UPDATE employee_learning_assignments SET status = 'completed' WHERE id = r.id AND status <> 'completed';
      ELSIF v_done > 0 THEN
        UPDATE employee_learning_assignments SET status = 'in_progress' WHERE id = r.id AND status = 'assigned';
      END IF;
    ELSE
      IF v_done > 0 OR v_complete THEN
        UPDATE employee_learning_assignments SET status = 'in_progress' WHERE id = r.id AND status = 'assigned';
      END IF;
      -- The path completes when every course in it is complete for this employee.
      IF NOT EXISTS (
        SELECT 1 FROM learning_path_items pi
        WHERE pi.path_id = r.learning_path_id
          AND NOT EXISTS (SELECT 1 FROM learning_progress lp WHERE lp.employee_id = v_emp AND lp.course_id = pi.course_id AND lp.module_id IS NULL AND lp.status = 'completed')
          AND NOT EXISTS (SELECT 1 FROM ld_certifications c WHERE c.employee_id = v_emp AND c.course_id = pi.course_id)
      ) THEN
        UPDATE employee_learning_assignments SET status = 'completed' WHERE id = r.id AND status <> 'completed';
      END IF;
    END IF;
  END LOOP;
END $$;

-- Re-evaluate every (assignment, course) that has module progress or a completed course row.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT lp.assignment_id, COALESCE(lp.course_id, m.course_id) AS course_id
    FROM learning_progress lp LEFT JOIN learning_modules m ON m.id = lp.module_id
    WHERE COALESCE(lp.course_id, m.course_id) IS NOT NULL
  LOOP
    PERFORM refresh_course_progress(r.assignment_id, r.course_id);
  END LOOP;
END $$;
