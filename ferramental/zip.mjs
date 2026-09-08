// Um leitor de ZIP em cima do `zlib`, que é built-in.
//
// POR QUE NÃO `unzip` DO SISTEMA: o portão deste projeto roda em Windows E em
// Linux, e `unzip` não existe no runner do Windows. Um passo que só funciona num
// dos dois é um passo que passa metade das vezes — e a matriz existe justamente
// porque o defeito que matou o projeto anterior sobreviveu um ano num CI que só
// rodava Linux.
//
// POR QUE NÃO UMA DEPENDÊNCIA: são cinquenta linhas, e o formato não muda desde
// 1989. Uma dependência aqui seria uma superfície de atualização e de auditoria
// para resolver o que `zlib.inflateRawSync` já resolve.

import { inflateRawSync } from 'node:zlib'

const ASSINATURA_FIM = 0x06054b50 // End of Central Directory
const ASSINATURA_CENTRAL = 0x02014b50 // Central Directory File Header
const ASSINATURA_LOCAL = 0x04034b50 // Local File Header

/**
 * Os nomes e os conteúdos de um ZIP, lidos do DIRETÓRIO CENTRAL e não varrendo
 * cabeçalhos locais.
 *
 * A diferença importa: o cabeçalho local pode declarar tamanho zero e remeter a
 * um descritor DEPOIS dos dados, o que é comum em arquivo gerado em streaming —
 * e é o caso dos ZIPs da CVM. Quem lê o cabeçalho local acha um arquivo vazio e
 * não percebe.
 */
export function lerZip(buffer) {
  // O EOCD tem tamanho variável por causa do comentário no fim; procura-se de
  // trás para frente, que é o que a especificação manda.
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
    /** O conteúdo de uma entrada, já descomprimido, como Buffer. */
    ler(nome) {
      const e = arquivos.get(nome)
      if (!e) throw new Error(`entrada ausente no ZIP: ${nome}`)
      if (buffer.readUInt32LE(e.deslocamentoLocal) !== ASSINATURA_LOCAL) {
        throw new Error(`cabeçalho local corrompido para ${nome}`)
      }
      // O nome e o extra do cabeçalho LOCAL podem ter tamanhos diferentes dos do
      // central — o extra costuma diferir. Lê-se os do local para achar os dados.
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
