import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Matches, MaxLength, Min, ValidateNested,
  registerDecorator, type ValidationOptions,
} from 'class-validator';
import { cnpjValido, normalizarCnpj } from '../comum/cnpj';
import { Paginacao } from '../comum/paginacao';
import { IDIOMAS, MOEDAS, PAPEIS_CLIENTE, PAPEIS_EQUIPE, type Idioma, type Moeda, type PapelCliente, type PapelEquipe, type SituacaoEmpresa } from '../banco/tipos';

const aparar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emailMinusculo = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

function IsCnpj(opcoes?: ValidationOptions) {
  return (obj: object, prop: string) =>
    registerDecorator({
      name: 'isCnpj', target: obj.constructor, propertyName: prop, options: { message: 'CNPJ inválido.', ...opcoes },
      validator: { validate: (v: unknown) => typeof v === 'string' && cnpjValido(v) },
    });
}

export class EnderecoDto {
  @ApiProperty({ example: '78890000', description: 'CEP (Brasil, 8 dígitos) ou código postal do país do comprador' })
  @Transform(({ value }) => { const t = String(value ?? '').trim(); return /^\d{5}[-.\s]?\d{3}$/.test(t) ? t.replace(/\D/g, '') : t; }) // CEP brasileiro fica só com os dígitos
  @IsString() @Length(2, 12, { message: 'Código postal inválido.' }) cep!: string;
  @ApiProperty() @Transform(aparar) @IsString() @Length(1, 200) logradouro!: string;
  @ApiProperty() @Transform(aparar) @IsString() @Length(1, 20) numero!: string;
  @ApiPropertyOptional() @IsOptional() @Transform(aparar) @IsString() @MaxLength(100) complemento?: string;
  @ApiProperty() @Transform(aparar) @IsString() @Length(1, 100) bairro!: string;
  @ApiProperty() @Transform(aparar) @IsString() @Length(1, 100) cidade!: string;
  @ApiProperty({ example: 'MT', description: 'UF (Brasil) ou estado/província do país do comprador' }) @Transform(({ value }) => { const t = String(value ?? '').trim(); return /^[A-Za-z]{2}$/.test(t) ? t.toUpperCase() : t; }) @IsString() @Length(1, 60) uf!: string;
}

export class CriarEmpresaDto {
  @ApiProperty({ example: '11.222.333/0001-81', description: 'Aceita CNPJ numérico ou alfanumérico, com ou sem pontuação.' })
  @IsOptional() @IsCnpj() cnpj?: string;
  @ApiPropertyOptional({ example: 'AR', description: 'País do comprador (ISO de 2 letras). Sem informar, Brasil.' })
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value)) @Matches(/^[A-Z]{2}$/, { message: 'País inválido.' }) pais?: string;
  @ApiPropertyOptional({ example: '30-71234567-8', description: 'Identificação fiscal no país do comprador (CUIT, RUT, EIN, VAT...). Obrigatória fora do Brasil.' })
  @IsOptional() @Transform(aparar) @IsString() @Length(3, 40) id_fiscal?: string;
  @ApiPropertyOptional({ enum: MOEDAS, description: 'Moeda de venda; sem informar, a padrão do país' }) @IsOptional() @IsIn(MOEDAS) moeda?: Moeda;
  @ApiPropertyOptional({ enum: IDIOMAS, description: 'Idioma da loja e dos documentos; sem informar, o padrão do país' }) @IsOptional() @IsIn(IDIOMAS) idioma?: Idioma;
  @ApiProperty() @Transform(aparar) @IsString() @Length(2, 200) razao_social!: string;
  @ApiPropertyOptional() @IsOptional() @Transform(aparar) @IsString() @MaxLength(200) nome_fantasia?: string;
  @ApiProperty({ example: 'cooperativa' }) @IsString() tipo_cliente!: string;
  @ApiPropertyOptional({ type: EnderecoDto }) @IsOptional() @ValidateNested() @Type(() => EnderecoDto) endereco?: EnderecoDto;
}

const SITUACOES: SituacaoEmpresa[] = ['ativa', 'bloqueada', 'inativa'];

export class AlterarEmpresaDto {
  @ApiPropertyOptional() @IsOptional() @Transform(aparar) @IsString() @Length(2, 200) razao_social?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(aparar) @IsString() @MaxLength(200) nome_fantasia?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tipo_cliente?: string;
  @ApiPropertyOptional({ enum: SITUACOES }) @IsOptional() @IsIn(SITUACOES) situacao?: SituacaoEmpresa;
  @ApiPropertyOptional({ type: EnderecoDto }) @IsOptional() @ValidateNested() @Type(() => EnderecoDto) endereco?: EnderecoDto;
  @ApiPropertyOptional({ enum: MOEDAS }) @IsOptional() @IsIn(MOEDAS) moeda?: Moeda;
  @ApiPropertyOptional({ enum: IDIOMAS }) @IsOptional() @IsIn(IDIOMAS) idioma?: Idioma;
  @ApiPropertyOptional({ description: 'Identificação fiscal no país do comprador (só para empresas de fora do Brasil)' })
  @IsOptional() @Transform(aparar) @IsString() @Length(3, 40) id_fiscal?: string;
}

export class AlterarPaisDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() ativo?: boolean;
  @ApiPropertyOptional({ enum: MOEDAS }) @IsOptional() @IsIn(MOEDAS) moeda?: Moeda;
  @ApiPropertyOptional({ enum: IDIOMAS }) @IsOptional() @IsIn(IDIOMAS) idioma?: Idioma;
}

export class FiltroEmpresas extends Paginacao {
  @ApiPropertyOptional({ description: 'Parte da razão social, do nome fantasia, do CNPJ ou da identificação fiscal' }) @IsOptional() @IsString() @MaxLength(100) busca?: string;
  @ApiPropertyOptional({ enum: SITUACOES }) @IsOptional() @IsIn(SITUACOES) situacao?: SituacaoEmpresa;
  @ApiPropertyOptional() @IsOptional() @IsString() tipo_cliente?: string;
  @ApiPropertyOptional({ description: 'País do comprador (ISO de 2 letras)' }) @IsOptional() @Matches(/^[A-Za-z]{2}$/) pais?: string;
}

export class NovoUsuarioClienteDto {
  @ApiProperty() @Transform(aparar) @IsString() @Length(2, 120) nome!: string;
  @ApiProperty() @Transform(emailMinusculo) @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty({ enum: PAPEIS_CLIENTE }) @IsIn(PAPEIS_CLIENTE) papel!: PapelCliente;
}

export class NovoUsuarioEquipeDto {
  @ApiProperty() @Transform(aparar) @IsString() @Length(2, 120) nome!: string;
  @ApiProperty() @Transform(emailMinusculo) @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty({ enum: PAPEIS_EQUIPE }) @IsIn(PAPEIS_EQUIPE) papel!: PapelEquipe;
}

export class AlterarUsuarioClienteDto {
  @ApiPropertyOptional({ enum: PAPEIS_CLIENTE }) @IsOptional() @IsIn(PAPEIS_CLIENTE) papel?: PapelCliente;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() ativo?: boolean;
  @ApiPropertyOptional({ nullable: true, description: 'Valor máximo por pedido sem aprovação (compradores); null = sem limite' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(100) limite_pedido_centavos?: number | null;
}

export class AlterarUsuarioEquipeDto {
  @ApiPropertyOptional({ enum: PAPEIS_EQUIPE }) @IsOptional() @IsIn(PAPEIS_EQUIPE) papel?: PapelEquipe;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() ativo?: boolean;
}

export { normalizarCnpj };
