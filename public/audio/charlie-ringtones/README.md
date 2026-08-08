# Toques do Despertador Charlie

Coloque **exatamente 3 arquivos** (substitua os WAV de placeholder quando tiver os finais):

## Pasta no APK (obrigatória para tocar com tela bloqueada)

```text
android/app/src/main/assets/charlie-ringtones/classic.wav
android/app/src/main/assets/charlie-ringtones/warrior.wav
android/app/src/main/assets/charlie-ringtones/calm.wav
```

Formatos aceitos pelo player nativo: `.wav` · `.mp3` · `.ogg` · `.m4a` (mesmo nome `classic` / `warrior` / `calm`).

## Espelho web (documentação / preview)

```text
public/audio/charlie-ringtones/
```

O som usa **STREAM_ALARM** (volume de despertador do Android), não o volume de mídia.
