# Ensaio da automação dos jogos

Este ensaio cria jogos fictícios numa D1 local descartável e executa o Worker real
em workerd, o runtime da Cloudflare. Não usa a D1 remota, contas reais ou chamadas
reais à SerpApi. A resposta de exemplo é adaptada com IDs de teste e datas controladas.

Na raiz do repositório:

```sh
npm --prefix api/tests ci
npm --prefix api run test:football
```

Requer Node 20.19 ou superior e um sistema suportado pelo workerd.

O jogo da Liga começa às 18h no relógio do ensaio. Uma taça três dias depois abre
em simultâneo; o jogo seguinte da Liga, um jogo a exatamente sete dias e outro
sem hora confirmada ficam guardados no calendário. O relógio avança por código,
sem esperar pela hora real.

Abre sempre o próximo jogo com data e hora confirmadas, independentemente da
competição. Abre também o seguinte se o intervalo entre os dois inícios for
inferior a sete dias, num máximo de dois jogos. O par só avança depois da
importação do resultado do jogo em curso. Um intervalo de exatamente sete dias
não abre o segundo jogo.

O ensaio inclui o calendário Taça a 20/11, Champions a 24/11 e Liga a 29/11:
abrem Taça e Champions; depois da ficha final da Taça, abre a Liga usando o mesmo
calendário guardado. Confirma ainda o limite de dois jogos quando três competições
cabem na mesma semana, a hora por confirmar e o limite exato de sete dias.

São verificados o calendário persistido, as apps através dos seus endpoints reais,
a submissão antes do início, o bloqueio no instante certo, resultado, marcadores,
pontos, onze titulares, sete substituições e a votação dos dezoito participantes.
Também são exercitados adiamentos, alterações de hora, jogos manuais, jogadores
por associar, autogolos, 0-0, 1.000 previsões, falhas de BD e tarefas em simultâneo.
O ensaio de equipas cobre criação automática com logótipos, conservação dos dados
do backoffice, associação persistente, imagens inválidas e rollback do calendário.

`worker.ts` é apenas a entrada deste ensaio. Os controlos de relógio e o endpoint
`/__rehearsal/tick` não fazem parte do Worker publicado, cuja entrada continua a
ser `src/index.ts`. O teste não altera as permissões beta existentes do Hub.

# Ativação posterior

A configuração de produção define `FOOTBALL_AUTOMATION_ENABLED = "true"`.
O próximo deploy do Worker ativa o cron de cinco em cinco minutos e mantém o
cron das notícias. A publicação do frontend não publica o Worker. Aplicar as
migrações abaixo antes desse deploy.

Antes de publicar num ambiente escolhido:

1. Aplicar as migrações `021_football_automation.sql` e
   `022_football_initial_links.sql` através do processo de migrações desse ambiente.
   A 022 associa os nomes existentes do Académico de Viseu, Estoril, Champions e
   Supertaça aos KGMIDs, preservando os IDs e nomes do backoffice. Confirmar a
   época, jornada ativa e a chave SerpApi no Worker.
2. Confirmar que `FOOTBALL_DATA_TOKEN` está guardado como Secret no Worker, tal
   como `SERPAPI_API_KEY`, antes de publicar esta configuração. O token já não
   está no ficheiro. Os dois crons já estão definidos na configuração: notícias
   de três em três horas e automação de jogos de cinco em cinco minutos.
3. Rever as associações iniciais de equipas e competições. `football_team_links` e
   `football_competition_links` permitem associar KGMIDs aos IDs existentes. As
   equipas sem correspondência são criadas no próprio pedido do calendário, com
   nome, nome curto e o `thumbnail` disponível, sem pedidos adicionais à API.
   Equipas existentes são reutilizadas por KGMID ou por nome exato e único; o
   nome escolhido no backoffice mantém-se, e só se preenchem logótipos ou nomes
   curtos vazios. Depois da associação, mudanças de nome na API usam o mesmo ID.
   Nomes ambíguos, associações contraditórias ou equipas sem KGMID válido ficam
   pendentes. Nomes diferentes entre sistemas exigem revisão inicial para evitar
   duplicados. Não há associações por aproximação.
4. Confirmar `FOOTBALL_AUTOMATION_ENABLED = "true"` na configuração desse ambiente
   e publicar com `npx wrangler@4.55.0 deploy --env production`.
   Manter esse valor no Git evita que uma publicação posterior volte
   inadvertidamente a desligar a automação. Nos ambientes de ensaio, definir
   `"false"` enquanto se prepara a BD; nesse estado o handler não consulta a BD
   nem a SerpApi.

O primeiro cron depois da ativação importa o calendário numa chamada e abre apenas os jogos
selecionados. Jogos manuais coincidentes ficam com
`existing_fixture_requires_link`, sem serem duplicados ou assumidos pela automação.
Uma associação deliberada usa `football_calendar.fixture_id` e deve confirmar
equipas, competição, época e hora. Jogos novos usam a jornada ativa, como a criação
manual atual. Não são inventadas novas regras de jornadas ou de prémios.

As equipas e os respetivos links são gravados na mesma transação do calendário,
incluindo adversários de jogos que ainda não abrem. Usa-se o URL HTTPS do
logótipo disponibilizado pela API; não se descarregam imagens nem se fazem
pesquisas separadas. A migração 022 completa as quatro associações iniciais cujos
nomes diferem entre o backoffice e a API, sem criar tabelas novas.

Os jogos e erros de associação podem ser inspecionados com uma consulta:

```sql
SELECT kgmid, kickoff_at, kickoff_confirmed, fixture_id, finalized_at, attempts, last_error
FROM football_calendar
ORDER BY kickoff_at;
```

O cron corre a cada cinco minutos mas só chama a SerpApi quando existe trabalho:
calendário de sete em sete dias, ou de três em três dias enquanto houver horas por
confirmar; primeira ficha final duas horas após o início. O resultado principal
não soma os penáltis de desempate. Uma resposta final completa é suficiente para
resultado, marcadores, titulares e substituições.

Se o fornecedor ainda indicar jogo em curso ou dados incompletos, há até cinco
novas tentativas, após 15, 30, 60, 120 e 360 minutos. Não se promete atualização no
instante do apito final. Cada tentativa ao fornecedor pode consumir uma pesquisa.
Um resultado completo guardado é reutilizado em falhas posteriores da BD.

Resultado, marcadores, pontos e elegibilidade das Notas são publicados numa única
transação. Depois, `finalized_at` impede novas importações do mesmo jogo. Nenhum
resultado ou votação inseridos manualmente é substituído automaticamente. O Onze
continua a usar o próximo jogo confirmado, e as Notas mantêm o acesso beta atual.

Para desligar a automação, definir a variável de ativação como `"false"` e voltar
a publicar. Os dados importados ficam disponíveis e a gestão manual continua a existir.
