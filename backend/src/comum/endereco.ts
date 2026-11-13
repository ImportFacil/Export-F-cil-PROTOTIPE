import { BadRequestException } from '@nestjs/common';

interface EnderecoLivre { cep: string; uf: string }

/**
 * Endereço conforme o país da empresa: no Brasil, CEP de 8 dígitos e UF de 2 letras;
 * fora do Brasil vale o formato do país do comprador (código postal e estado ou província livres).
 */
export function conferirEndereco<T extends EnderecoLivre>(pais: string, e: T): T {
  if (pais !== 'BR') return e;
  const cep = e.cep.replace(/\D/g, '');
  const uf = e.uf.toUpperCase();
  if (!/^\d{8}$/.test(cep)) throw new BadRequestException('CEP deve ter 8 dígitos.');
  if (!/^[A-Z]{2}$/.test(uf)) throw new BadRequestException('UF deve ter 2 letras.');
  return { ...e, cep, uf };
}
