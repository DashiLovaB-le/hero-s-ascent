-- Migra papéis admin → dashi (control room /dashitecnology).
-- Tabela: public.user_roles

UPDATE public.user_roles
SET role = 'dashi'
WHERE role = 'admin';

DELETE FROM public.user_roles
WHERE role = 'admin';
