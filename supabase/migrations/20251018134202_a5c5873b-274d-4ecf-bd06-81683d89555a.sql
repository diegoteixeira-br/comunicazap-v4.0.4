-- Adicionar campos de teste grátis na tabela user_subscriptions
ALTER TABLE public.user_subscriptions 
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_active BOOLEAN DEFAULT false;

-- Função para criar trial automático quando usuário se cadastra
CREATE OR REPLACE FUNCTION public.create_trial_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir trial de 7 dias para novo usuário
  INSERT INTO public.user_subscriptions (
    user_id,
    status,
    trial_active,
    trial_ends_at,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    'trial',
    true,
    NOW() + INTERVAL '7 days',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Trigger para criar trial automaticamente ao criar usuário
DROP TRIGGER IF EXISTS on_auth_user_created_trial ON auth.users;
CREATE TRIGGER on_auth_user_created_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.create_trial_for_new_user();

-- Função para verificar se usuário tem acesso (trial ativo ou assinatura ativa)
CREATE OR REPLACE FUNCTION public.user_has_access(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions
    WHERE user_id = check_user_id
      AND (
        (status = 'active' AND current_period_end > NOW())
        OR
        (trial_active = true AND trial_ends_at > NOW())
      )
  )
$$;