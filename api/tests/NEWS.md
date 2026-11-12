# Resumos editoriais do Hub

## Funcionamento

O cron existente das notícias corre a cada três horas. Depois de guardar as
novidades, prepara até quatro resumos de notícias dos últimos três dias.
Notícias mais antigas só são resumidas por pedido explícito no backoffice. Usa a
Responses API da OpenAI, modelo `gpt-6-luna`, sem ferramentas de pesquisa e sem
armazenamento de respostas na OpenAI (`store: false`). Cada pedido tem um máximo
de 1.000 tokens de saída e usa apenas o título e até 6.000 caracteres de contexto.

O contexto vem da descrição do RSS ou dos factos acrescentados no backoffice.
Um título isolado não é suficiente. O Maisfutebol também fornece contexto por
leitura dos parágrafos públicos do artigo. Não se publicam textos integrais nem
se contornam paywalls. Respostas incompletas, recusas, números ausentes do contexto
e trechos demasiado próximos da fonte ficam pendentes, sem publicação.

O limite inicial é de 30 pedidos por dia UTC. Conta também pedidos que falhem e
repetições manuais, com um máximo de três tentativas por notícia/contexto. A
configuração admite entre 1 e 100 pedidos/dia. Pedidos simultâneos usam leases e
reservas de quota transacionais. Uma resposta já guardada é reutilizada se a
gravação do rascunho falhar. Pedidos interrompidos sem resposta guardada exigem
repetição explícita para não duplicar automaticamente um possível consumo.

Nenhum resumo é publicado pela IA. Em **Notícias do hub**, abrir o painel de
resumo, verificar o contexto, editar se necessário e escolher **Publicar notícia
e resumo**. Essa ação aprova a notícia, a imagem visível e o resumo na mesma
transação. Guardar como rascunho ou retirar o resumo mantém a ligação à fonte se
a notícia continuar aprovada. Alterar o contexto retira o resumo para nova
revisão. Decisões sobre versões antigas são recusadas.

Todas as notícias aprovadas abrem `/hub/noticias/<id>`, com fonte e ligação
original. A página apresenta o resumo apenas depois da sua aprovação. Enquanto
não existir um resumo aprovado, mostra o título, a data, a fonte e uma indicação
de que o resumo não está disponível. Nunca expõe contexto nem rascunhos. As
visitas não fazem pedidos à IA. O acesso beta atual do Hub mantém-se.

## Fontes

O Jogo e Jornal de Notícias são recolhidos através dos seus títulos públicos
no Google Notícias, validando o domínio do editor em cada item. Acesso direto
aos sites e aos antigos feeds falhou na verificação de 12/11/2026. Estes feeds
de títulos não fornecem contexto para resumos: acrescentar factos verificados
no backoffice ou fornecer futuramente um feed autorizado com descrições. Os
pedidos diretos aos dois jornais foram novamente recusados com HTTP 403 na
mesma data. A geração por leitura automática desses artigos continua dependente
de acesso autorizado ao texto; uma página própria não remove esse impedimento.

O RSS direto do Maisfutebol foi verificado e mantém a descrição como contexto.
A secção `https://maisfutebol.iol.pt/fc-porto` também é consultada para descobrir
notícias que não aparecem no RSS geral ou não mencionam o clube no título.
Em cada sincronização são lidos até quatro artigos públicos, com duas ligações
em simultâneo. A identidade e a data da notícia são confirmadas nos metadados;
o texto vem apenas dos parágrafos visíveis do corpo, até 6.000 caracteres.
Conteúdo restrito, publicidade, elementos ocultos e scripts são excluídos. As
ligações e os redirecionamentos ficam limitados ao domínio do Maisfutebol.
O contexto suficiente já guardado é reutilizado e alterações editoriais são
protegidas pela revisão. Falhas de leitura ficam em espera por seis horas no
cache da localização Cloudflare, para permitir avançar para os restantes
artigos. Estas consultas HTTP não consomem pedidos de IA nem SerpApi.

Mantêm-se RTP, A BOLA, Record e zerozero. Dentro do mesmo dia, O Jogo tem
prioridade, seguido de Jornal de Notícias e Maisfutebol; datas mais recentes
continuam primeiro. A prioridade também se aplica à fila de geração. Não se
fazem novas pesquisas na SerpApi para notícias.

## Publicação

Na pasta `api`, depois de obter o código de `main`:

```sh
npx wrangler@4.55.0 d1 migrations apply predictor-db --remote --env production
npx wrangler@4.55.0 secret put OPENAI_API_KEY --env production
npx wrangler@4.55.0 deploy --env production
```

Criar uma chave de projeto na plataforma OpenAI e introduzi-la apenas no prompt
interativo do Wrangler. A API tem faturação própria; o plano ChatGPT Plus não
inclui este consumo. A chave fica como Secret do Worker, nunca no Git ou no
frontend. Sem a chave, o cron continua a recolher notícias, mas não tenta gerar
resumos. A configuração já contém:

```toml
HUB_NEWS_SUMMARIES_ENABLED = "true"
HUB_NEWS_SUMMARY_DAILY_LIMIT = "30"
```

Para suspender a geração, definir a primeira variável como `"false"` no ficheiro
de configuração e publicar. Os artigos e os resumos já aprovados continuam a
existir. A publicação do frontend na Vercel não publica o Worker.

## Validação

```sh
npm run test:news
npm run test:football
```

Os ensaios usam o Worker real em workerd, D1 descartável e respostas simuladas
para fontes e IA. Não usam chaves reais, não gastam créditos e não escrevem em
produção. Cobrem geração, edição, aprovação, retirada, credenciais em falta,
concorrência, quota diária, alterações de contexto, recuperação de falhas,
proteção dos rascunhos e validação da identidade dos editores.
