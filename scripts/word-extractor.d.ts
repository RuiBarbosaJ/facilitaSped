/**
 * O pacote word-extractor não publica tipos. Declaramos apenas a superfície
 * usada pelo sync-tabelas.ts.
 */
declare module 'word-extractor' {
  class Document {
    getBody(): string;
    getFootnotes(): string;
    getHeaders(): string;
  }
  export default class WordExtractor {
    extract(source: string | Buffer): Promise<Document>;
  }
}
