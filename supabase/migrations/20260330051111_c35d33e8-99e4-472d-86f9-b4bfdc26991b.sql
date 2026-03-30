
-- Allow admins to SELECT password history (to show change dates)
CREATE POLICY "Admins can view password history"
  ON public.password_history
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to INSERT password history
CREATE POLICY "Admins can insert password history"
  ON public.password_history
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to INSERT into user_security
CREATE POLICY "Admins can insert user security"
  ON public.user_security
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to UPDATE user_security
CREATE POLICY "Admins can update user security"
  ON public.user_security
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
