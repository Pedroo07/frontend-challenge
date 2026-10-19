/**
 * Módulo de precisão monetária para valores em ETH.
 * Utiliza inteiros BigInt com escala 10^18 (wei) para garantir representação decimal exata,
 * sem conversão para ponto flutuante (Number / parseFloat), prevenindo erros de arredondamento.
 */

const WEI_SCALE = 18
const WEI_FACTOR = 10n ** BigInt(WEI_SCALE)

/**
 * Converte uma string decimal de ETH (ex: "1.275", "0.02") para BigInt em wei (10^18).
 * Não utiliza parseFloat nem Number.
 */
export function parseEthToWei(ethStr: string | null | undefined): bigint {
  if (!ethStr) return 0n

  const trimmed = ethStr.trim()
  if (!trimmed || trimmed === '.' || trimmed === '-' || trimmed === '+') return 0n

  const isNegative = trimmed.startsWith('-')
  const cleanStr = isNegative ? trimmed.slice(1) : trimmed.startsWith('+') ? trimmed.slice(1) : trimmed

  const parts = cleanStr.split('.')
  if (parts.length > 2) {
    throw new Error(`Formato de ETH inválido: "${ethStr}"`)
  }

  const integerPartStr = parts[0] || '0'
  const fractionalPartRaw = parts[1] || ''

  // Trunca ou preenche casas decimais até exatamente 18 dígitos
  const fractionalPartStr = fractionalPartRaw.slice(0, WEI_SCALE).padEnd(WEI_SCALE, '0')

  if (!/^\d+$/.test(integerPartStr) || !/^\d+$/.test(fractionalPartStr)) {
    throw new Error(`Formato de ETH numérico inválido: "${ethStr}"`)
  }

  const integerWei = BigInt(integerPartStr) * WEI_FACTOR
  const fractionalWei = BigInt(fractionalPartStr)
  const totalWei = integerWei + fractionalWei

  return isNegative ? -totalWei : totalWei
}

/**
 * Converte um valor BigInt em wei para string decimal exata em ETH.
 * Não utiliza ponto flutuante.
 */
export function formatWeiToEth(wei: bigint): string {
  const isNegative = wei < 0n
  const absoluteWei = isNegative ? -wei : wei

  const integerPart = absoluteWei / WEI_FACTOR
  const remainder = absoluteWei % WEI_FACTOR

  if (remainder === 0n) {
    return `${isNegative ? '-' : ''}${integerPart.toString()}`
  }

  const remainderStr = remainder.toString().padStart(WEI_SCALE, '0')
  // Remove zeros à direita da parte fracionária
  const trimmedFractional = remainderStr.replace(/0+$/, '')

  return `${isNegative ? '-' : ''}${integerPart.toString()}.${trimmedFractional}`
}

/**
 * Multiplica um preço unitário em ETH por uma quantidade inteira.
 * Retorna a string decimal exata em ETH.
 */
export function multiplyEth(unitPriceEth: string, quantity: number | bigint): string {
  const qtyBigInt = typeof quantity === 'bigint' ? quantity : BigInt(Math.max(0, Math.floor(quantity)))
  const unitWei = parseEthToWei(unitPriceEth)
  const totalWei = unitWei * qtyBigInt
  return formatWeiToEth(totalWei)
}

/**
 * Soma múltiplos valores em ETH preservando precisão exata.
 */
export function addEth(...ethValues: (string | null | undefined)[]): string {
  let sumWei = 0n
  for (const val of ethValues) {
    if (val) {
      sumWei += parseEthToWei(val)
    }
  }
  return formatWeiToEth(sumWei)
}

/**
 * Subtrai b de a (a - b). Se o resultado for negativo, retorna 0 (a menos que allowNegative seja true).
 */
export function subtractEth(aEth: string, bEth: string, allowNegative = false): string {
  const aWei = parseEthToWei(aEth)
  const bWei = parseEthToWei(bEth)
  const diffWei = aWei - bWei
  if (!allowNegative && diffWei < 0n) {
    return '0'
  }
  return formatWeiToEth(diffWei)
}

/**
 * Calcula desconto percentual sobre um subtotal em ETH.
 * discountPercent é um número inteiro (ex: 10 para 10%).
 */
export function calculateDiscountEth(subtotalEth: string, discountPercent: number | bigint): string {
  const pct = typeof discountPercent === 'bigint' ? discountPercent : BigInt(Math.max(0, Math.floor(discountPercent)))
  if (pct === 0n) return '0'
  const subtotalWei = parseEthToWei(subtotalEth)
  const discountWei = (subtotalWei * pct) / 100n
  return formatWeiToEth(discountWei)
}

/**
 * Compara dois valores em ETH. Retorna -1 se a < b, 0 se a === b, 1 se a > b.
 */
export function compareEth(aEth: string, bEth: string): number {
  const aWei = parseEthToWei(aEth)
  const bWei = parseEthToWei(bEth)
  if (aWei < bWei) return -1
  if (aWei > bWei) return 1
  return 0
}

/**
 * Formata um valor em ETH para exibição amigável na interface (ex: "1.2750 ETH" ou "0.02 ETH").
 * Apenas para apresentação visual.
 */
export function formatEthDisplay(ethStr: string, minDecimals = 2, maxDecimals = 4): string {
  if (!ethStr) return '0.00'
  const trimmed = ethStr.trim()
  const [intPart = '0', fracPart = ''] = trimmed.split('.')

  if (fracPart.length < minDecimals) {
    return `${intPart}.${fracPart.padEnd(minDecimals, '0')}`
  }
  if (fracPart.length > maxDecimals) {
    return `${intPart}.${fracPart.slice(0, maxDecimals)}`
  }
  return `${intPart}.${fracPart}`
}
