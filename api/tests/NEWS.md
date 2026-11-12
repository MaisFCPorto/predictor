# Notícias adaptadas do Hub

## Funcionamento

O cron existente das notícias corre a cada três horas. No início de cada
sincronização, automática ou manual, elimina notícias pendentes e rejeitadas
publicadas há mais de 48 horas, bem como os respetivos rascunhos. As aprovadas
são preservadas, tal como o histórico de consumo diário da IA. A limpeza corre
mesmo quando as fontes estão indisponíveis ou a geração está desligada. Uma
geração em curso só é limpa depois de expirar a sua reserva. Os feeds e a leitura
direta não voltam a importar notícias fora desta janela. Exatamente às 48 horas,
a notícia ainda é mantida até à sincronização seguinte. A migração 025 reserva
IDs crescentes: uma notícia nova não reutiliza o ID de uma eliminada, mantendo
seguras as ligações antigas e decisões de moderação de versões já removidas.

Depois de guardar as novidades, prepara até quatro resumos de notícias com
contexto suficiente. Usa a
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

O Jogo é recolhido através dos seus títulos públicos no Google Notícias,
validando o domínio do editor e uma referência explícita ao FC Porto no título.
A pesquisa usa a expressão exata "FC Porto" e os últimos dois dias; cada item
continua sujeito ao filtro local, pois o Google também pode devolver notícias
sem relação com o clube. Títulos de temas gerais ou sobre a cidade do Porto não
são suficientes. Metadados de O Jogo já importados sem esta referência são
removidos dos pendentes e rejeitados, preservando contexto revisto manualmente.

O Jornal de Notícias foi retirado a pedido do projeto: não é consultado, não
consta dos filtros e deixa de poder ser adicionado por ligação. Na sincronização
são eliminados os seus pendentes e rejeitados, mantendo publicações já aprovadas.

O Google Notícias não fornece o corpo dos artigos. A leitura pública da secção
do FC Porto e do sitemap de O Jogo devolveu HTTP 403 em 12/11/2026. Acrescentar
texto ou factos verificados no backoffice, ou fornecer futuramente um feed
autorizado. A interface distingue estes títulos de um artigo efetivamente lido;
uma página própria não remove o impedimento de acesso ao original.

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

Para O Jogo, uma falha de consulta do RSS pelo Worker pode usar o endpoint fixo do servidor do site. Ambos consultam o mesmo feed público do Google Notícias. A chave HUB_NEWS_KEY só é enviada à origem própria https://maispredictor.app e nunca ao Google. O endpoint verifica a identidade do Worker ou de um administrador, limita a fonte, o tamanho e os redirecionamentos, e não fornece artigos integrais. A antiga rota JN devolve 404. O backoffice mostra contagens e filtros por fonte, além de códigos de erro de importação.

Mantêm-se RTP, A BOLA, Record e zerozero. Dentro do mesmo dia, O Jogo tem
prioridade, seguido de Maisfutebol; datas mais recentes
continuam primeiro. A prioridade também se aplica à fila de geração. Não se
fazem novas pesquisas na SerpApi para notícias.

## Publicação

Na pasta `api`, depois de obter o código de `main`, aplicar as migrações até 025 antes do deploy:

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
proteção dos rascunhos e validação da identidade dos editores. A retenção é
verificada nos limites das 48 horas, com pendentes, rejeitadas, aprovadas,
rascunhos associados, consumo diário, reservas ativas, falhas de fontes e
reimportação por RSS ou pela secção direta do editor. Também se verificam a não
reutilização de IDs eliminados, a rejeição de decisões antigas, o filtro de
relevância de O Jogo e a remoção do Jornal de Notícias.
