/**
 * Converte uma data de vigência como publicada pelo SPED ("01/2011" ou
 * "08/03/2013") em um número ordenável no formato AAAAMMDD.
 *
 * Só serve para comparar qual vigência é mais recente — a exibição continua
 * usando o texto original. Datas sem dia contam como dia 1; texto que não é
 * data vira 0, ficando atrás de qualquer data real.
 */
export function ordinalData(data?: string): number {
  if (!data) return 0;
  const digitos = data.replace(/\D/g, "");

  if (digitos.length === 6) {
    const mes = Number(digitos.slice(0, 2));
    const ano = Number(digitos.slice(2));
    return ano * 10000 + mes * 100 + 1;
  }
  if (digitos.length === 8) {
    const dia = Number(digitos.slice(0, 2));
    const mes = Number(digitos.slice(2, 4));
    const ano = Number(digitos.slice(4));
    return ano * 10000 + mes * 100 + dia;
  }
  return 0;
}
