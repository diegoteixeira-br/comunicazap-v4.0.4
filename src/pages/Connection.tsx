import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, QrCode, Trash2, RefreshCw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { evolutionApi, getInstanceName, clearInstanceName } from "@/lib/evolutionApi";

const Connection = () => {
  const navigate = useNavigate();
  const [qrCode, setQrCode] = useState<string>("");
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [isLoading, setIsLoading] = useState(false);
  const instanceName = getInstanceName();

  useEffect(() => {
    checkConnectionStatus();
    const interval = setInterval(checkConnectionStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const response = await evolutionApi.getInstanceStatus(instanceName);
      if (response.instance.status === "open") {
        setStatus("connected");
        setQrCode("");
      } else {
        setStatus("disconnected");
      }
    } catch (error) {
      console.error("Erro ao verificar status:", error);
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setStatus("connecting");
    
    try {
      await evolutionApi.createInstance(instanceName);
      const qrResponse = await evolutionApi.getQRCode(instanceName);
      
      if (qrResponse.base64) {
        setQrCode(qrResponse.base64);
        toast.success("QR Code gerado! Escaneie com seu WhatsApp.");
      }
    } catch (error) {
      console.error("Erro ao conectar:", error);
      toast.error("Erro ao gerar QR Code. Tente novamente.");
      setStatus("disconnected");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    
    try {
      await evolutionApi.deleteInstance(instanceName);
      clearInstanceName();
      setQrCode("");
      setStatus("disconnected");
      toast.success("Conexão removida com sucesso!");
    } catch (error) {
      console.error("Erro ao desconectar:", error);
      toast.error("Erro ao remover conexão.");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-500">✅ Conectado</Badge>;
      case "connecting":
        return <Badge className="bg-yellow-500">🔄 Conectando...</Badge>;
      default:
        return <Badge variant="destructive">❌ Desconectado</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-8">
      <div className="container max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Minha Conexão WhatsApp</CardTitle>
            <CardDescription>
              Gerencie a conexão do seu número com o sistema de disparos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Status da Conexão</p>
                <p className="font-medium">{instanceName}</p>
              </div>
              {getStatusBadge()}
            </div>

            {status === "connected" && (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-green-800 dark:text-green-200 font-medium">
                    ✅ Seu WhatsApp está conectado e pronto para enviar mensagens!
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <Button
                    onClick={() => navigate("/upload")}
                    className="flex-1"
                  >
                    Enviar Mensagens
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDisconnect}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {status === "disconnected" && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Conecte seu WhatsApp para começar a enviar mensagens personalizadas.
                  </p>
                </div>
                
                <Button
                  onClick={handleConnect}
                  disabled={isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Gerando QR Code...
                    </>
                  ) : (
                    <>
                      <QrCode className="mr-2 h-5 w-5" />
                      Conectar WhatsApp
                    </>
                  )}
                </Button>
              </div>
            )}

            {status === "connecting" && qrCode && (
              <div className="space-y-4">
                <div className="p-6 bg-white rounded-lg border-2 border-primary flex flex-col items-center">
                  <p className="text-sm font-medium mb-4 text-center">
                    Escaneie este QR Code com seu WhatsApp
                  </p>
                  <p className="text-xs text-muted-foreground mb-4 text-center">
                    Menu → Aparelhos conectados → Conectar aparelho
                  </p>
                  <img
                    src={qrCode}
                    alt="QR Code"
                    className="w-64 h-64"
                  />
                </div>
                
                <Button
                  variant="outline"
                  onClick={handleConnect}
                  disabled={isLoading}
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Gerar Novo QR Code
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Connection;
