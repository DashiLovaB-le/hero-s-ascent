# Áudio do Despertador Charlie

Coloque o arquivo de voz do MVP **exatamente** neste caminho:

```text
public/audio/charlie-alarm-classico.m4a
```

## Specs MVP
- Duração: 15–25 segundos
- Idioma: PT-BR
- Tom: mentor Charlie clássico
- Texto sugerido: *“É Charlie. O dia começou. Levanta, respira, e marca o primeiro hábito. A jornada não espera.”*
- Formato: `.m4a` (AAC) ou `.ogg` (se mudar o path no código)

## Keys extras
Se o Dashi definir `audio_key = motivacao`, o app busca:

```text
public/audio/charlie-alarm-motivacao.m4a
```

O arquivo **não** deve ser commitado se for voz licenciada/privata sem direitos — mas o path acima é o canônico no deploy (Vercel `public/`).
