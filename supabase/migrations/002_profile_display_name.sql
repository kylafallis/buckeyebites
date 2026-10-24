-- Copy the name given at signup (auth.signUp options.data.display_name) into the profile
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(trim(new.raw_user_meta_data->>'display_name'), ''));
  return new;
end; $$;
