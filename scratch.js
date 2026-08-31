const regex = /Vers[ãa]o\s+([\d.A-C]+)/i;
const titles = [
  "Tabela CFOP - Operações Geradoras de Créditos - Versão 1.10C",
  "Tabela Correlação Créditos Dacon X EFD-Contribuições - Versão 1.2",
  "Tabelas de Códigos - Versão 4.0"
];
titles.forEach(t => {
  const match = t.match(regex);
  console.log(t, "->", match ? match[1] : "not found");
});
