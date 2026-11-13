'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useEu } from '@/components/Shell';
import { Grade, type Coluna } from '@/components/painel/Grade';
import { Aviso, Campo, Situacao } from '@/components/ui';
import { api } from '@/lib/api';
import { IDIOMAS, MOEDAS, NOMES_TIPO, identificacao } from '@/lib/formato';
import { useAcao, useDados } from '@/lib/hooks';

interface Pais { codigo: string; nome: string; bloco: string; moeda: string; idioma: string; ativo: boolean }
interface Empresa { id: string; cnpj: string | null; pais: string; id_fiscal: string | null; moeda: string; idioma: string; razao_social: string; nome_fantasia: string | null; tipo_cliente: string; situacao: string; conta_e_ordem_liberada: boolean }

export default function Empresas() {
  const router = useRouter();
  const { eu } = useEu();
  const pode = ['comercial', 'administrador'].includes(eu.usuario.papel);
  const lista = useDados<{ itens: Empresa[]; total: number }>('/equipe/empresas?por_pagina=1000');
  const tipos = useDados<Array<{ tipo_cliente: string; nome: string }>>('/equipe/tabelas-preco');
  const [novo, setNovo] = useState(false);
  const paises = useDados<Pais[]>('/equipe/paises');
  const nomePais = Object.fromEntries((paises.dados ?? []).map((p) => [p.codigo, p.nome]));
  const [form, setForm] = useState({ pais: 'AR', cnpj: '', id_fiscal: '', razao_social: '', nome_fantasia: '', tipo_cliente: 'distribuidora' });
  const brasil = form.pais === 'BR';
  const paisForm = paises.dados?.find((p) => p.codigo === form.pais);
  const acao = useAcao();

  const colunas: Coluna<Empresa>[] = [
    { chave: 'razao_social', titulo: 'Empresa', ordenavel: true, render: (e) => <><b>{e.razao_social}</b>{e.nome_fantasia && <div className="pequeno muted">{e.nome_fantasia}</div>}</> },
    { chave: 'pais', titulo: 'País', ordenavel: true, filtro: 'opcoes', opcoes: nomePais, render: (e) => nomePais[e.pais] ?? e.pais, valorCsv: (e) => nomePais[e.pais] ?? e.pais },
    { chave: 'cnpj', titulo: 'Identificação fiscal', render: (e) => <span className="numero">{identificacao(e)}</span>, valorCsv: (e) => identificacao(e) },
    { chave: 'moeda', titulo: 'Moeda', filtro: 'opcoes', opcoes: { USD: 'Dólar', EUR: 'Euro' }, render: (e) => e.moeda },
    { chave: 'tipo_cliente', titulo: 'Tipo de cliente', ordenavel: true, filtro: 'opcoes', opcoes: NOMES_TIPO, render: (e) => NOMES_TIPO[e.tipo_cliente] ?? e.tipo_cliente, valorCsv: (e) => NOMES_TIPO[e.tipo_cliente] ?? e.tipo_cliente },
    { chave: 'situacao', titulo: 'Situação', filtro: 'opcoes', opcoes: { ativa: 'Ativa', bloqueada: 'Bloqueada', inativa: 'Inativa' }, render: (e) => <Situacao valor={e.situacao} /> },
    { chave: 'conta_e_ordem_liberada', titulo: 'Conta e ordem', filtro: 'opcoes', opcoes: { true: 'Liberada', false: 'Não liberada' }, valor: (e) => String(e.conta_e_ordem_liberada),
      render: (e) => (e.conta_e_ordem_liberada ? <Situacao valor="aprovado" nomes={{ aprovado: 'Liberada' }} /> : <span className="muted">—</span>), valorCsv: (e) => (e.conta_e_ordem_liberada ? 'Liberada' : 'Não') },
  ];

  return (
    <>
      <Grade
        titulo="Compradores"
        sub={lista.dados ? `${lista.dados.total} empresa(s)` : ' '}
        acoes={pode && <button className="botao" onClick={() => setNovo(!novo)}>{novo ? 'Fechar' : 'Cadastrar comprador'}</button>}
        topo={<>
      {novo && (
        <form className="cartao formulario" style={{ marginBottom: 20 }} onSubmit={(e) => { e.preventDefault(); void acao.executar(async () => {
          const { cnpj: c, id_fiscal: f, ...resto } = form;
          const r = await api<Empresa>('/equipe/empresas', { corpo: { ...resto, ...(brasil ? { cnpj: c } : { id_fiscal: f }), nome_fantasia: form.nome_fantasia || undefined } });
          router.push(`/painel/empresa/?id=${r.id}`);
        }); }}>
          <h2>Novo comprador</h2>
          <div className="grade grade-2">
            <Campo rotulo="País" dica={paisForm && !brasil ? `Venda em ${MOEDAS[paisForm.moeda]} · loja e documentos em ${IDIOMAS[paisForm.idioma].toLowerCase()}` : undefined}>
              <select value={form.pais} onChange={(e) => setForm({ ...form, pais: e.target.value })}>
                {paises.dados?.filter((p) => p.ativo).map((p) => <option key={p.codigo} value={p.codigo}>{p.nome}</option>)}
              </select>
            </Campo>
            {brasil
              ? <Campo rotulo="CNPJ" dica="Numérico ou alfanumérico"><input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} required /></Campo>
              : <Campo rotulo="Identificação fiscal no país" dica="CUIT, RUT, EIN, VAT ou o equivalente"><input value={form.id_fiscal} onChange={(e) => setForm({ ...form, id_fiscal: e.target.value })} required minLength={3} maxLength={40} /></Campo>}
            <Campo rotulo="Tipo de cliente">
              <select value={form.tipo_cliente} onChange={(e) => setForm({ ...form, tipo_cliente: e.target.value })}>{tipos.dados?.map((t) => <option key={t.tipo_cliente} value={t.tipo_cliente}>{t.nome}</option>)}</select>
            </Campo>
            <Campo rotulo="Razão social"><input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} required minLength={2} /></Campo>
            <Campo rotulo="Nome fantasia"><input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} /></Campo>
          </div>
          <Aviso tipo="erro">{acao.erro}</Aviso>
          <div><button className="botao" disabled={acao.enviando}>Cadastrar</button></div>
        </form>
      )}
        </>}
        linhas={lista.dados?.itens}
        carregando={lista.carregando}
        colunas={colunas}
        chave={(e) => e.id}
        aoClicar={(e) => router.push(`/painel/empresa/?id=${e.id}`)}
        ordemInicial={{ chave: 'razao_social', dir: 'asc' }}
        nomeArquivo="empresas"
        vazio="Nenhuma empresa."
      />
    </>
  );
}
