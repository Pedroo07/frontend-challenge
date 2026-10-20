

const WEI_SCALE = 18
const WEI_FACTOR = 10n ** BigInt(WEI_SCALE)


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


  const fractionalPartStr = fractionalPartRaw.slice(0, WEI_SCALE).padEnd(WEI_SCALE, '0')

  if (!/^\d+$/.test(integerPartStr) || !/^\d+$/.test(fractionalPartStr)) {
    throw new Error(`Formato de ETH numérico inválido: "${ethStr}"`)
  }

  const integerWei = BigInt(integerPartStr) * WEI_FACTOR
  const fractionalWei = BigInt(fractionalPartStr)
  const totalWei = integerWei + fractionalWei

  return isNegative ? -totalWei : totalWei
}


export function formatWeiToEth(wei: bigint): string {
  const isNegative = wei < 0n
  const absoluteWei = isNegative ? -wei : wei

  const integerPart = absoluteWei / WEI_FACTOR
  const remainder = absoluteWei % WEI_FACTOR

  if (remainder === 0n) {
    return `${isNegative ? '-' : ''}${integerPart.toString()}`
  }

  const remainderStr = remainder.toString().padStart(WEI_SCALE, '0')

  const trimmedFractional = remainderStr.replace(/0+$/, '')

  return `${isNegative ? '-' : ''}${integerPart.toString()}.${trimmedFractional}`
}


export function multiplyEth(unitPriceEth: string, quantity: number | bigint): string {
  const qtyBigInt = typeof quantity === 'bigint' ? quantity : BigInt(Math.max(0, Math.floor(quantity)))
  const unitWei = parseEthToWei(unitPriceEth)
  const totalWei = unitWei * qtyBigInt
  return formatWeiToEth(totalWei)
}


export function addEth(...ethValues: (string | null | undefined)[]): string {
  let sumWei = 0n
  for (const val of ethValues) {
    if (val) {
      sumWei += parseEthToWei(val)
    }
  }
  return formatWeiToEth(sumWei)
}


export function subtractEth(aEth: string, bEth: string, allowNegative = false): string {
  const aWei = parseEthToWei(aEth)
  const bWei = parseEthToWei(bEth)
  const diffWei = aWei - bWei
  if (!allowNegative && diffWei < 0n) {
    return '0'
  }
  return formatWeiToEth(diffWei)
}


export function calculateDiscountEth(subtotalEth: string, discountPercent: number | bigint): string {
  const pct = typeof discountPercent === 'bigint' ? discountPercent : BigInt(Math.max(0, Math.floor(discountPercent)))
  if (pct === 0n) return '0'
  const subtotalWei = parseEthToWei(subtotalEth)
  const discountWei = (subtotalWei * pct) / 100n
  return formatWeiToEth(discountWei)
}


export function compareEth(aEth: string, bEth: string): number {
  const aWei = parseEthToWei(aEth)
  const bWei = parseEthToWei(bEth)
  if (aWei < bWei) return -1
  if (aWei > bWei) return 1
  return 0
}


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
