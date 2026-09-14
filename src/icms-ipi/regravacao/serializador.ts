import { LinhaSped } from "../leitura/parser";

export const serializar = (l: LinhaSped): string => l.campos.join("|");
