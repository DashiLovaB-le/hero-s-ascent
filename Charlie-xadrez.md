# Charlie × Xadrez — Análise (adiado)

Documento de produto: vale ou não um jogo de xadrez com o Mentor.  
**Status:** ideia registrada — **não implementar agora.**

---

## A ideia

Botão na `/mentor` abre um pop-up com partida de xadrez contra o Charlie:

- Jogar com o mentor (não um bot anônimo)
- Pausar e continuar depois
- Registrar partidas no banco
- Ver histórico de resultados e evolução ao longo do tempo

Objetivo declarado: criar **conexão mais próxima** com o Charlie, além do chat e dos desafios.

---

## O que faz sentido

Charlie já é mentor de jornada (hábitos, XP, disciplina, presença). Xadrez reforça a metáfora — presença, paciência, estratégia — e encaixa como **ritual de vínculo**, não como feature central do produto.

Um botão discreto no mentor, com:

- partida pausável (FEN / estado salvo)
- resultado persistido
- histórico simples de evolução

…entrega boa parte da magia simbólica com escopo controlado.

---

## O que não faz sentido (agora)

O risco é virar um **segundo produto**:

- motor de jogo / engine
- regras, UI de tabuleiro, cheat leve
- persistência fina de posição
- ranking / multiplayer / social

Isso compete com o núcleo do V-Project (hábitos, jornada, mentor contínuo) e pode **distrair retenção** se a partida for mais divertida que o treino real.

---

## Veredicto

| Pergunta | Resposta |
| --- | --- |
| Faz sentido nesta aplicação? | **Sim**, como ritual de proximidade com o Charlie |
| Implementar agora? | **Não** — depois da Fase 1 estável e retenção do mentor |
| Forma correta | Extra enxuto: botão no mentor, engine simples (local ou API), save FEN + resultado, sem ranking social |
| Forma errada | Hub de xadrez, multiplayer, ou “app de xadrez com mentor colado” |

**Em uma frase:** sim para proximidade simbólica; não se engolir o escopo do V-Project.

---

## Quando revisitar

Reabrir este documento quando:

1. Charlie Fase 1 estiver estável em produção (objetivo, perguntas, desafios, memórias)
2. Uso de `/mentor` for consistente (≥ 1×/semana entre ativos, ou métrica equivalente)
3. Houver capacidade para um experimento **deliberadamente pequeno** (MVP de 1 sprint, sem ranking)

Até lá, manter fora do roadmap ativo.
