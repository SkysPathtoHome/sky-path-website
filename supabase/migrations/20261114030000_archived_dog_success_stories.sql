-- Archived dogs keep their success stories.
--
-- Archiving a dog (Admin > Dogs > Archive) only moves it off the main admin
-- list. Whether its success story shows on the website is decided on
-- Admin > Success Stories (success_story_status), so the public may read an
-- archived dog's row when -- and only when -- its story is published.
-- Archived dogs with no published story stay private, as before.

alter policy "dogs_public_read" on public.dogs
  using (
    is_visible
    and (
      status in ('incoming', 'published', 'pending', 'adopted')
      or (
        status = 'archived'
        and success_story_status = 'published'
        and success_story is not null
      )
    )
  );
