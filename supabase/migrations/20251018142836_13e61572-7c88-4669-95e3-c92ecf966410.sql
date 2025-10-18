-- 1. Criar/Atualizar trigger para novos usuários receberem trial de 7 dias automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_trial_for_new_user();

-- 2. Dar trial de 7 dias para TODOS os usuários existentes (a partir de hoje)
INSERT INTO public.user_subscriptions (user_id, status, trial_active, trial_ends_at, created_at, updated_at)
SELECT 
  au.id,
  'trial',
  true,
  NOW() + INTERVAL '7 days',
  NOW(),
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_subscriptions us WHERE us.user_id = au.id
)
ON CONFLICT (user_id) DO UPDATE
SET 
  trial_active = true,
  trial_ends_at = NOW() + INTERVAL '7 days',
  status = 'trial',
  updated_at = NOW();