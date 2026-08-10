-- Fitness catalog: agachamento, prancha, afundo, abdominal, glute bridge
-- (flexão `pushup` já existe em 20260801134500)

insert into public.exercise_types (
  slug,
  nome,
  descricao,
  atributo_padrao,
  categoria_padrao,
  xp_base,
  xp_por_rep_valida,
  xp_sessao_max,
  sessoes_por_dia_max,
  sort_order,
  ativo
) values
  (
    'squat',
    'Agachamento',
    'Exercício validado com câmera (on-device). Pernas e glúteo — profundidade pelo joelho.',
    'forca',
    'corpo',
    15,
    2,
    120,
    3,
    20,
    true
  ),
  (
    'plank',
    'Prancha',
    'Exercício validado com câmera (on-device). Core isométrico — XP por segundo alinhado.',
    'forca',
    'corpo',
    10,
    1,
    90,
    3,
    30,
    true
  ),
  (
    'lunge',
    'Afundo',
    'Exercício validado com câmera (on-device). Pernas e equilíbrio — perna da frente (MVP).',
    'forca',
    'corpo',
    15,
    2,
    120,
    3,
    40,
    true
  ),
  (
    'situp',
    'Abdominal',
    'Exercício validado com câmera (on-device). Core — flexão de tronco.',
    'forca',
    'corpo',
    12,
    2,
    100,
    3,
    50,
    true
  ),
  (
    'glute_bridge',
    'Elevação de quadril',
    'Exercício validado com câmera (on-device). Posterior e glúteo — ponte no chão.',
    'forca',
    'corpo',
    12,
    2,
    100,
    3,
    60,
    true
  )
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  atributo_padrao = excluded.atributo_padrao,
  categoria_padrao = excluded.categoria_padrao,
  xp_base = excluded.xp_base,
  xp_por_rep_valida = excluded.xp_por_rep_valida,
  xp_sessao_max = excluded.xp_sessao_max,
  sessoes_por_dia_max = excluded.sessoes_por_dia_max,
  sort_order = excluded.sort_order,
  ativo = true;
