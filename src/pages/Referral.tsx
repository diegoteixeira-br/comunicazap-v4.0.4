import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Copy, Gift, Users, CheckCircle2, Clock, Share2 } from 'lucide-react';

interface Referral {
  id: string;
  referred_user_id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  referred_profile?: {
    full_name: string | null;
    email: string | null;
  };
}

const Referral = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  const referralLink = referralCode 
    ? `${window.location.origin}/auth?mode=signup&ref=${referralCode}` 
    : '';

  useEffect(() => {
    if (user) {
      loadReferralData();
    }
  }, [user]);

  const loadReferralData = async () => {
    if (!user) return;

    try {
      // Get user's profile with referral code
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // If no referral code exists, generate one
      if (!profile.referral_code) {
        const { data: newCode, error: genError } = await supabase.rpc('generate_referral_code');
        if (genError) throw genError;

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ referral_code: newCode })
          .eq('id', user.id);

        if (updateError) throw updateError;
        setReferralCode(newCode);
      } else {
        setReferralCode(profile.referral_code);
      }

      // Get referrals made by this user
      const { data: referralsData, error: referralsError } = await supabase
        .from('referrals')
        .select(`
          id,
          referred_user_id,
          status,
          created_at,
          completed_at
        `)
        .eq('referrer_user_id', user.id)
        .order('created_at', { ascending: false });

      if (referralsError) throw referralsError;

      // Get profiles for referred users
      if (referralsData && referralsData.length > 0) {
        const referredUserIds = referralsData.map(r => r.referred_user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', referredUserIds);

        if (profilesError) throw profilesError;

        const referralsWithProfiles = referralsData.map(referral => ({
          ...referral,
          referred_profile: profiles?.find(p => p.id === referral.referred_user_id) || undefined
        }));

        setReferrals(referralsWithProfiles);
      } else {
        setReferrals([]);
      }

    } catch (error: unknown) {
      console.error('Error loading referral data:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados de indicação.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copiado!',
        description: `${label} copiado para a área de transferência.`,
      });
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível copiar.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
      case 'completed':
        return <Badge variant="default" className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Assinante</Badge>;
      case 'rewarded':
        return <Badge variant="default" className="flex items-center gap-1 bg-primary"><Gift className="h-3 w-3" /> Recompensado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const rewardedCount = referrals.filter(r => r.status === 'rewarded').length;
  const pendingCount = referrals.filter(r => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Gift className="h-7 w-7 text-primary" />
              Indique e Ganhe
            </h1>
            <p className="text-muted-foreground">Convide amigos e ganhe +30 dias grátis!</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{referrals.length}</p>
                  <p className="text-sm text-muted-foreground">Total de indicações</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Gift className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{rewardedCount}</p>
                  <p className="text-sm text-muted-foreground">Recompensas ganhas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2 md:col-span-1">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-sm text-muted-foreground">Aguardando assinatura</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Referral Code Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Seu Link de Indicação
            </CardTitle>
            <CardDescription>
              Compartilhe este link com seus amigos. Quando eles assinarem, vocês dois ganham +30 dias grátis!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Seu código</label>
              <div className="flex gap-2">
                <Input 
                  value={referralCode || ''} 
                  readOnly 
                  className="font-mono text-lg tracking-wider"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(referralCode || '', 'Código')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Link de indicação</label>
              <div className="flex gap-2">
                <Input 
                  value={referralLink} 
                  readOnly 
                  className="text-sm"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(referralLink, 'Link')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How it Works */}
        <Card>
          <CardHeader>
            <CardTitle>Como funciona</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">1</div>
                <div>
                  <p className="font-medium">Compartilhe seu link</p>
                  <p className="text-sm text-muted-foreground">Envie para amigos que possam se interessar</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">2</div>
                <div>
                  <p className="font-medium">Amigo se cadastra</p>
                  <p className="text-sm text-muted-foreground">Ele cria uma conta usando seu link</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">3</div>
                <div>
                  <p className="font-medium">Vocês dois ganham</p>
                  <p className="text-sm text-muted-foreground">+30 dias grátis quando ele assinar!</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referrals List */}
        <Card>
          <CardHeader>
            <CardTitle>Suas Indicações</CardTitle>
            <CardDescription>Acompanhe o status de cada indicação feita por você</CardDescription>
          </CardHeader>
          <CardContent>
            {referrals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Você ainda não fez nenhuma indicação.</p>
                <p className="text-sm">Compartilhe seu link e comece a ganhar!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map((referral) => (
                  <div 
                    key={referral.id} 
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <Users className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {referral.referred_profile?.full_name || referral.referred_profile?.email || 'Usuário'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Indicado em {formatDate(referral.created_at)}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(referral.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Referral;
