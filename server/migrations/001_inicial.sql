-- Contas, sessões e dados sincronizados do Cupom Favorito

CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  senha_hash TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Refresh tokens: só o hash SHA-256 fica no banco
CREATE TABLE sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expira_em TIMESTAMPTZ NOT NULL,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessoes_usuario ON sessoes (usuario_id);

CREATE TABLE codigos_redefinicao (
  usuario_id UUID PRIMARY KEY REFERENCES usuarios (id) ON DELETE CASCADE,
  codigo_hash TEXT NOT NULL,
  expira_em TIMESTAMPTZ NOT NULL,
  tentativas INTEGER NOT NULL DEFAULT 0
);

-- Um registro por entidade do app (cupom, item da lista etc.). Exclusões ficam como
-- marca (excluido = true) para chegarem aos outros aparelhos. "seq" cresce a cada
-- gravação e serve de cursor para cada aparelho baixar só o que mudou.
CREATE SEQUENCE registros_seq;
CREATE TABLE registros (
  usuario_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  chave TEXT NOT NULL,
  dados JSONB,
  excluido BOOLEAN NOT NULL DEFAULT false,
  atualizado_em TIMESTAMPTZ NOT NULL,
  seq BIGINT NOT NULL DEFAULT nextval('registros_seq'),
  PRIMARY KEY (usuario_id, tipo, chave)
);
CREATE INDEX idx_registros_cursor ON registros (usuario_id, seq);
