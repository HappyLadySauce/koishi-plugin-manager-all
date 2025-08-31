import { Logger } from 'koishi'
import { Rule, RuleCondition, Config, GroupRequestSession, ApprovalResult } from '../types'
import { DatabaseService } from '../database'

const logger = new Logger('group-master:rule-engine')

export class RuleEngine {
  constructor(
    private config: Config,
    private database?: DatabaseService
  ) {}

  async evaluateRequest(
    guildId: string, 
    userId: string, 
    message: string, 
    session: GroupRequestSession
  ): Promise<ApprovalResult> {
    // 获取规则列表
    const rules = await this.getRules(guildId)
    
    logger.debug(`评估入群申请: 用户=${userId}, 群=${guildId}, 规则数=${rules.length}`)
    
    if (rules.length === 0) {
      // 如果没有自定义规则，使用默认逻辑
      return this.evaluateWithDefaultLogic(guildId, userId, message)
    }

    // 按优先级排序并逐个评估规则
    rules.sort((a, b) => a.priority - b.priority)
    
    for (const rule of rules) {
      if (!rule.enabled) {
        continue
      }

      try {
        const matched = await this.evaluateCondition(rule.condition, {
          guildId,
          userId,
          message,
          session
        })

        if (matched) {
          logger.info(`规则匹配: ${rule.name} (${rule.id})`)
          
          return {
            shouldApprove: rule.action === 'approve',
            reason: `规则: ${rule.name}`,
            rejectionMessage: rule.message || this.config.groupManagement.rejectionMessage
          }
        }
      } catch (error) {
        logger.error(`评估规则失败: ${rule.name}`, error)
        continue
      }
    }

    // 如果没有规则匹配，使用默认行为
    return {
      shouldApprove: false,
      reason: '未匹配任何规则',
      rejectionMessage: this.config.groupManagement.rejectionMessage
    }
  }

  private async evaluateCondition(
    condition: RuleCondition,
    context: {
      guildId: string
      userId: string
      message: string
      session: GroupRequestSession
    }
  ): Promise<boolean> {
    const { type, value, operator = 'equals' } = condition
    const { guildId, userId, message } = context

    switch (type) {
      case 'userId':
        return this.evaluateUserIdCondition(guildId, userId, value, operator)
      
      case 'name':
        return this.evaluateNameCondition(guildId, message, value, operator)
      
      case 'keyword':
        return this.evaluateKeywordCondition(message, value, operator)
      
      case 'database':
        return this.evaluateDatabaseCondition(guildId, value, operator)
      
      case 'custom':
        return this.evaluateCustomCondition(context, value)
      
      default:
        logger.warn(`未知条件类型: ${type}`)
        return false
    }
  }

  private async evaluateUserIdCondition(
    guildId: string,
    userId: string,
    value: any,
    operator: string
  ): Promise<boolean> {
    switch (operator) {
      case 'equals':
        return userId === String(value)
      
      case 'in':
        if (Array.isArray(value)) {
          return value.includes(userId)
        }
        // 检查数据库中的白名单
        if (this.database && this.config.database.enabled) {
          try {
            return await this.database.isInWhitelist(guildId, userId)
          } catch (error) {
            logger.warn('检查数据库白名单失败', error)
          }
        }
        return this.config.whitelist.includes(userId)
      
      case 'not_in':
        if (Array.isArray(value)) {
          return !value.includes(userId)
        }
        // 检查不在白名单中
        if (this.database && this.config.database.enabled) {
          try {
            return !(await this.database.isInWhitelist(guildId, userId))
          } catch (error) {
            logger.warn('检查数据库白名单失败', error)
          }
        }
        return !this.config.whitelist.includes(userId)
      
      default:
        return false
    }
  }

  private async evaluateNameCondition(
    guildId: string,
    message: string,
    value: any,
    operator: string
  ): Promise<boolean> {
    switch (operator) {
      case 'equals':
        return message === String(value)
      
      case 'contains':
        return message.includes(String(value))
      
      case 'matches':
        try {
          const regex = new RegExp(String(value), 'i')
          return regex.test(message)
        } catch (error) {
          logger.warn('正则表达式格式错误', error)
          return false
        }
      
      case 'in':
        if (Array.isArray(value)) {
          return value.some(name => message.includes(String(name)))
        }
        // 检查姓名白名单
        if (this.database && this.config.database.enabled) {
          try {
            const nameList = await this.database.getNameWhitelist(guildId)
            return nameList.some(name => message.includes(name))
          } catch (error) {
            logger.warn('检查数据库姓名白名单失败', error)
          }
        }
        return this.config.nameWhitelist.some(name => message.includes(name))
      
      default:
        return false
    }
  }

