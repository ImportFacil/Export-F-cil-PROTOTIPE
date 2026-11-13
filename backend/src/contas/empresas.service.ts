import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'kysely';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { UsuarioAutenticado } from '../auth/identidade';
import { BANCO, type Banco } from '../banco/banco.module';
import type { Empresa } from '../banco/tipos';
import { normalizarCnpj } from '../comum/cnpj';
import { conferirEndereco } from '../comum/endereco';
import { PG_VIOLACAO_UNICA, codigoPg } from '../comum/erros';
import { limites } from '../comum/paginacao';
import type { AlterarEmpresaDto, AlterarPaisDto, CriarEmpresaDto, FiltroEmpresas } from './dto';

@Injectable()
export class EmpresasService {
  constructor(
    @Inject(BANCO) private readonly db: Banco,
    private readonly auditoria: AuditoriaService,
  ) {}

  private async conferirTipo(tipo: string): Promise<void> {
    const t = await this.db.selectFrom('tabelas_preco').select('ativo').where('tipo_cliente', '=', tipo).executeTakeFirst();
    if (!t || !t.ativo) throw new BadRequestException(`Tipo de cliente desconhecido ou inativo: ${tipo}`);
  }

  /** Países de destino (e o Brasil), na ordem dos blocos. */
  paises(soAtivos = false) {
    let q = this.db.selectFrom('paises').selectAll().orderBy('ordem');
    if (soAtivos) q = q.where('ativo', '=', true);
    return q.execute();
  }

  async alterarPais(codigo: string, dto: AlterarPaisDto, autor: UsuarioAutenticado, ip: string | null) {
    return this.db.transaction().execute(async (trx) => {
      const antes = await trx.selectFrom('paises').selectAll().where('codigo', '=', codigo.toUpperCase()).forUpdate().executeTakeFirst();
      if (!antes) throw new NotFoundException('País não encontrado.');
      if (antes.codigo === 'BR' && dto.ativo === false) throw new BadRequestException('O Brasil é o país de origem e não pode ser desativado.');
      const mudancas = { ...(dto.ativo !== undefined && { ativo: dto.ativo }), ...(dto.moeda && { moeda: dto.moeda }), ...(dto.idioma && { idioma: dto.idioma }) };
      if (!Object.keys(mudancas).length) return antes;
      const depois = await trx.updateTable('paises').set(mudancas).where('codigo', '=', antes.codigo).returningAll().executeTakeFirstOrThrow();
      await this.auditoria.registrar({ usuario: autor, acao: 'pais.alterar', entidade: 'pais', entidadeId: antes.codigo, antes, depois, ip }, trx);
      return depois;
    });
  }

  private endereco(pais: string, e: CriarEmpresaDto['endereco']) {
    return e ? JSON.stringify(conferirEndereco(pais, e)) : null;
  }

