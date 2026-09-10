CREATE TABLE public.reminder_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_enabled boolean NOT NULL DEFAULT false,
  daily_time time NOT NULL DEFAULT '17:00',
  month_end_email_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_settings TO authenticated;
GRANT ALL ON public.reminder_settings TO service_role;

ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reminder settings"
ON public.reminder_settings FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER reminder_settings_updated_at
BEFORE UPDATE ON public.reminder_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.reminder_email_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_for_date date NOT NULL,
  kind text NOT NULL DEFAULT 'month_end',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, sent_for_date, kind)
);

GRANT SELECT ON public.reminder_email_log TO authenticated;
GRANT ALL ON public.reminder_email_log TO service_role;

ALTER TABLE public.reminder_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own reminder email log"
ON public.reminder_email_log FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));