# Configuração do n8n para Integração com Evolution API

## ⚠️ IMPORTANTE: Configuração de Tamanho de Upload

### Aumentar Limite de Payload no Servidor

Como o sistema envia imagens e vídeos em base64, que podem chegar a 20MB ou mais, é **OBRIGATÓRIO** aumentar o limite de tamanho de requisição no servidor onde o Evolution API está rodando.

#### Se usar Nginx:

Edite o arquivo de configuração (geralmente `/etc/nginx/nginx.conf` ou `/etc/nginx/sites-available/seu-site`):

```nginx
http {
    # Adicione esta linha dentro do bloco http ou server
    client_max_body_size 50M;
}
```

Depois reinicie o Nginx:
```bash
sudo systemctl restart nginx
```

#### Se usar Apache:

Edite o arquivo `.htaccess` ou `httpd.conf`:

```apache
# Adicione estas linhas
LimitRequestBody 52428800
# 52428800 bytes = 50MB
```

Depois reinicie o Apache:
```bash
sudo systemctl restart apache2
```

#### Se usar Docker com Evolution API:

Adicione ao `docker-compose.yml`:

```yaml
services:
  evolution:
    environment:
      - BODY_LIMIT=50mb
```

**Sem essa configuração, o servidor rejeitará uploads de imagens/vídeos maiores!**

---

## Formato do Payload Enviado pelo Sistema

O sistema envia o seguinte JSON para o webhook do n8n:

**Apenas Texto:**
```json
{
  "instanceName": "user-82af4c91-1760496491812",
  "api_key": "EDA20E00-0647-4F30-B239-0D9B5C7FC193",
  "number": "556599999999",
  "text": "Olá João, sua mensagem aqui"
}
```

**Com Imagem ou Vídeo:**
```json
{
  "instanceName": "user-82af4c91-1760496491812",
  "api_key": "EDA20E00-0647-4F30-B239-0D9B5C7FC193",
  "number": "556599999999",
  "text": "Olá João, sua mensagem aqui",
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..." (base64 completo)
}
```

**IMPORTANTE:** 
- O sistema suporta variações de mensagem! O campo `text` já vem personalizado.
- O sistema suporta imagens e vídeos até 20MB
- Quando há mídia, o campo `image` contém o arquivo em base64 (formato: `data:image/jpeg;base64,...` ou `data:video/mp4;base64,...`)
- Para envios com mídia, você precisa usar o endpoint `/message/sendMedia/` ao invés de `/message/sendText/`

## Configuração do HTTP Request no n8n

### ⚠️ RECOMENDADO: Use um Nó IF para separar Texto e Mídia

O ideal é criar um workflow com um nó IF que verifica se há imagem/vídeo:

1. **Webhook** (recebe o payload)
2. **IF** (verifica se `{{ $json.body.image }}` existe)
   - Se SIM → vai para "HTTP Request - Enviar Mídia"
   - Se NÃO → vai para "HTTP Request - Enviar Texto"

### Configuração: HTTP Request - Enviar TEXTO (quando não há imagem)

#### 1. Método
- **POST**

#### 2. URL
```
http://evolution:8080/message/sendText/{{ $json.body.instanceName }}
```

#### 3. Authentication
- **None** (usaremos header customizado)

#### 4. Headers
| Name | Value |
|------|-------|
| apikey | `{{ $json.body.api_key }}` |

#### 5. Body (JSON)
```json
{
  "number": "{{ $json.body.number }}",
  "text": "{{ $json.body.text }}"
}
```

#### 6. Options
- Body Content Type: **application/json**

---

### Configuração: HTTP Request - Enviar MÍDIA (quando há imagem/vídeo)

#### 1. Método
- **POST**

#### 2. URL
```
http://evolution:8080/message/sendMedia/{{ $json.body.instanceName }}
```

#### 3. Authentication
- **None** (usaremos header customizado)

#### 4. Headers
| Name | Value |
|------|-------|
| apikey | `{{ $json.body.api_key }}` |

#### 5. Body (JSON)

**IMPORTANTE: Extrair apenas o base64 puro da imagem!**

