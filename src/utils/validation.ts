import { ValidationResult } from '../types'

export function validateQQNumbers(input: string): ValidationResult {
  // 支持多种分隔符：逗号、空格、换行，并智能清理格式
  const qqList = input
    .split(/[,\s\n]+/)
    .map(qq => qq.replace(/[^0-9]/g, '')) // 自动清理非数字字符
    .filter(qq => qq.length > 0 && /^\d{5,11}$/.test(qq)) // 过滤有效QQ号

  const results: ValidationResult = {
    success: [],
    duplicate: []
  }

  const seen = new Set<string>()
  
  for (const qq of qqList) {
    if (seen.has(qq)) {
      results.duplicate.push(qq)
    } else {
      seen.add(qq)
      results.success.push(qq)
    }
  }

  return results
}

export function validateNames(input: string): ValidationResult {
  // 支持多种分隔符：逗号、空格、换行
  const nameList = input
    .split(/[,\s\n]+/)
    .map(name => name.replace(/[^\u4e00-\u9fa5a-zA-Z\s]/g, '').trim()) // 清理特殊字符
    .filter(name => name.length >= 2 && name.length <= 10) // 过滤有效姓名

  const results: ValidationResult = {
    success: [],
    duplicate: []
  }

  const seen = new Set<string>()
  
  for (const name of nameList) {
    if (seen.has(name)) {
      results.duplicate.push(name)
    } else {
      seen.add(name)
      results.success.push(name)
    }
  }

  return results
}

export function cleanQQNumber(input: string): string | null {
  const cleaned = input.replace(/[^0-9]/g, '') // 只保留数字
  
  if (!cleaned || !/^\d{5,11}$/.test(cleaned)) {
    return null
  }
  
  return cleaned
}

export function cleanName(input: string): string | null {
  const cleaned = input.replace(/[^\u4e00-\u9fa5a-zA-Z\s]/g, '').trim()
  
  if (!cleaned || cleaned.length < 2 || cleaned.length > 10) {
    return null
  }
  
  return cleaned
}

export function formatValidationReport(
  results: ValidationResult, 
  type: 'QQ号' | '姓名'
): string[] {
  const report = []
  report.push(`📊 批量添加${type}白名单结果:`)
  report.push('')

  if (results.success.length > 0) {
    report.push(`✅ 成功添加 ${results.success.length} 个:`)
    if (results.success.length <= 10) {
      report.push(results.success.map(item => `• ${item}`).join('\n'))
    } else {
      report.push(`• ${results.success.slice(0, 5).join(', ')} ... (共${results.success.length}个)`)
    }
    report.push('')
  }

  if (results.duplicate.length > 0) {
    report.push(`⚠️ 已存在 ${results.duplicate.length} 个:`)
    if (results.duplicate.length <= 5) {
      report.push(results.duplicate.map(item => `• ${item}`).join('\n'))
    } else {
      report.push(`• ${results.duplicate.slice(0, 3).join(', ')} ... (共${results.duplicate.length}个)`)
    }
    report.push('')
  }

  if (results.invalid && results.invalid.length > 0) {
    report.push(`❌ 无效格式 ${results.invalid.length} 个`)
    report.push('')
  }

  return report
}