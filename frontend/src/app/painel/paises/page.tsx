'use client';
import { useEu } from '@/components/Shell';
import { Grade, type Coluna } from '@/components/painel/Grade';
import { Aviso, Situacao } from '@/components/ui';
import { api } from '@/lib/api';
import { BLOCOS, IDIOMAS, MOEDAS } from '@/lib/formato';
import { useAcao, useDados } from '@/lib/hooks';

interface Pais { codigo: string; nome: string; nome_en: string; nome_es: string; bloco: string; moeda: string; idioma: string; ativo: boolean; ordem: number }

/** Configurações → Países de destino: para onde a Export Fácil vende, por bloco, com a moeda e o idioma padrão de cada país. */
export default function Paises() {
  const { eu } = useEu();
  const admin = eu.usuario.papel === 'administrador';
  const lista = useDados<Pais[]>('/equipe/paises');
  const acao = useAcao();
  const mudar = (p: Pais, corpo: Partial<Pick<Pais, 'ativo' | 'moeda' | 'idioma'>>) =>
    acao.executar(async () => {
      const novo = await api<Pais>(`/equipe/paises/${p.codigo}`, { metodo: 'PATCH', corpo });
      lista.setDados((lista.dados ?? []).map((x) => (x.codigo === novo.codigo ? novo : x)));
    }, `${p.nome} atualizado.`);

  const colunas: Coluna<Pais>[] = [
    { chave: 'nome', titulo: 'País', ordenavel: true, render: (p) => <><b>{p.nome}</b><div className="pequeno muted">{p.codigo} · {p.nome_en} · {p.nome_es}</div></> },
    { chave: 'bloco', titulo: 'Bloco', ordenavel: true, filtro: 'opcoes', opcoes: BLOCOS, render: (p) => BLOCOS[p.bloco] ?? p.bloco, valorCsv: (p) => BLOCOS[p.bloco] ?? p.bloco },
    { chave: 'moeda', titulo: 'Moeda de venda', filtro: 'opcoes', opcoes: MOEDAS, valorCsv: (p) => p.moeda,
      render: (p) => (admin && p.codigo !== 'BR'
        ? <select aria-label={`Moeda de venda para ${p.nome}`} value={p.moeda} disabled={acao.enviando} onClick={(e) => e.stopPropagation()} onChange={(e) => void mudar(p, { moeda: e.target.value })}>{Object.entries(MOEDAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        : MOEDAS[p.moeda]) },
    { chave: 'idioma', titulo: 'Idioma', filtro: 'opcoes', opcoes: IDIOMAS, valorCsv: (p) => IDIOMAS[p.idioma],
      render: (p) => (admin
        ? <select aria-label={`Idioma para ${p.nome}`} value={p.idioma} disabled={acao.enviando} onClick={(e) => e.stopPropagation()} onChange={(e) => void mudar(p, { idioma: e.target.value })}>{Object.entries(IDIOMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        : IDIOMAS[p.idioma]) },
    { chave: 'ativo', titulo: 'Destino', filtro: 'opcoes', opcoes: { true: 'Ativo', false: 'Desativado' }, valor: (p) => String(p.ativo), valorCsv: (p) => (p.codigo === 'BR' ? 'Origem' : p.ativo ? 'Ativo' : 'Desativado'),
      render: (p) => (p.codigo === 'BR'
        ? <span className="muted">País de origem</span>
        : <span className="linha" style={{ gap: 8 }}>
            <Situacao valor={p.ativo ? 'ativa' : 'inativa'} nomes={{ ativa: 'Ativo', inativa: 'Desativado' }} />
            {admin && <button className="botao leve pequeno" disabled={acao.enviando} onClick={(e) => { e.stopPropagation(); void mudar(p, { ativo: !p.ativo }); }}>{p.ativo ? 'Desativar' : 'Ativar'}</button>}
          </span>) },
  ];

  return (
    <Grade
      titulo="Países de destino"
      sub={lista.dados ? `${lista.dados.filter((p) => p.ativo && p.codigo !== 'BR').length} destino(s) ativo(s) · o comprador recebe a moeda e o idioma padrão do país dele` : ' '}
      topo={<><Aviso tipo="erro">{acao.erro}</Aviso><Aviso tipo="ok">{acao.ok}</Aviso></>}
      linhas={lista.dados ?? undefined}
      carregando={lista.carregando}
      colunas={colunas}
      chave={(p) => p.codigo}
      ordemInicial={{ chave: 'bloco', dir: 'asc' }}
      nomeArquivo="paises-de-destino"
      vazio="Nenhum país."
    />
  );
}