```json
{
  "number": "{{ $json.body.number }}",
  "mediatype": "image",
  "media": "{{ $json.body.image.split(',')[1] }}",
  "caption": "{{ $json.body.text }}"
}
```

**Explicação:**
- `mediatype`: Pode ser `"image"` ou `"video"` (use `"image"` que funciona para ambos)
- `media`: Base64 PURO (sem o prefixo `data:image/jpeg;base64,`)
- `caption`: O texto da mensagem
- `$json.body.image.split(',')[1]`: Remove o prefixo do base64

#### 6. Options
- Body Content Type: **application/json**

---

### Configuração Alternativa (SE não quiser usar IF)

Se você não quiser usar o nó IF, configure apenas um HTTP Request que sempre usa `/sendMedia/`:

```json
{
  "number": "{{ $json.body.number }}",
  "mediatype": "{{ $json.body.image ? 'image' : undefined }}",
  "media": "{{ $json.body.image ? $json.body.image.split(',')[1] : undefined }}",
  "caption": "{{ $json.body.text }}"
}
```

**ATENÇÃO:** Esta configuração pode não funcionar bem quando não há mídia. Por isso, recomendamos usar o nó IF.

## Sistema de Variações de Mensagem

### Como Funciona:

1. O usuário cria até 3 variações diferentes da mesma mensagem no frontend
2. O sistema alterna automaticamente entre as variações:
   - Cliente 1 → Variação 1
   - Cliente 2 → Variação 2
   - Cliente 3 → Variação 3
   - Cliente 4 → Variação 1 (volta ao início)
   - E assim por diante...
3. O campo `text` já chega no n8n com a variação correta e personalizada

### Por que usar variações?

- **Anti-Banimento:** Evita que o WhatsApp detecte envio da mesma mensagem repetidas vezes
- **Parece mais humano:** Cada cliente recebe uma mensagem ligeiramente diferente
- **Automático:** O sistema gerencia tudo, você só configura uma vez no n8n

## Sistema de Bloqueio (Opt-Out)

O sistema agora possui proteção contra banimento através de lista de bloqueio. Veja o arquivo `OPT_OUT_SETUP.md` para configurar o webhook que processa quando clientes pedem para sair.

## Verificação

Após configurar, teste com o seguinte payload de exemplo:

```json
{
  "instanceName": "user-test-123",
  "api_key": "sua-api-key-aqui",
  "number": "5565999999999",
  "text": "Mensagem de teste"
}
```

## Troubleshooting

### Erro 413 "Payload Too Large" ou Erro 400 com imagens/vídeos

Isso acontece quando o servidor rejeita o upload devido ao tamanho:

1. **CAUSA**: O limite de payload do servidor (Nginx/Apache) está muito baixo
2. **SOLUÇÃO**: Aumente o `client_max_body_size` (Nginx) ou `LimitRequestBody` (Apache) para pelo menos 50MB
3. Veja as instruções completas na seção "Configuração de Tamanho de Upload" no topo deste documento
4. **IMPORTANTE**: Reinicie o servidor após a mudança!

### Erro 400 "Bad Request - instance requires property 'text'"

Isso acontece quando o formato do body JSON não está correto. Verifique:

1. O formato do body está **exatamente** como especificado acima
2. Os campos `number` e `text` estão no nível correto do JSON
3. Não há campos extras ou faltando

### Erro 401 "Unauthorized"

Isso acontece quando a apikey não está correta:

1. Verifique se o header `apikey` está configurado
2. Verifique se está usando `{{ $json.body.api_key }}` corretamente
3. Confirme que a api_key no banco de dados está correta

### Teste Manual da Evolution API

Você pode testar diretamente com curl:

```bash
curl -X POST \
  http://evolution:8080/message/sendText/user-82af4c91-1760496491812 \
  -H 'apikey: EDA20E00-0647-4F30-B239-0D9B5C7FC193' \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "5565999999999",
    "text": "Teste de mensagem"
  }'
```

## Formato Alternativo (se o primeiro não funcionar)

Caso a Evolution API exija um formato diferente, tente:

```json
{
  "number": "{{ $json.body.number }}",
  "options": {
    "delay": 1200,
    "presence": "composing"
  },
  "textMessage": {
    "text": "{{ $json.body.text }}"
  }
}
```
