# Resumos editoriais do Hub

## Funcionamento

O cron existente das notícias corre a cada três horas. Depois de guardar as
novidades, prepara até quatro resumos de notícias dos últimos três dias.
Notícias mais antigas só são resumidas por pedido explícito no backoffice. Usa a
Responses API da OpenAI, modelo `gpt-6-luna`, sem ferramentas de pesquisa e sem
armazenamento de respostas na OpenAI (`store: false`). Cada pedido tem um máximo
de 1.000 tokens de saída e usa apenas o título e até 6.000 caracteres de contexto.

O contexto vem da descrição do RSS ou dos factos acrescentados no backoffice.
Um título isolado não é suficiente. Não se descarregam artigos integrais nem se
contornam paywalls. Respostas incompletas, recusas, números ausentes do contexto
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

Depois da aprovação, o título abre `/hub/noticias/<id>`, com fonte e ligação
original. As visitas não fazem pedidos à IA. O acesso beta atual do Hub mantém-se.

## Fontes

O Jogo e Jornal de Notícias são recolhidos através dos seus títulos públicos
no Google Notícias, validando o domínio do editor em cada item. Acesso direto
aos sites e aos antigos feeds falhou na verificação de 12/11/2026. Estes feeds
de títulos não fornecem contexto para resumos: acrescentar factos verificados
no backoffice ou fornecer futuramente um feed autorizado com descrições.

O RSS direto do Maisfutebol foi verificado e mantém a descrição como contexto.
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
