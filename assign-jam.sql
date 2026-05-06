-- Assign jam version to CYBER7 session
INSERT INTO session_jams (id, session_id, jam_version_id, is_default, order_index)
VALUES (
  'sj_cyber7_gdevelop',
  'cmnemnk31000rcqvc76co4mft',
  'cmnlp5ejk001acq10ze74zhy6',
  true,
  1
)
ON CONFLICT (session_id, jam_version_id) DO NOTHING;

-- Get first step id for this jam
-- Create progress for Alice
INSERT INTO participant_progress (id, participant_id, jam_version_id, current_step_id, completed_steps_count, total_steps_count, xp_total, started_at)
SELECT
  'prog_alice_gdevelop',
  'cmnemnk36000vcqvczerlyyjm',
  'cmnlp5ejk001acq10ze74zhy6',
  (SELECT id FROM jam_steps WHERE jam_id = 'cmnlp58od000bcq10eqs9n4l4' ORDER BY order_index ASC LIMIT 1),
  0,
  4,
  0,
  NOW()
ON CONFLICT (participant_id, jam_version_id) DO NOTHING;

-- Create progress for Max
INSERT INTO participant_progress (id, participant_id, jam_version_id, current_step_id, completed_steps_count, total_steps_count, xp_total, started_at)
SELECT
  'prog_max_gdevelop',
  'cmnemnk38000xcqvcogpzk1zi',
  'cmnlp5ejk001acq10ze74zhy6',
  (SELECT id FROM jam_steps WHERE jam_id = 'cmnlp58od000bcq10eqs9n4l4' ORDER BY order_index ASC LIMIT 1),
  0,
  4,
  0,
  NOW()
ON CONFLICT (participant_id, jam_version_id) DO NOTHING;

SELECT 'Done!' as result;
