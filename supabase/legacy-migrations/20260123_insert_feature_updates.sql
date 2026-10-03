insert into feature_updates (
  title,
  description,
  category,
  image_url,
  video_url,
  version,
  platform,
  priority,
  is_published,
  released_at,
  admin_view_excluded
)
values
  (
    'Guided page tutorials for key workflows',
    '- New first-visit walkthroughs on Dashboard, Client Manager, and Settings\n- Desktop spotlight highlights each component, mobile uses a step carousel\n- Tutorials re-open via the (i) icon and never auto-show again after dismissal',
    'feature',
    null,
    null,
    '2.7.0',
    'web',
    1,
    true,
    now(),
    false
  ),
  (
    'Free trial improvements + credits',
    '- Trial users receive 10 credits automatically after checkout\n- Campaigns are available during trial, Auto‑Nudge is preview-only\n- Test messages always cost 1 credit (no free-test counters)',
    'improvement',
    null,
    null,
    '2.7.0',
    'web',
    0,
    true,
    now(),
    false
  ),
  (
    'Reliability fixes for auth and signup',
    '- Chromium refresh hangs resolved by stabilizing client auth state\n- Signup no longer stalls if analytics logging fails\n- Stripe return flow now validates session status to avoid false negatives',
    'bugfix',
    null,
    null,
    '2.7.0',
    'web',
    0,
    true,
    now(),
    false
  );
