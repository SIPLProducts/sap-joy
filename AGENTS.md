# Project rules

- Database access rules never use `true`; shared reference data is gated by `public.is_app_user(auth.uid())` (user has a row in `user_roles`) and plant data by `public.user_has_plant(...)`, because open sign-up means "signed in" alone is not trusted.
