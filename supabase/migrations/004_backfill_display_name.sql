-- Fill in display names for profiles created before 002 was applied, using
-- the name given at signup. Only touches profiles that have no name yet.
update public.profiles p
set display_name = nullif(trim(u.raw_user_meta_data->>'display_name'), '')
from auth.users u
where u.id = p.id
  and p.display_name is null
  and nullif(trim(u.raw_user_meta_data->>'display_name'), '') is not null;
