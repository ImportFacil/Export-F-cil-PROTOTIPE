import { Kysely, sql } from 'kysely';

/**
 * Exportação: países de destino (por bloco) e o comprador estrangeiro.
 * A empresa compradora passa a ter país, moeda de venda (dólar ou euro) e idioma (português, inglês ou espanhol).
 * Quem é de fora do Brasil não tem CNPJ: informa a identificação fiscal do próprio país (CUIT, RUT, EIN, VAT...).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE paises (
      codigo   char(2) PRIMARY KEY CHECK (codigo ~ '^[A-Z]{2}$'),
      nome     text NOT NULL,
      nome_en  text NOT NULL,
      nome_es  text NOT NULL,
      bloco    text NOT NULL CHECK (bloco IN ('brasil', 'mercosul', 'associado_mercosul', 'america_norte', 'uniao_europeia', 'europa', 'asia', 'africa')),
      moeda    text NOT NULL CHECK (moeda IN ('USD', 'EUR')),
      idioma   text NOT NULL CHECK (idioma IN ('pt', 'en', 'es')),
      ativo    boolean NOT NULL DEFAULT true,
      ordem    integer NOT NULL DEFAULT 0
    )`.execute(db);
  await sql`
    INSERT INTO paises (codigo, nome, nome_en, nome_es, bloco, moeda, idioma, ordem) VALUES
      ('BR', 'Brasil', 'Brazil', 'Brasil', 'brasil', 'USD', 'pt', 0),
      ('AR', 'Argentina', 'Argentina', 'Argentina', 'mercosul', 'USD', 'es', 1),
      ('UY', 'Uruguai', 'Uruguay', 'Uruguay', 'mercosul', 'USD', 'es', 2),
      ('PY', 'Paraguai', 'Paraguay', 'Paraguay', 'mercosul', 'USD', 'es', 3),
      ('BO', 'Bolívia', 'Bolivia', 'Bolivia', 'mercosul', 'USD', 'es', 4),
      ('CL', 'Chile', 'Chile', 'Chile', 'associado_mercosul', 'USD', 'es', 5),
      ('CO', 'Colômbia', 'Colombia', 'Colombia', 'associado_mercosul', 'USD', 'es', 6),
      ('EC', 'Equador', 'Ecuador', 'Ecuador', 'associado_mercosul', 'USD', 'es', 7),
      ('PE', 'Peru', 'Peru', 'Perú', 'associado_mercosul', 'USD', 'es', 8),
      ('GY', 'Guiana', 'Guyana', 'Guyana', 'associado_mercosul', 'USD', 'en', 9),
      ('SR', 'Suriname', 'Suriname', 'Surinam', 'associado_mercosul', 'USD', 'en', 10),
      ('US', 'Estados Unidos', 'United States', 'Estados Unidos', 'america_norte', 'USD', 'en', 11),
      ('MX', 'México', 'Mexico', 'México', 'america_norte', 'USD', 'es', 12),
      ('CA', 'Canadá', 'Canada', 'Canadá', 'america_norte', 'USD', 'en', 13),
      ('ZA', 'África do Sul', 'South Africa', 'Sudáfrica', 'africa', 'USD', 'en', 14),
      ('CN', 'China', 'China', 'China', 'asia', 'USD', 'en', 15),
      ('JP', 'Japão', 'Japan', 'Japón', 'asia', 'USD', 'en', 16),
      ('SG', 'Singapura', 'Singapore', 'Singapur', 'asia', 'USD', 'en', 17),
      ('TW', 'Taiwan', 'Taiwan', 'Taiwán', 'asia', 'USD', 'en', 18),
      ('GB', 'Reino Unido (Inglaterra)', 'United Kingdom', 'Reino Unido', 'europa', 'EUR', 'en', 19),
      ('CH', 'Suíça', 'Switzerland', 'Suiza', 'europa', 'EUR', 'en', 20),
      ('NO', 'Noruega', 'Norway', 'Noruega', 'europa', 'EUR', 'en', 21),
      ('DE', 'Alemanha', 'Germany', 'Alemania', 'uniao_europeia', 'EUR', 'en', 22),
      ('AT', 'Áustria', 'Austria', 'Austria', 'uniao_europeia', 'EUR', 'en', 23),
      ('BE', 'Bélgica', 'Belgium', 'Bélgica', 'uniao_europeia', 'EUR', 'en', 24),
      ('BG', 'Bulgária', 'Bulgaria', 'Bulgaria', 'uniao_europeia', 'EUR', 'en', 25),
      ('CY', 'Chipre', 'Cyprus', 'Chipre', 'uniao_europeia', 'EUR', 'en', 26),
      ('HR', 'Croácia', 'Croatia', 'Croacia', 'uniao_europeia', 'EUR', 'en', 27),
      ('DK', 'Dinamarca', 'Denmark', 'Dinamarca', 'uniao_europeia', 'EUR', 'en', 28),
      ('SK', 'Eslováquia', 'Slovakia', 'Eslovaquia', 'uniao_europeia', 'EUR', 'en', 29),
      ('SI', 'Eslovênia', 'Slovenia', 'Eslovenia', 'uniao_europeia', 'EUR', 'en', 30),
      ('ES', 'Espanha', 'Spain', 'España', 'uniao_europeia', 'EUR', 'es', 31),
      ('EE', 'Estônia', 'Estonia', 'Estonia', 'uniao_europeia', 'EUR', 'en', 32),
      ('FI', 'Finlândia', 'Finland', 'Finlandia', 'uniao_europeia', 'EUR', 'en', 33),
      ('FR', 'França', 'France', 'Francia', 'uniao_europeia', 'EUR', 'en', 34),
      ('GR', 'Grécia', 'Greece', 'Grecia', 'uniao_europeia', 'EUR', 'en', 35),
      ('HU', 'Hungria', 'Hungary', 'Hungría', 'uniao_europeia', 'EUR', 'en', 36),
      ('IE', 'Irlanda', 'Ireland', 'Irlanda', 'uniao_europeia', 'EUR', 'en', 37),
      ('IT', 'Itália', 'Italy', 'Italia', 'uniao_europeia', 'EUR', 'en', 38),
      ('LV', 'Letônia', 'Latvia', 'Letonia', 'uniao_europeia', 'EUR', 'en', 39),
      ('LT', 'Lituânia', 'Lithuania', 'Lituania', 'uniao_europeia', 'EUR', 'en', 40),
      ('LU', 'Luxemburgo', 'Luxembourg', 'Luxemburgo', 'uniao_europeia', 'EUR', 'en', 41),
      ('MT', 'Malta', 'Malta', 'Malta', 'uniao_europeia', 'EUR', 'en', 42),
      ('NL', 'Países Baixos', 'Netherlands', 'Países Bajos', 'uniao_europeia', 'EUR', 'en', 43),
      ('PL', 'Polônia', 'Poland', 'Polonia', 'uniao_europeia', 'EUR', 'en', 44),
      ('PT', 'Portugal', 'Portugal', 'Portugal', 'uniao_europeia', 'EUR', 'pt', 45),
      ('CZ', 'República Tcheca', 'Czechia', 'Chequia', 'uniao_europeia', 'EUR', 'en', 46),
      ('RO', 'Romênia', 'Romania', 'Rumanía', 'uniao_europeia', 'EUR', 'en', 47),
      ('SE', 'Suécia', 'Sweden', 'Suecia', 'uniao_europeia', 'EUR', 'en', 48)`.execute(db);
  await sql`
    ALTER TABLE empresas
      ALTER COLUMN cnpj DROP NOT NULL,
      ADD COLUMN pais      char(2) NOT NULL DEFAULT 'BR' REFERENCES paises (codigo),
      ADD COLUMN id_fiscal text CHECK (id_fiscal IS NULL OR length(trim(id_fiscal)) BETWEEN 3 AND 40),
      ADD COLUMN moeda     text NOT NULL DEFAULT 'USD' CHECK (moeda IN ('USD', 'EUR')),
      ADD COLUMN idioma    text NOT NULL DEFAULT 'pt' CHECK (idioma IN ('pt', 'en', 'es')),
      ADD CONSTRAINT empresas_identificacao CHECK (
        (pais = 'BR' AND cnpj IS NOT NULL) OR (pais <> 'BR' AND cnpj IS NULL AND id_fiscal IS NOT NULL)
      )`.execute(db);
  await sql`CREATE UNIQUE INDEX empresas_id_fiscal_unico ON empresas (pais, upper(id_fiscal)) WHERE id_fiscal IS NOT NULL`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX empresas_id_fiscal_unico`.execute(db);
  await sql`ALTER TABLE empresas DROP CONSTRAINT empresas_identificacao, DROP COLUMN pais, DROP COLUMN id_fiscal, DROP COLUMN moeda, DROP COLUMN idioma`.execute(db);
  await sql`DROP TABLE paises`.execute(db);
}
