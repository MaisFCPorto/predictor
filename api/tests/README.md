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

A automação de produção fica desligada: o repositório não define
`FOOTBALL_AUTOMATION_ENABLED=true`, nem altera os agendamentos da configuração
existente. Sem essa variável o handler novo não consulta a BD nem a SerpApi.
A publicação do frontend também não publica o Worker.

Antes de ativar num ambiente escolhido:

1. Aplicar a migração `021_football_automation.sql` através do processo de migrações
   desse ambiente. Confirmar a época, jornada ativa e a chave SerpApi no Worker.
2. Publicar o Worker. O cron das notícias mantém-se independente. Configurar o
   agendamento `*/5 * * * *` no ambiente escolhido, preservando o das notícias.
   Antes de guardar alterações à configuração no Git, retirar quaisquer tokens
   em texto simples e passá-los para os secrets desse Worker. Este PR não altera
   nem republica o ficheiro de configuração existente.
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
4. Só depois, definir `FOOTBALL_AUTOMATION_ENABLED=true` nesse ambiente.

O primeiro cron importa o calendário numa chamada e abre apenas os jogos
selecionados. Jogos manuais coincidentes ficam com
`existing_fixture_requires_link`, sem serem duplicados ou assumidos pela automação.
Uma associação deliberada usa `football_calendar.fixture_id` e deve confirmar
equipas, competição, época e hora. Jogos novos usam a jornada ativa, como a criação
manual atual. Não são inventadas novas regras de jornadas ou de prémios.

As equipas e os respetivos links são gravados na mesma transação do calendário,
incluindo adversários de jogos que ainda não abrem. Usa-se o URL HTTPS do
logótipo disponibilizado pela API; não se descarregam imagens nem se fazem
pesquisas separadas. Não é necessária outra migração além da 021.

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

Para desligar o agendamento, retirar a variável de ativação ou defini-la como
`false`. Os dados importados ficam disponíveis e a gestão manual continua a existir.
