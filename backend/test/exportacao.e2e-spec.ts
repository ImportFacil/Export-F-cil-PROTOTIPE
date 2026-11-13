import type { INestApplication } from '@nestjs/common';
import { Migrator, sql } from 'kysely';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { criarAplicacao } from '../src/aplicacao';
import { gerarTokenDev } from '../src/auth/verificador-dev';
import type { Banco } from '../src/banco/banco.module';
import { criarConexao } from '../src/banco/conexao';
import { MIGRACOES } from '../src/banco/migracoes';
import { semearCatalogo, semearDemonstracao, semearReferencia } from '../src/banco/semear';
import { lerConfig } from '../src/config';

/** Exportação: países de destino por bloco e o comprador estrangeiro (país, identificação fiscal, moeda e idioma). */

const URL = process.env.TESTE_DATABASE_URL ?? 'postgres://postgres@127.0.0.1:55432/exportfacil_teste';
const SEGREDO = 'segredo-dos-testes';
const config = lerConfig({
  AMBIENTE: 'teste', DATABASE_URL: URL, AUTH_SEGREDO_DEV: SEGREDO, LIMITE_REQ_MINUTO: '10000',
  PASTA_ARQUIVOS: mkdtempSync(join(tmpdir(), 'exportfacil-arquivos-')),
});

let app: INestApplication;
let db: Banco;
let api: () => ReturnType<typeof request>;
const ADMIN = 'admin@exportfacil.dev';
const COM = 'comercial@exportfacil.dev';
const COOP = 'compras@coop-demo.com.br';
const como = async (email: string, origem: 'cliente' | 'equipe') => `Bearer ${await gerarTokenDev(SEGREDO, `dev-${email}`, origem)}`;

