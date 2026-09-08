// A ZIP reader on top of `zlib`, which is built in.
//
// WHY NOT THE SYSTEM'S `unzip`: this project's gate runs on Windows AND on
// Linux, and `unzip` does not exist on the Windows runner. A step that only
// works on one of the two is a step that passes half the time — and the matrix
// exists precisely because the defect that killed the previous project survived
// a year in a CI that only ran Linux.
//
// WHY NOT A DEPENDENCY: it is fifty lines, and the format has not changed since
// 1989. A dependency here would be an update surface and an audit surface to
// solve what `zlib.inflateRawSync` already solves.

import { inflateRawSync } from 'node:zlib'

const ASSINATURA_FIM = 0x06054b50 // End of Central Directory
const ASSINATURA_CENTRAL = 0x02014b50 // Central Directory File Header
const ASSINATURA_LOCAL = 0x04034b50 // Local File Header

/**
 * The names and the contents of a ZIP, read from the CENTRAL DIRECTORY and not
 * by scanning local headers.
 *
 * The difference matters: the local header can declare size zero and defer to a
 * descriptor AFTER the data, which is common in a file produced by streaming —
 * and that is the case with the CVM's ZIPs. Whoever reads the local header finds
 * an empty file and does not notice.
 */
export function lerZip(buffer) {
  // The EOCD has a variable size because of the comment at the end; the search
  // runs from the back forwards, which is what the specification requires.
  let fim = -1
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === ASSINATURA_FIM) {
      fim = i
      break
    }
  }
  if (fim === -1) throw new Error('não é um ZIP: não achei o End of Central Directory')

  const quantos = buffer.readUInt16LE(fim + 10)
  let posicao = buffer.readUInt32LE(fim + 16)

  const arquivos = new Map()
  for (let n = 0; n < quantos; n++) {
    if (buffer.readUInt32LE(posicao) !== ASSINATURA_CENTRAL) {
      throw new Error(`diretório central corrompido na entrada ${n}`)
    }
    const metodo = buffer.readUInt16LE(posicao + 10)
    const comprimido = buffer.readUInt32LE(posicao + 20)
    const tamanhoNome = buffer.readUInt16LE(posicao + 28)
    const tamanhoExtra = buffer.readUInt16LE(posicao + 30)
    const tamanhoComentario = buffer.readUInt16LE(posicao + 32)
    const deslocamentoLocal = buffer.readUInt32LE(posicao + 42)
    const nome = buffer.toString('latin1', posicao + 46, posicao + 46 + tamanhoNome)

    arquivos.set(nome, { metodo, comprimido, deslocamentoLocal })
    posicao += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario
  }

  return {
    nomes: () => [...arquivos.keys()],
    /** The content of an entry, already decompressed, as a Buffer. */
    ler(nome) {
      const e = arquivos.get(nome)
      if (!e) throw new Error(`entrada ausente no ZIP: ${nome}`)
      if (buffer.readUInt32LE(e.deslocamentoLocal) !== ASSINATURA_LOCAL) {
        throw new Error(`cabeçalho local corrompido para ${nome}`)
      }
      // The name and the extra of the LOCAL header can have sizes different from
      // the central one's — the extra usually differs. The local ones are what is
      // read to find the data.
      const tamanhoNome = buffer.readUInt16LE(e.deslocamentoLocal + 26)
      const tamanhoExtra = buffer.readUInt16LE(e.deslocamentoLocal + 28)
      const inicio = e.deslocamentoLocal + 30 + tamanhoNome + tamanhoExtra
      const bruto = buffer.subarray(inicio, inicio + e.comprimido)
      if (e.metodo === 0) return bruto
      if (e.metodo === 8) return inflateRawSync(bruto)
      throw new Error(`método de compressão ${e.metodo} não suportado em ${nome}`)
    },
  }
}