  async criar(dto: CriarEmpresaDto, autor: UsuarioAutenticado, ip: string | null): Promise<Empresa> {
    await this.conferirTipo(dto.tipo_cliente);
    const codigoPais = dto.pais ?? 'BR';
    const pais = await this.db.selectFrom('paises').selectAll().where('codigo', '=', codigoPais).executeTakeFirst();
    if (!pais || !pais.ativo) throw new BadRequestException(`País desconhecido ou fora da lista de destinos: ${codigoPais}`);
    const brasil = codigoPais === 'BR';
    if (brasil && !dto.cnpj) throw new BadRequestException('Informe o CNPJ da empresa.');
    if (!brasil && dto.cnpj) throw new BadRequestException('CNPJ é só para empresas do Brasil; informe a identificação fiscal do país do comprador.');
    if (!brasil && !dto.id_fiscal) throw new BadRequestException('Informe a identificação fiscal do comprador no país dele.');
    try {
      return await this.db.transaction().execute(async (trx) => {
        const empresa = await trx
          .insertInto('empresas')
          .values({
            cnpj: brasil ? normalizarCnpj(dto.cnpj as string) : null,
            pais: codigoPais,
            id_fiscal: brasil ? null : (dto.id_fiscal as string),
            moeda: dto.moeda ?? pais.moeda,
            idioma: dto.idioma ?? pais.idioma,
            razao_social: dto.razao_social,
            nome_fantasia: dto.nome_fantasia ?? null,
            tipo_cliente: dto.tipo_cliente,
            endereco: this.endereco(codigoPais, dto.endereco),
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await this.auditoria.registrar({ usuario: autor, acao: 'empresa.criar', entidade: 'empresa', entidadeId: empresa.id, depois: empresa, ip }, trx);
        return empresa;
      });
    } catch (e) {
      if (codigoPg(e) === PG_VIOLACAO_UNICA) throw new ConflictException(brasil ? 'Já existe uma empresa com este CNPJ.' : 'Já existe uma empresa deste país com esta identificação fiscal.');
      throw e;
    }
  }

  async listar(f: FiltroEmpresas) {
    const { limite, deslocamento, pagina } = limites(f);
    let q = this.db.selectFrom('empresas');
    if (f.situacao) q = q.where('situacao', '=', f.situacao);
    if (f.tipo_cliente) q = q.where('tipo_cliente', '=', f.tipo_cliente);
    if (f.pais) q = q.where('pais', '=', f.pais.toUpperCase());
    if (f.busca?.trim()) {
      const termo = `%${f.busca.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      const cnpj = normalizarCnpj(f.busca);
      q = q.where((eb) =>
        eb.or([
          eb('razao_social', 'ilike', termo),
          eb('nome_fantasia', 'ilike', termo),
          eb('id_fiscal', 'ilike', termo),
          ...(cnpj.length >= 4 ? [eb('cnpj', 'like', `%${cnpj}%`)] : []),
        ]),
      );
    }
    const [itens, total] = await Promise.all([
      q.selectAll().orderBy('razao_social').limit(limite).offset(deslocamento).execute(),
      q.select(sql<number>`count(*)::int`.as('n')).executeTakeFirstOrThrow(),
    ]);
    return { itens, total: total.n, pagina, por_pagina: limite };
  }

  async obter(id: string): Promise<Empresa> {
    const empresa = await this.db.selectFrom('empresas').selectAll().where('id', '=', id).executeTakeFirst();
    if (!empresa) throw new NotFoundException('Empresa não encontrada.');
    return empresa;
  }

  async alterar(id: string, dto: AlterarEmpresaDto, autor: UsuarioAutenticado, ip: string | null): Promise<Empresa> {
    if (dto.tipo_cliente) await this.conferirTipo(dto.tipo_cliente);
    return this.db.transaction().execute(async (trx) => {
      const antes = await trx.selectFrom('empresas').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
      if (!antes) throw new NotFoundException('Empresa não encontrada.');
      const mudancas = {
        ...(dto.razao_social !== undefined && { razao_social: dto.razao_social }),
        ...(dto.nome_fantasia !== undefined && { nome_fantasia: dto.nome_fantasia || null }),
        ...(dto.tipo_cliente !== undefined && { tipo_cliente: dto.tipo_cliente }),
        ...(dto.situacao !== undefined && { situacao: dto.situacao }),
        ...(dto.endereco !== undefined && { endereco: this.endereco(antes.pais, dto.endereco) }),
        ...(dto.moeda !== undefined && { moeda: dto.moeda }),
        ...(dto.idioma !== undefined && { idioma: dto.idioma }),
        ...(dto.id_fiscal !== undefined && antes.pais !== 'BR' && { id_fiscal: dto.id_fiscal }),
      };
      if (!Object.keys(mudancas).length) return antes;
      const depois = await trx.updateTable('empresas').set(mudancas).where('id', '=', id).returningAll().executeTakeFirstOrThrow();
      await this.auditoria.registrar({ usuario: autor, acao: 'empresa.alterar', entidade: 'empresa', entidadeId: id, antes, depois, ip }, trx);
      return depois;
    });
  }
}