beforeAll(async () => {
  db = criarConexao(config.banco);
  await sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`.execute(db);
  const { error } = await new Migrator({ db, provider: { getMigrations: async () => MIGRACOES }, migrationTableName: 'migracoes', migrationLockTableName: 'migracoes_trava' }).migrateToLatest();
  if (error) throw error;
  await semearReferencia(db);
  await semearCatalogo(db);
  await semearDemonstracao(db);
  app = await criarAplicacao(config);
  await app.init();
  api = () => request(app.getHttpServer());
  await api().post('/equipe/usuarios').set('Authorization', await como(ADMIN, 'equipe')).send({ nome: 'Comercial', email: COM, papel: 'comercial' }).expect(201);
});

afterAll(async () => {
  await app?.close();
  await db?.destroy();
});

describe('países de destino', () => {
  it('a lista pública traz os destinos por bloco, com moeda e idioma padrão', async () => {
    const r = await api().get('/paises').expect(200);
    const por = Object.fromEntries(r.body.map((p: { codigo: string }) => [p.codigo, p]));
    expect(por.AR).toMatchObject({ nome: 'Argentina', bloco: 'mercosul', moeda: 'USD', idioma: 'es' });
    expect(por.CL).toMatchObject({ bloco: 'associado_mercosul', idioma: 'es' });
    expect(por.US).toMatchObject({ bloco: 'america_norte', moeda: 'USD', idioma: 'en' });
    expect(por.DE).toMatchObject({ bloco: 'uniao_europeia', moeda: 'EUR' });
    expect(por.GB).toMatchObject({ bloco: 'europa', moeda: 'EUR', idioma: 'en' });
    expect(por.ZA.bloco).toBe('africa');
    for (const c of ['UY', 'PY', 'BO', 'CO', 'EC', 'PE', 'GY', 'SR', 'MX', 'CA', 'CN', 'JP', 'SG', 'TW', 'CH', 'SE', 'NO']) expect(por[c]).toBeDefined();
    expect(r.body.filter((p: { bloco: string }) => p.bloco === 'uniao_europeia')).toHaveLength(27);
  });

  it('só o administrador desativa um país; desativado, sai da lista pública e não aceita comprador novo', async () => {
    await api().patch('/equipe/paises/SR').set('Authorization', await como(COM, 'equipe')).send({ ativo: false }).expect(403);
    await api().patch('/equipe/paises/BR').set('Authorization', await como(ADMIN, 'equipe')).send({ ativo: false }).expect(400);
    const r = await api().patch('/equipe/paises/sr').set('Authorization', await como(ADMIN, 'equipe')).send({ ativo: false }).expect(200);
    expect(r.body).toMatchObject({ codigo: 'SR', ativo: false });
    expect((await api().get('/paises').expect(200)).body.some((p: { codigo: string }) => p.codigo === 'SR')).toBe(false);
    expect((await api().get('/equipe/paises').set('Authorization', await como(COM, 'equipe')).expect(200)).body.some((p: { codigo: string }) => p.codigo === 'SR')).toBe(true);
    await api().post('/equipe/empresas').set('Authorization', await como(COM, 'equipe'))
      .send({ pais: 'SR', id_fiscal: 'SR-12345', razao_social: 'Paramaribo Trading NV', tipo_cliente: 'distribuidora' }).expect(400);
    await api().patch('/equipe/paises/SR').set('Authorization', await como(ADMIN, 'equipe')).send({ ativo: true, moeda: 'EUR' }).expect(200);
  });
});

describe('comprador estrangeiro', () => {
  let id: string;

  it('cadastra com país e identificação fiscal; moeda e idioma vêm do país', async () => {
    const com = await como(COM, 'equipe');
    const r = await api().post('/equipe/empresas').set('Authorization', com).send({
      pais: 'ar', id_fiscal: '30-71234567-8', razao_social: 'Agrosur Distribuidora S.A.', tipo_cliente: 'distribuidora',
      endereco: { cep: 'C1425', logradouro: 'Av. Santa Fe', numero: '3500', bairro: 'Palermo', cidade: 'Buenos Aires', uf: 'Ciudad Autónoma de Buenos Aires' },
    }).expect(201);
    expect(r.body).toMatchObject({ pais: 'AR', cnpj: null, id_fiscal: '30-71234567-8', moeda: 'USD', idioma: 'es' });
    expect(r.body.endereco).toMatchObject({ cep: 'C1425', uf: 'Ciudad Autónoma de Buenos Aires' });
    id = r.body.id;
    const de = await api().post('/equipe/empresas').set('Authorization', com)
      .send({ pais: 'DE', id_fiscal: 'DE123456789', razao_social: 'Rheinland Bau GmbH', tipo_cliente: 'construtora', idioma: 'en' }).expect(201);
    expect(de.body).toMatchObject({ moeda: 'EUR', idioma: 'en' });
  });

  it('recusa: sem identificação fiscal, com CNPJ fora do Brasil, país fora da lista e identificação repetida no mesmo país', async () => {
    const com = await como(COM, 'equipe');
    const base = { razao_social: 'Outra Empresa', tipo_cliente: 'distribuidora' };
    await api().post('/equipe/empresas').set('Authorization', com).send({ ...base, pais: 'CL' }).expect(400);
    await api().post('/equipe/empresas').set('Authorization', com).send({ ...base, pais: 'CL', cnpj: '11.222.333/0001-81', id_fiscal: '76.123.456-7' }).expect(400);
    await api().post('/equipe/empresas').set('Authorization', com).send({ ...base, pais: 'RU', id_fiscal: '7701234567' }).expect(400);
    await api().post('/equipe/empresas').set('Authorization', com).send({ ...base, pais: 'AR', id_fiscal: '30-71234567-8' }).expect(409);
    await api().post('/equipe/empresas').set('Authorization', com).send({ ...base, pais: 'UY', id_fiscal: '30-71234567-8' }).expect(201); // outro país, pode
    await api().post('/equipe/empresas').set('Authorization', com).send({ ...base }).expect(400); // Brasil exige CNPJ
  });

  it('empresa do Brasil continua com CNPJ, CEP de 8 dígitos e UF', async () => {
    const com = await como(COM, 'equipe');
    const endereco = { logradouro: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Belo Horizonte' };
    await api().post('/equipe/empresas').set('Authorization', com)
      .send({ cnpj: '66.777.888/0001-81', razao_social: 'Trading Mineira Ltda', tipo_cliente: 'distribuidora', endereco: { ...endereco, cep: '301', uf: 'MG' } }).expect(400);
    const r = await api().post('/equipe/empresas').set('Authorization', com)
      .send({ cnpj: '66.777.888/0001-81', razao_social: 'Trading Mineira Ltda', tipo_cliente: 'distribuidora', endereco: { ...endereco, cep: '30130-010', uf: 'mg' } }).expect(201);
    expect(r.body).toMatchObject({ pais: 'BR', cnpj: '66777888000181', id_fiscal: null, idioma: 'pt' });
    expect(r.body.endereco).toMatchObject({ cep: '30130010', uf: 'MG' });
  });

  it('busca por identificação fiscal e filtro por país; troca de moeda e idioma fica na auditoria', async () => {
    const com = await como(COM, 'equipe');
    const busca = await api().get('/equipe/empresas?busca=71234567').set('Authorization', com).expect(200);
    expect(busca.body.itens.map((e: { pais: string }) => e.pais).sort()).toEqual(['AR', 'UY']);
    const ar = await api().get('/equipe/empresas?pais=ar').set('Authorization', com).expect(200);
    expect(ar.body.itens).toHaveLength(1);
    const r = await api().patch(`/equipe/empresas/${id}`).set('Authorization', com).send({ moeda: 'EUR', idioma: 'en', id_fiscal: '30-99999999-1' }).expect(200);
    expect(r.body).toMatchObject({ moeda: 'EUR', idioma: 'en', id_fiscal: '30-99999999-1' });
    const trilha = await db.selectFrom('auditoria').select('acao').where('entidade_id', '=', id).orderBy('criado_em').execute();
    expect(trilha.map((t) => t.acao)).toEqual(['empresa.criar', 'empresa.alterar']);
    await api().get('/equipe/paises').set('Authorization', await como(COOP, 'cliente')).expect(403);
  });
});
