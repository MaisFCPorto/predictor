# Notícias adaptadas do Hub

## Funcionamento

O cron existente das notícias corre a cada três horas. Depois de guardar as
novidades, prepara até quatro resumos de notícias dos últimos três dias.
Notícias mais antigas só são resumidas por pedido explícito no backoffice. Usa a
Responses API da OpenAI, modelo `gpt-6-luna`, sem ferramentas de pesquisa e sem
armazenamento de respostas na OpenAI (`store: false`). Cada pedido tem um máximo
de 2.000 tokens de saída e usa apenas o título e até 6.000 caracteres de contexto.

A adaptação usa o corpo do artigo original ou o texto factual revisto no backoffice. As descrições RSS servem para descobrir notícias e não são usadas como corpo da notícia pela IA.
São necessários pelo menos 90 termos e 500 caracteres de contexto. O formato normal é uma notícia de 140 a 300 palavras em três a cinco parágrafos; originais breves permitem 90 a 140 palavras. A validação aceita 90 a 350 palavras e pelo menos dois parágrafos, até 4.500 caracteres. A adaptação preserva os nomes, as menções, as declarações e os exemplos relevantes presentes no original, sem inventar pormenores. Não se publicam textos integrais nem
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
de títulos não fornecem o corpo dos artigos: acrescentar factos verificados
no backoffice ou fornecer futuramente um feed autorizado com descrições. Os
pedidos diretos aos dois jornais foram novamente recusados com HTTP 403 na
mesma data. A geração por leitura automática desses artigos continua dependente
de acesso autorizado ao texto; uma página própria não remove esse impedimento.

O RSS direto do Maisfutebol foi verificado e mantém a descrição como metadado. O Record e A BOLA passam também a ter leitura dos parágrafos públicos dos artigos. As declarações e os títulos dentro do corpo são recolhidos para preservar o contexto e os nomes nos exemplos.
A secção `https://maisfutebol.iol.pt/fc-porto` também é consultada para descobrir
notícias que não aparecem no RSS geral ou não mencionam o clube no título.
Em cada sincronização são lidos até quatro artigos públicos por editor, com duas ligações por editor em simultâneo. Maisfutebol, Record e A BOLA são consultados em paralelo. O botão de adaptação de uma notícia também consegue ler a fonte diretamente antes de chamar a IA. A identidade, a data e a disponibilidade pública da notícia são confirmadas nos metadados;
o texto vem apenas dos parágrafos visíveis do corpo, até 6.000 caracteres.
Conteúdo restrito, publicidade, elementos ocultos e scripts são excluídos. As ligações e os redirecionamentos ficam limitados ao domínio de cada editor.
O contexto suficiente já guardado é reutilizado e alterações editoriais são
protegidas pela revisão. Falhas de leitura ficam em espera por seis horas no
cache da localização Cloudflare, para permitir avançar para os restantes
artigos. Estas consultas HTTP não consomem pedidos de IA nem SerpApi.

O metadado context_kind distingue descrições de feed, artigos lidos e contexto manual. A migração 024 preserva o contexto anterior como legacy. Um rascunho pode ser regenerado explicitamente, com revisão e quota diária verificadas. Notícias aprovadas nunca são regeneradas por uma mera alteração do formato.

Para O Jogo e JN, uma falha de consulta do RSS pelo Worker pode usar o endpoint fixo do servidor do site. Ambos consultam o mesmo feed público do Google Notícias. A chave HUB_NEWS_KEY só é enviada à origem própria https://maispredictor.app e nunca ao Google. O endpoint verifica a identidade do Worker ou de um administrador, limita as fontes, o tamanho e os redirecionamentos, e não fornece artigos integrais. O backoffice mostra contagens e filtros por fonte, além de códigos de erro de importação.

Mantêm-se RTP, A BOLA, Record e zerozero. Dentro do mesmo dia, O Jogo tem
prioridade, seguido de Jornal de Notícias e Maisfutebol; datas mais recentes
continuam primeiro. A prioridade também se aplica à fila de geração. Não se
fazem novas pesquisas na SerpApi para notícias.

## Publicação

Na pasta `api`, depois de obter o código de `main`, aplicar as migrações até 024 antes do deploy:

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