  private evaluateKeywordCondition(
    message: string,
    value: any,
    operator: string
  ): boolean {
    switch (operator) {
      case 'contains':
        return message.includes(String(value))
      
      case 'in':
        if (Array.isArray(value)) {
          return value.some(keyword => message.includes(String(keyword)))
        }
        return message.includes(String(value))
      
      case 'not_in':
        if (Array.isArray(value)) {
          return !value.some(keyword => message.includes(String(keyword)))
        }
        return !message.includes(String(value))
      
      default:
        return false
    }
  }

  private async evaluateDatabaseCondition(
    guildId: string,
    value: any,
    operator: string
  ): Promise<boolean> {
    if (!this.database || !this.config.database.enabled) {
      return false
    }

    try {
      // 这里可以扩展复杂的数据库查询逻辑
      // value 应该包含查询参数
      const { table, field, queryValue } = value
      
      // 示例：查询特定表中是否存在特定值
      // 实际实现需要根据具体需求扩展
      logger.info(`数据库查询条件: table=${table}, field=${field}, value=${queryValue}`)
      
      return false // 临时返回，需要根据实际需求实现
    } catch (error) {
      logger.error('数据库条件评估失败', error)
      return false
    }
  }

  private evaluateCustomCondition(
    context: any,
    expression: string
  ): boolean {
    try {
      // 安全的JavaScript表达式评估
      // 注意：这里需要做安全检查，避免执行危险代码
      const safeExpression = this.sanitizeExpression(expression)
      
      if (!safeExpression) {
        logger.warn('不安全的自定义表达式')
        return false
      }

      // 创建安全的上下文
      const safeContext = {
        userId: context.userId,
        message: context.message,
        messageLength: context.message.length,
        hasNumbers: /\d/.test(context.message),
        hasChineseChars: /[\u4e00-\u9fa5]/.test(context.message),
        hasEnglishChars: /[a-zA-Z]/.test(context.message)
      }

      // 使用Function构造器安全执行表达式
      const func = new Function(...Object.keys(safeContext), `return ${safeExpression}`)
      return Boolean(func(...Object.values(safeContext)))
    } catch (error) {
      logger.error('自定义条件评估失败', error)
      return false
    }
  }

  private sanitizeExpression(expression: string): string | null {
    // 基本的安全检查
    const dangerousPatterns = [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /setTimeout\s*\(/i,
      /setInterval\s*\(/i,
      /require\s*\(/i,
      /import\s*\(/i,
      /process\s*\./i,
      /global\s*\./i,
      /window\s*\./i,
      /__\w+__/g, // dunder methods
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(expression)) {
        return null
      }
    }

    // 只允许安全的操作符和方法
    const safePattern = /^[a-zA-Z_$][\w$]*(\s*[+\-*/%<>=!&|?:().,\s]|\s*\w+\s*)*$/
    if (!safePattern.test(expression)) {
      return null
    }

    return expression
  }

  private async evaluateWithDefaultLogic(
    guildId: string, 
    userId: string, 
    message: string
  ): Promise<ApprovalResult> {
    // 这里是原有的默认逻辑
    // 优先级1: 严格姓名验证模式
    if (this.config.groupManagement.useNameValidation) {
      let nameWhitelist: string[]
      
      if (this.database && this.config.database.enabled) {
        try {
          nameWhitelist = await this.database.getNameWhitelist(guildId)
        } catch (error) {
          nameWhitelist = this.config.nameWhitelist
        }
      } else {
        nameWhitelist = this.config.nameWhitelist
      }

      const hasMatchingName = nameWhitelist.some(name => 
        message.includes(name.trim()) && name.trim().length > 0
      )

      if (hasMatchingName) {
        return {
          shouldApprove: true,
          reason: '姓名验证通过'
        }
      } else {
        return {
          shouldApprove: false,
          reason: '姓名验证失败',
          rejectionMessage: this.config.groupManagement.nameValidationMessage
        }
      }
    }

    // 其他默认逻辑...
    return {
      shouldApprove: false,
      reason: '默认拒绝'
    }
  }

  private async getRules(guildId: string): Promise<Rule[]> {
    if (this.database && this.config.database.enabled) {
      try {
        return await this.database.getRules(guildId)
      } catch (error) {
        logger.warn('从数据库获取规则失败', error)
      }
    }
    return []
  }
}